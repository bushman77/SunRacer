defmodule Sunracer.Outfitting do
  @moduledoc """
  Owned, station-only ship fitting. Catalogue and preview information is
  read-only; inventory transfers and condition rebases are one DB transaction.
  The map process locks the parked hull for each mutation.
  """

  import Ecto.Query, warn: false

  alias Core.Equipment.Catalog, as: Equipment
  alias Core.Ships.Catalog, as: Ships
  alias Core.Ships.Stats
  alias Sunracer.{Fleet, Inventory, Loadouts, Repo, ShipCondition, ShipStats}
  alias Sunracer.Accounts.PlayerAccount
  alias Sunracer.Outfitting.Shop

  @spec snapshot(pos_integer(), pos_integer(), 1 | 2) :: {:ok, map()} | {:error, term()}
  def snapshot(player_id, ship_id, active) do
    with {:ok, ship} <- owned_ship(player_id, ship_id),
         {:ok, definition} <- Ships.fetch(ship.ship_id),
         {:ok, configurations} <- configurations(player_id, ship_id, active, definition) do
      items =
        Equipment.all()
        |> Enum.map(fn item ->
          %{id: item.id, name: item.name, category: Atom.to_string(item.category),
            quantity: Inventory.equipment_count(player_id, item.id),
            damage: item.damage, speed: item.speed, shields: item.shields,
            shield_absorption: item.shield_absorption,
            shield_regeneration: item.shield_regeneration}
        end)
        |> Enum.filter(&(&1.quantity > 0))

      account = Repo.get(PlayerAccount, player_id)
      {:ok, %{
        credits: account.credits,
        shop: Shop.stock(),
        ship: %{id: ship.ship_id, name: definition.name,
          laser_slots: definition.laser_slots,
          generator_slots: definition.generator_slots},
        active_configuration: active,
        configurations: configurations,
        inventory: items
      }}
    end
  end

  @spec preview(pos_integer(), pos_integer(), term(), term(), term(), term()) ::
          {:ok, map()} | {:error, term()}
  def preview(player_id, ship_id, config, kind, slot, item_id) do
    with {:ok, ship} <- owned_ship(player_id, ship_id),
         {:ok, definition} <- Ships.fetch(ship.ship_id),
         {:ok, loadout} <- configuration(ship_id, config),
         {:ok, field, current} <- slot_item(definition, loadout, kind, slot),
         :ok <- validate_item(player_id, field, current, item_id),
         {:ok, before} <- ShipStats.calculate(player_id, ship_id, config),
         {:ok, after_stats} <- Stats.calculate(ship.ship_id,
           proposal(loadout, field, slot, item_id)) do
      {:ok, %{before: attributes(before), after: attributes(after_stats),
        kind: kind, slot: slot, item_id: item_id, configuration: config}}
    end
  end

  @doc """
  Purchase exactly one catalogued item at the authoritative credit price.
  Locking the account row serializes concurrent purchases, while both the
  credit debit and inventory addition commit (or roll back) together.
  """
  def purchase(player_id, ship_id, active, item_id) when is_binary(item_id) do
    Repo.transaction(fn ->
      with {:ok, _ship} <- owned_ship(player_id, ship_id),
           {:ok, %{price: price, name: name}} <- Shop.quote(item_id),
           %PlayerAccount{} = account <- Repo.one(
             from a in PlayerAccount, where: a.id == ^player_id, lock: "FOR UPDATE"),
           true <- account.credits >= price,
           {:ok, _inventory} <- Inventory.add_equipment(player_id, item_id, 1),
           {:ok, updated_account} <- account
             |> Ecto.Changeset.change(credits: account.credits - price)
             |> Repo.update(),
           {:ok, view} <- snapshot(player_id, ship_id, active) do
        %{outfitting: view,
          receipt: %{item_id: item_id, name: name,
            price: price, credits_remaining: updated_account.credits}}
      else
        false -> Repo.rollback(:insufficient_credits)
        nil -> Repo.rollback(:account_not_found)
        {:error, reason} -> Repo.rollback(reason)
        _ -> Repo.rollback(:invalid_purchase)
      end
    end)
  end
  def purchase(_, _, _, _), do: {:error, :invalid_purchase}

  @doc "Called only inside the authenticated MapServer station-refit callback."
  def fit(player_id, %{ship_instance_id: ship_id, combat: combat}, active,
          config, kind, slot, item_id) do
    Repo.transaction(fn ->
      with {:ok, ship} <- owned_ship(player_id, ship_id),
           {:ok, definition} <- Ships.fetch(ship.ship_id),
           {:ok, loadout} <- configuration(ship_id, config),
           {:ok, field, current} <- slot_item(definition, loadout, kind, slot),
           :ok <- validate_item(player_id, field, current, item_id),
           :ok <- ShipCondition.save_verified(player_id, ship_id, combat),
           {:ok, _updated} <- apply_change(player_id, loadout.id, field, slot, item_id),
           {:ok, stats} <- ShipStats.calculate(player_id, ship_id, active),
           {:ok, condition} <- ShipCondition.load_or_initialize(player_id, ship_id, stats),
           {:ok, view} <- snapshot(player_id, ship_id, active) do
        %{stats: stats, condition: condition, outfitting: view}
      else
        {:error, reason} -> Repo.rollback(reason)
        _ -> Repo.rollback(:invalid_outfitting_command)
      end
    end)
  end

  def fit(_, _, _, _, _, _, _), do: {:error, :invalid_outfitting_command}

  defp owned_ship(player_id, ship_id) do
    case Fleet.get_active_ship(player_id) do
      {:ok, %{id: ^ship_id} = ship} -> {:ok, ship}
      {:ok, _} -> {:error, :wrong_ship}
      {:error, _} = error -> error
    end
  end

  defp configurations(player_id, ship_id, active, definition) do
    Enum.reduce_while(1..2, {:ok, []}, fn number, {:ok, acc} ->
      with {:ok, loadout} <- configuration(ship_id, number),
           {:ok, stats} <- ShipStats.calculate(player_id, ship_id, number) do
        view = %{number: number, active: number == active,
          slots: %{
            laser: (loadout.lasers || %{}) |> Map.get("ship", []) |>
              Enum.take(definition.laser_slots),
            generator: (loadout.generators || %{}) |> Map.get("ship", []) |>
              Enum.take(definition.generator_slots)
          },
          stats: attributes(stats)}
        {:cont, {:ok, [view | acc]}}
      else
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, acc} -> {:ok, Enum.reverse(acc)}
      error -> error
    end
  end

  defp configuration(ship_id, number) when number in [1, 2] do
    case Loadouts.get_loadout(ship_id, number) do
      nil -> {:error, :loadout_not_found}
      loadout -> {:ok, loadout}
    end
  end
  defp configuration(_, _), do: {:error, :invalid_configuration}

  defp slot_item(definition, loadout, kind, slot)
      when kind in ["laser", "generator"] and is_integer(slot) and slot >= 0 do
    {field, limit, equipment} =
      if kind == "laser",
        do: {:lasers, definition.laser_slots, loadout.lasers || %{}},
        else: {:generators, definition.generator_slots, loadout.generators || %{}}
    slots = Map.get(equipment, "ship", [])
    cond do
      slot >= limit -> {:error, :slot_locked}
      slot >= length(slots) -> {:error, :invalid_slot}
      true -> {:ok, field, Enum.at(slots, slot)}
    end
  end
  defp slot_item(_, _, _, _), do: {:error, :invalid_outfitting_command}

  defp validate_item(_player_id, _field, _current, nil), do: :ok
  defp validate_item(player_id, field, current, item_id) when is_binary(item_id) do
    case Equipment.fetch(item_id) do
      {:ok, %{category: :laser}} when field == :lasers ->
        available?(player_id, current, item_id)
      {:ok, %{category: category}} when field == :generators
                                      and category in [:generator, :shield] ->
        available?(player_id, current, item_id)
      _ ->
        {:error, :incompatible_equipment}
    end
  end
  defp validate_item(_, _, _, _), do: {:error, :invalid_outfitting_command}

  defp available?(_player_id, item, item), do: :ok
  defp available?(player_id, _current, item) do
    if Inventory.equipment_count(player_id, item) > 0,
      do: :ok, else: {:error, :not_enough_equipment}
  end

  defp apply_change(player_id, id, :lasers, slot, nil),
    do: Loadouts.unequip_laser_to_inventory(player_id, id, "ship", slot)
  defp apply_change(player_id, id, :lasers, slot, item),
    do: Loadouts.equip_laser_from_inventory(player_id, id, "ship", slot, item)
  defp apply_change(player_id, id, :generators, slot, nil),
    do: Loadouts.unequip_generator_to_inventory(player_id, id, "ship", slot)
  defp apply_change(player_id, id, :generators, slot, item),
    do: Loadouts.equip_generator_from_inventory(player_id, id, "ship", slot, item)

  defp proposal(loadout, field, slot, item) do
    equipment = Map.get(loadout, field) || %{}
    updated = Map.update!(equipment, "ship", &List.replace_at(&1, slot, item))
    %{lasers: loadout.lasers, generators: loadout.generators}
    |> Map.put(field, updated)
  end

  defp attributes(stats) do
    stats
    |> Map.from_struct()
    |> Map.take([:hit_points, :shields, :speed, :damage,
      :shield_absorption, :shield_regeneration])
  end
end
