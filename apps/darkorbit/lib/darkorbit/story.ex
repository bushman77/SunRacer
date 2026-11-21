defmodule Darkorbit.Story do
  @moduledoc """
  Persistent story progress for the "First Run" prologue.

  Callers report *server-confirmed* events only (a flight command the map
  accepted, a hail Navigation answered, a settled tactical outcome, a dock
  MapServer completed, a validated station dialogue, a navigation snapshot
  published by Navigation). The pure `Darkorbit.Story.Prologue` engine
  decides what changes. This module applies it under a row lock:

    * database effects (crates, credits, the payout receipt, faction
      standing) commit in the same transaction as the step change, so a
      retry or reconnect never double-counts;
    * runtime effects (staging a private story vessel, the hull patch,
      the cached standing) run after commit and are idempotent.

  Every change is broadcast as `{:story_updated, %{player_id, story}}` on the
  pilot's SOL PubSub topic; the world channel forwards only its own pilot's.
  """

  import Ecto.Query, warn: false
  require Logger

  alias Core.World, as: Simulation
  alias Darkorbit.Accounts.PlayerAccount
  alias Darkorbit.Inventory
  alias Darkorbit.Piracy
  alias Darkorbit.Repo
  alias Darkorbit.ShipCondition
  alias Darkorbit.Story.{Progress, Prologue, Reward}
  alias Darkorbit.World.PubSub

  @first_run_reward "prologue:first_run"

  @type progress :: Prologue.progress()

  @doc "The pilot's prologue progress, created at step 1 on first use."
  @spec progress(pos_integer()) :: progress()
  def progress(player_id) when is_integer(player_id) and player_id > 0 do
    player_id |> fetch_or_create() |> as_progress()
  end

  @doc "Client-facing story state (HUD prompt, checks, reward)."
  @spec snapshot(pos_integer()) :: map()
  def snapshot(player_id), do: player_id |> progress() |> public()

  @spec public(progress()) :: map()
  def public(%{step: step, flags: flags, skipped: skipped} = progress) do
    complete = step == Prologue.complete_step()

    %{
      chapter: Prologue.chapter(),
      step: min(step, 9),
      total_steps: 9,
      complete: complete,
      skipped: skipped,
      prompt: if(skipped, do: nil, else: Prologue.prompt(progress)),
      license: flags["helios_license"] == true,
      reward:
        if(complete,
          do: %{
            credits: Prologue.first_pay(),
            faction_id: Prologue.helios_faction(),
            standing_gain: Prologue.helios_standing_gain()
          },
          else: nil
        )
    }
  end

  @doc """
  Apply one server-confirmed event.

  Options: `:session_id` (needed for the hull patch). Returns
  `{:ok, %{story: public, progress: progress}}`, `:ignored`, or
  `{:error, reason}` when a database effect failed (nothing is saved).
  """
  @spec record(pos_integer(), term(), keyword()) ::
          {:ok, %{story: map(), progress: progress()}} | :ignored | {:error, term()}
  def record(player_id, event, opts \\ []) when is_integer(player_id) and player_id > 0 do
    _ = fetch_or_create(player_id)

    result =
      Repo.transaction(fn ->
        row = lock!(player_id)
        current = as_progress(row)
        facts = facts(player_id, event)

        case Prologue.apply(current, event, facts) do
          :ignore ->
            :ignored

          {:ok, next, effects} ->
            outcomes = Enum.map(effects, &db_effect!(player_id, &1))
            changed? = next != current
            if changed?, do: save!(row, current, next)
            {next, effects, outcomes, changed?}
        end
      end)

    case result do
      {:ok, :ignored} ->
        :ignored

      {:ok, {next, effects, outcomes, changed?}} ->
        Enum.zip(effects, outcomes)
        |> Enum.each(fn {effect, outcome} ->
          safely(fn -> runtime_effect(player_id, effect, outcome, opts) end)
        end)

        story = public(next)
        if changed?, do: broadcast(player_id, story, next)
        {:ok, %{story: story, progress: next}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc "Story topics an attendant adds at this pilot's step."
  @spec topics(pos_integer(), String.t()) :: [map()]
  def topics(player_id, attendant_id), do: Prologue.topics(progress(player_id), attendant_id)

  @doc "The story line for a validated story topic, recording the dialogue."
  @spec talk(pos_integer(), String.t(), keyword()) :: {:ok, String.t()} | {:error, term()}
  def talk(player_id, attendant_id, opts \\ []) do
    case Prologue.dialogue(progress(player_id), attendant_id) do
      {:ok, message} ->
        case record(player_id, {:talked, attendant_id}, opts) do
          {:error, reason} -> {:error, reason}
          _ -> {:ok, message}
        end

      :error ->
        {:error, :invalid_station_topic}
    end
  end

  @doc "Read-only once-only receipt for a story payout."
  def reward_receipt(player_id, reward_id \\ @first_run_reward) do
    Repo.get_by(Reward, user_id: player_id, reward_id: reward_id)
  end

  # -- persistence ----------------------------------------------------------

  defp fetch_or_create(player_id) do
    now = DateTime.utc_now()
    initial = Prologue.new()

    Repo.insert!(
      %Progress{
        user_id: player_id,
        chapter: Prologue.chapter(),
        step: initial.step,
        flags: initial.flags,
        skipped: false,
        step_started_at: now,
        step_times: %{"1" => DateTime.to_iso8601(now)}
      },
      on_conflict: :nothing,
      conflict_target: [:user_id, :chapter]
    )

    Repo.get_by!(Progress, user_id: player_id, chapter: Prologue.chapter())
  end

  defp lock!(player_id) do
    from(p in Progress,
      where: p.user_id == ^player_id and p.chapter == ^Prologue.chapter(),
      lock: "FOR UPDATE"
    )
    |> Repo.one!()
  end

  defp as_progress(%Progress{step: step, flags: flags, skipped: skipped}),
    do: %{step: step, flags: flags || %{}, skipped: skipped == true}

  defp save!(row, current, next) do
    now = DateTime.utc_now()
    stepped? = next.step != current.step

    changes = %{step: next.step, flags: next.flags, skipped: next.skipped}

    changes =
      if stepped? do
        Map.merge(changes, %{
          step_started_at: now,
          step_times:
            Map.put(row.step_times || %{}, Integer.to_string(next.step), DateTime.to_iso8601(now)),
          completed_at:
            if(next.step == Prologue.complete_step(),
              do: now,
              else: row.completed_at
            )
        })
      else
        changes
      end

    case Repo.update(Ecto.Changeset.change(row, changes)) do
      {:ok, saved} -> saved
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp facts(player_id, {:navigation, _nav}),
    do: %{crates: Map.get(Inventory.cargo_manifest(player_id), Prologue.cargo_id(), 0)}

  defp facts(_player_id, _event), do: %{}

  # -- effects --------------------------------------------------------------

  defp db_effect!(player_id, :grant_consignment),
    do: load_crates!(player_id, Prologue.crates())

  defp db_effect!(player_id, {:reissue, count}), do: load_crates!(player_id, count)

  defp db_effect!(player_id, :deliver) do
    case Inventory.remove_cargo(player_id, Prologue.cargo_id(), Prologue.crates()) do
      {:ok, _} -> :ok
      {:error, reason} -> Repo.rollback(reason)
    end

    receipt =
      Repo.insert(
        Ecto.Changeset.change(%Reward{},
          user_id: player_id,
          reward_id: @first_run_reward,
          credits: Prologue.first_pay(),
          details: %{"license" => "helios_courier", "crates" => Prologue.crates()}
        ),
        on_conflict: :nothing,
        conflict_target: [:user_id, :reward_id],
        returning: true
      )

    case receipt do
      {:ok, %Reward{id: id}} when is_integer(id) ->
        {1, _} =
          from(a in PlayerAccount, where: a.id == ^player_id)
          |> Repo.update_all(inc: [credits: Prologue.first_pay()])

      {:ok, _already_paid} ->
        :ok

      {:error, reason} ->
        Repo.rollback(reason)
    end

    Piracy.record_story_standing!(
      player_id,
      Prologue.helios_faction(),
      "story:#{@first_run_reward}:#{player_id}",
      "story_delivery",
      Prologue.helios_standing_gain()
    )
  end

  defp db_effect!(_player_id, _runtime_only), do: :ok

  defp load_crates!(player_id, count) do
    case Inventory.add_cargo(player_id, Prologue.cargo_id(), count) do
      {:ok, _} -> :ok
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp runtime_effect(player_id, {:stage, script}, _outcome, _opts) do
    case Simulation.solar_stage_story_contact(player_id, script) do
      {:ok, _} -> :ok
      # Navigation re-checks the hold; a busy lane retries on the next tick.
      {:error, reason} -> Logger.debug("story staging deferred: #{inspect(reason)}")
    end
  end

  defp runtime_effect(player_id, :clear_story_contacts, _outcome, _opts) do
    _ = Simulation.solar_clear_story_contacts(player_id)
    :ok
  end

  defp runtime_effect(player_id, :patch_hull, _outcome, opts) do
    with session_id when not is_nil(session_id) <- Keyword.get(opts, :session_id),
         {:ok, %{ship_instance_id: ship_id, docked: true}} <-
           Simulation.ship_condition(session_id),
         {:ok, _} <- ShipCondition.story_patch(player_id, ship_id),
         {:ok, _} <- Simulation.station_patch_hull(session_id) do
      :ok
    else
      other -> Logger.warning("story hull patch skipped: #{inspect(other)}")
    end
  end

  defp runtime_effect(player_id, :deliver, %{standing: standing, faction_id: faction}, _opts) do
    _ =
      Core.Universe.Navigation.set_faction_standing(
        Module.concat(Core.World.SessionManager, Core.Universe.Navigation),
        player_id,
        faction,
        standing
      )

    :ok
  end

  defp runtime_effect(_player_id, _effect, _outcome, _opts), do: :ok

  # Runtime effects follow a committed step. A world process that is down
  # (or not started, in isolated tests) must not undo the committed change;
  # staging and the cached standing are re-derived on the next event.
  defp safely(fun) do
    fun.()
  catch
    :exit, reason -> Logger.warning("story runtime effect unavailable: #{inspect(reason)}")
  end

  defp broadcast(player_id, story, progress) do
    Phoenix.PubSub.broadcast(
      Darkorbit.PubSub,
      PubSub.topic("sol"),
      {:story_updated, %{player_id: player_id, story: story, progress: progress}}
    )
  end
end
