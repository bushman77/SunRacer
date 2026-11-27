defmodule Sunracer.Story do
  @moduledoc """
  Persistent story progress for First Run and the first Leaked Routes assignment.

  Callers report *server-confirmed* events only (a flight command the map
  accepted, a hail Navigation answered, a settled tactical outcome, a dock
  MapServer completed, a validated station dialogue, a navigation snapshot
  published by Navigation). The pure `Sunracer.Story.Prologue` engine
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
  alias Sunracer.Accounts.PlayerAccount
  alias Sunracer.Inventory
  alias Sunracer.Piracy
  alias Sunracer.Repo
  alias Sunracer.ShipCondition
  alias Sunracer.Story.{Progress, Prologue, Reward, Scenes, LeakedRoutes}
  alias Sunracer.World.PubSub

  @first_run_reward "prologue:first_run"

  @type progress :: map()

  @doc "The pilot's prologue progress, created at step 1 on first use."
  @spec progress(pos_integer()) :: progress()
  def progress(player_id) when is_integer(player_id) and player_id > 0 do
    prologue = prologue_progress(player_id)
    if LeakedRoutes.eligible?(prologue) do
      case Repo.get_by(Progress, user_id: player_id, chapter: LeakedRoutes.chapter()) do
        nil -> prologue
        row -> chapter_progress(row)
      end
    else
      prologue
    end
  end

  def prologue_progress(player_id), do: player_id |> fetch_or_create() |> as_progress()

  def prologue_active?(%{chapter: "sol.leaked_routes"}), do: false
  def prologue_active?(%{step: _}), do: true
  def prologue_active?(_), do: false

  def wants?(progress, kind),
    do: prologue_active?(progress) and Prologue.wants?(progress, kind)

  def preview(progress, event) do
    if prologue_active?(progress), do: Prologue.apply(progress, event), else: :ignore
  end

  @doc "Client-facing story state (HUD prompt, checks, reward)."
  @spec snapshot(pos_integer()) :: map()
  def snapshot(player_id), do: player_id |> progress() |> public()

  @spec public(progress()) :: map()
  def public(%{chapter: "sol.leaked_routes"} = progress), do: LeakedRoutes.public(progress)
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
    active = progress(player_id)

    cond do
      match?({:leaked_routes, _}, event) -> record_leaked_routes(player_id, event)
      not prologue_active?(active) and event in [:skip, :resume] -> record_leaked_routes(player_id, event)
      not prologue_active?(active) -> :ignored
      true -> record_prologue(player_id, event, opts)
    end
  end

  defp record_prologue(player_id, event, opts) do
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
            {current, next, effects, outcomes, changed?}
        end
      end)

    case result do
      {:ok, :ignored} ->
        :ignored

      {:ok, {current, next, effects, outcomes, changed?}} ->
        Enum.zip(effects, outcomes)
        |> Enum.each(fn {effect, outcome} ->
          safely(fn -> runtime_effect(player_id, effect, outcome, opts) end)
        end)

        story = public(next)
        scene = Scenes.on_transition(current, next)
        if changed?, do: broadcast(player_id, story, next, scene)
        {:ok, %{story: story, progress: next}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc "Story topics an attendant adds at this pilot's step."
  @spec topics(pos_integer(), String.t()) :: [map()]
  def topics(player_id, attendant_id) do
    case progress(player_id) do
      %{chapter: "sol.leaked_routes"} = current -> LeakedRoutes.topics(current, attendant_id)
      prologue ->
        base = Prologue.topics(prologue, attendant_id)
        if eligible_leaked_routes?(player_id, prologue),
          do: base ++ LeakedRoutes.topics(LeakedRoutes.new(), attendant_id),
          else: base
    end
  end

  defp eligible_leaked_routes?(player_id, prologue),
    do: LeakedRoutes.eligible?(prologue) and not is_nil(reward_receipt(player_id))

  def leaked_routes_talk(player_id, attendant_id, topic) do
    current = progress(player_id)
    chapter =
      case current do
        %{chapter: "sol.leaked_routes"} -> current
        prologue -> if eligible_leaked_routes?(player_id, prologue), do: LeakedRoutes.new()
      end

    case LeakedRoutes.dialogue(chapter, attendant_id, topic) do
      {:ok, message, nil} -> {:ok, message, LeakedRoutes.offer_topics(topic)}
      {:ok, message, event} ->
        case record(player_id, {:leaked_routes, event}) do
          {:ok, _} -> {:ok, message, nil}
          {:error, reason} -> {:error, reason}
          :ignored -> {:error, :invalid_station_topic}
        end
      :error -> {:error, :invalid_station_topic}
    end
  end

  def accept_leaked_routes(player_id), do: accept_leaked_routes(player_id, :accept_station_records)

  def accept_leaked_routes(player_id, event)
      when event in [:accept_station_records, :accept_follow_copy] do
    case record(player_id, {:leaked_routes, event}) do
      {:ok, _} ->
        message = case event do
          :accept_station_records -> "Investigation accepted. Speak to Eno Kade and Tarek Sol."
          :accept_follow_copy -> "Assignment accepted. Travel to Earth and contact Dispatcher Ross."
        end
        {:ok, message}
      {:error, reason} -> {:error, reason}
      :ignored -> {:error, :mission_unavailable}
    end
  end

  # Lock the completed prologue first, then the chapter row. This serializes
  # first acceptance with other chapter events and preserves the old row.
  defp record_leaked_routes(player_id, event) do
    event = case event do
      {:leaked_routes, kind} -> kind
      kind when kind in [:skip, :resume] -> kind
      _ -> :unsupported
    end

    result = Repo.transaction(fn ->
      prologue = lock!(player_id) |> as_progress()
      if eligible_leaked_routes?(player_id, prologue) do
        row = Repo.get_by(Progress, user_id: player_id, chapter: LeakedRoutes.chapter())
        cond do
          is_nil(row) and event == :accept_station_records ->
            now = DateTime.utc_now()
            initial = LeakedRoutes.new()
            row = Repo.insert!(%Progress{user_id: player_id, chapter: LeakedRoutes.chapter(),
              step: initial.step, flags: initial.flags, skipped: false,
              step_started_at: now, step_times: %{"1" => DateTime.to_iso8601(now)}})
            apply_chapter_event(player_id, row, event)
          is_nil(row) -> :ignored
          event in [:accept_follow_copy, :dispatch_original, :clearing_audit] and
              is_nil(reward_receipt(player_id, LeakedRoutes.reward_id())) -> :ignored
          true -> apply_chapter_event(player_id, row, event)
        end
      else
        :ignored
      end
    end)

    case result do
      {:ok, :ignored} -> :ignored
      {:ok, {current, next}} ->
        story = public(next)
        broadcast(player_id, story, next, LeakedRoutes.scene(current, next))
        {:ok, %{story: story, progress: next}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp apply_chapter_event(player_id, row, event) do
    current = chapter_progress(row)
    case LeakedRoutes.apply(current, event) do
      :ignore -> :ignored
      {:ok, next, effects} ->
        Enum.each(effects, &db_effect!(player_id, &1))
        save!(row, current, next)
        {current, next}
    end
  end

  defp chapter_progress(row), do: Map.put(as_progress(row), :chapter, row.chapter)

  @doc "The story line for a validated story topic, recording the dialogue."
  @spec talk(pos_integer(), String.t(), keyword()) :: {:ok, String.t()} | {:error, term()}
  def talk(player_id, attendant_id, opts \\ []) do
    current = progress(player_id)
    dialogue = if prologue_active?(current), do: Prologue.dialogue(current, attendant_id), else: :error
    case dialogue do
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

  defp db_effect!(player_id, {:story_credits, reward_id, credits}) do
    case Repo.insert(Ecto.Changeset.change(%Reward{}, user_id: player_id,
           reward_id: reward_id, credits: credits, details: %{"chapter" => LeakedRoutes.chapter()}),
           on_conflict: :nothing, conflict_target: [:user_id, :reward_id], returning: true) do
      {:ok, %Reward{id: id}} when is_integer(id) ->
        {1, _} = from(a in PlayerAccount, where: a.id == ^player_id)
                 |> Repo.update_all(inc: [credits: credits])
      {:ok, _already_paid} -> :ok
      {:error, reason} -> Repo.rollback(reason)
    end
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

  defp broadcast(player_id, story, progress, scene) do
    # Scene metadata accompanies this *transition event* only, never the
    # persisted snapshot. Reconnecting cannot replay an old transmission.
    story = if scene, do: Map.put(story, :scene, scene), else: story
    Phoenix.PubSub.broadcast(
      Sunracer.PubSub,
      PubSub.topic("sol"),
      {:story_updated, %{player_id: player_id, story: story, progress: progress}}
    )
  end
end
