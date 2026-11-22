defmodule Sunracer.Inventory.View do
  @moduledoc """
  Server-owned read-only view of the pilot's ship inventory.

  Does not move cargo, equip gear, charge credits or require docking. Both
  configurations and the loose equipment bag come from the existing
  authoritative outfitting read model; cargo and capacity come from the
  inventory table and actual owned hull definition.
  """

  alias Core.Ships.Catalog, as: Ships
  alias Core.Equipment.Catalog, as: Gear
  alias Sunracer.{Fleet, Inventory, Outfitting}
  alias Sunracer.Cargo.Catalog, as: Cargo

  @spec snapshot(pos_integer(), 1 | 2) :: {:ok, map()} | {:error, term()}
  def snapshot(player_id, active) when is_integer(player_id) and
      player_id > 0 and active in [1, 2] do
    with {:ok, ship} <- Fleet.get_active_ship(player_id),
         {:ok, definition} <- Ships.fetch(ship.ship_id),
         {:ok, fitting} <- Outfitting.snapshot(player_id, ship.id, active) do
      cargo =
        Inventory.cargo_manifest(player_id)
        |> Enum.filter(fn {_id, count} -> is_integer(count) and count > 0 end)
        |> Enum.map(fn {id, count} ->
          case Cargo.fetch(id) do
            {:ok, item} ->
              %{id: id, name: item.name, quantity: count,
                mass_tonnes: item.mass_tonnes,
                total_tonnes: count * item.mass_tonnes}

            {:error, _} ->
              %{id: id, name: id, quantity: count,
                mass_tonnes: 0, total_tonnes: 0}
          end
        end)
        |> Enum.sort_by(& &1.name)

      {:ok, %{
        ship: %{id: ship.ship_id, name: definition.name,
          base_damage: definition.damage},
        credits: fitting.credits,
        cargo: %{
          items: cargo,
          used_tonnes: Inventory.cargo_tonnage(player_id),
          capacity_tonnes: definition.cargo_capacity
        },
        equipment: fitting.inventory,
        catalog: Enum.map(Gear.all(), fn item ->
          %{id: item.id, name: item.name,
            category: Atom.to_string(item.category)}
        end),
        configurations: fitting.configurations,
        active_configuration: fitting.active_configuration
      }}
    end
  end

  def snapshot(_player_id, _active), do: {:error, :invalid_inventory_request}
end
