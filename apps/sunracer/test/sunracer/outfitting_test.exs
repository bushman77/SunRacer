defmodule Sunracer.OutfittingTest do
  use Sunracer.DataCase, async: false

  import Sunracer.AccountsFixtures

  alias Core.Universe.{FreeFlightRegion, GreenStarbase, Navigation}
  alias Core.World
  alias Sunracer.{Fleet, Inventory, Loadouts, Outfitting, ShipCondition, ShipStats}
  alias Sunracer.Outfitting.Shop
  alias Sunracer.World, as: GameWorld

  test "progression price tiers are scarce relative to the one-time prologue reward" do
    prices = Shop.stock()
    assert length(prices) == length(Core.Equipment.Catalog.all())
    assert Enum.all?(prices, &(&1.price >= 40 * Sunracer.Story.Prologue.first_pay()))
    assert {:ok, 35_000} = Shop.price("beryl")
    assert {:ok, 250_000} = Shop.price("sg1")
    assert {:ok, 25_000_000} = Shop.price("lf4")
    assert {:ok, 35_000_000} = Shop.price("bo2")
    assert {:error, :not_for_sale} = Shop.price("not-real")
    assert {:error, :not_for_sale} = Shop.price(nil)
  end

  test "only owned compatible items may be previewed for real ship hardpoints" do
    pilot = player_account_fixture()
    {:ok, ship} = Fleet.get_active_ship(pilot.id)
    assert {:ok, view} = Outfitting.snapshot(pilot.id, ship.id, 1)
    assert view.ship.name == "Sunracer"
    assert view.ship.laser_slots == 1
    assert view.ship.generator_slots == 1
    assert Enum.map(view.configurations, & &1.number) == [1, 2]
    assert {:error, :not_enough_equipment} =
      Outfitting.preview(pilot.id, ship.id, 1, "laser", 0, "beryl")

    assert {:ok, _} = Inventory.add_lasers(pilot.id, "beryl", 1)
    assert {:ok, _} = Inventory.add_equipment(pilot.id, "sg1", 1)
    assert {:ok, preview} = Outfitting.preview(pilot.id, ship.id, 1, "laser", 0, "beryl")
    assert preview.before.damage == 10
    assert preview.after.damage == 15

    assert {:ok, shield} = Outfitting.preview(pilot.id, ship.id, 2, "generator", 0, "sg1")
    assert shield.before.shields == 0
    assert shield.after.shields == 1_000
    assert {:error, :slot_locked} =
      Outfitting.preview(pilot.id, ship.id, 1, "laser", 1, "beryl")
    assert {:error, :incompatible_equipment} =
      Outfitting.preview(pilot.id, ship.id, 1, "laser", 0, "sg1")
    assert {:error, :invalid_configuration} =
      Outfitting.preview(pilot.id, ship.id, 3, "laser", 0, "beryl")
    assert {:error, :invalid_outfitting_command} =
      Outfitting.preview(pilot.id, ship.id, 1, "laser", "zero", "beryl")
    assert Inventory.laser_count(pilot.id, "beryl") == 1
  end

  test "Ilya fits an owned laser and shield without healing hull or bypassing station security" do
    pilot = player_account_fixture()
    {:ok, ship} = Fleet.get_active_ship(pilot.id)
    {:ok, stats} = ShipStats.calculate(pilot.id, ship.id, 1)
    assert {:ok, initial} = ShipCondition.load_or_initialize(pilot.id, ship.id, stats)
    damaged = %{initial | hull: initial.hull - 25, shields: 0}
    assert :ok = ShipCondition.save_verified(pilot.id, ship.id, damaged)

    assert {:ok, _} = Inventory.add_lasers(pilot.id, "beryl", 1)
    assert {:ok, _} = Inventory.add_equipment(pilot.id, "sg1", 1)

    solar = Module.concat(Core.World.SessionManager, Navigation)
    assert {:ok, _} = Navigation.snapshot(solar, pilot.id)
    starbase = GreenStarbase.position_km()
    :sys.replace_state(solar, fn state ->
      voyage = Map.fetch!(state.voyages, pilot.id)
      at_station = %{voyage |
        status: :idle, location_id: nil, origin_id: nil,
        arrival_origin_id: nil, destination_id: nil,
        position_km: starbase, origin_position_km: starbase,
        destination_position_km: nil}
      %{state | voyages: Map.put(state.voyages, pilot.id, at_station)}
    end)

    assert {:ok, session} = GameWorld.connect(pilot.id)
    on_exit(fn -> GameWorld.disconnect(session.id) end)
    assert session.map_id == FreeFlightRegion.map_id(pilot.id)
    assert {:error, :not_docked} = GameWorld.outfitting_snapshot(session.id)
    assert {:error, :not_docked} = GameWorld.outfitting_purchase(session.id, "beryl")
    assert {:error, :not_docked} =
      GameWorld.outfitting_fit(session.id, 1, "laser", 0, "beryl")
    assert Inventory.laser_count(pilot.id, "beryl") == 1

    origin = GreenStarbase.local_site()
    position = %World.Position{
      x: origin.x, y: origin.y - 10.0 / 0.06, z: origin.z
    }
    [{map_pid, _}] = Registry.lookup(Core.World.Registry,
      {:world_map, session.map_id})
    :sys.replace_state(map_pid, fn state ->
      entity = Map.fetch!(state.entities, pilot.id)
      %{state | entities: Map.put(state.entities, pilot.id,
        %{entity | position: position})}
    end)
    assert {:ok, %{docked: true}} = GameWorld.dock(session.id)
    assert {:error, :station_attendant_out_of_range} =
      GameWorld.outfitting_fit(session.id, 1, "laser", 0, "beryl")
    assert {:error, :station_attendant_out_of_range} =
      GameWorld.outfitting_purchase(session.id, "beryl")
    assert Inventory.laser_count(pilot.id, "beryl") == 1

    # Only the server's station-position restore helper can set a test pose.
    assert :ok = World.restore_station_position(session.id,
      %{room_id: "outfitting", x: -49.0, z: -181.0, yaw: 0.0})
    assert {:ok, view} = GameWorld.outfitting_snapshot(session.id)
    assert view.active_configuration == 1
    assert Enum.any?(view.inventory, &(&1.id == "beryl" and &1.quantity == 1))

    assert {:ok, fitted} = GameWorld.outfitting_fit(session.id, 1, "laser", 0, "beryl")
    assert fitted.combat.hull == damaged.hull
    assert fitted.combat.max_hull == initial.max_hull
    assert fitted.outfitting.configurations |> hd() |> Map.get(:stats) |> Map.get(:damage) == 15
    assert Inventory.laser_count(pilot.id, "beryl") == 0
    assert Map.fetch!(:sys.get_state(map_pid).docked_ships, pilot.id).damage == 15

    # Fitting the inactive second configuration does not alter live shield capacity.
    assert {:ok, inactive} = GameWorld.outfitting_fit(session.id, 2, "generator", 0, "sg1")
    assert inactive.combat.max_shields == 0
    assert Enum.at(inactive.outfitting.configurations, 1).stats.shields == 1_000
    assert Inventory.equipment_count(pilot.id, "sg1") == 0

    assert {:ok, _} = Inventory.add_equipment(pilot.id, "sg2", 1)
    assert {:ok, shielded} = GameWorld.outfitting_fit(session.id, 1, "generator", 0, "sg2")
    assert shielded.combat.hull == damaged.hull
    assert shielded.combat.max_shields == 2_000
    assert shielded.combat.shields == 0
    assert Map.fetch!(:sys.get_state(map_pid).docked_ships, pilot.id).max_shields == 2_000
    assert {:ok, cleared} = GameWorld.outfitting_fit(session.id, 1, "generator", 0, nil)
    assert cleared.combat.max_shields == 0
    assert cleared.combat.hull == damaged.hull
    assert Inventory.equipment_count(pilot.id, "sg2") == 1
    assert {:ok, removed} = GameWorld.outfitting_fit(session.id, 1, "laser", 0, nil)
    assert removed.combat.hull == damaged.hull
    assert Inventory.laser_count(pilot.id, "beryl") == 1

    assert {:ok, active} = ShipStats.calculate(pilot.id, ship.id, 1)
    assert active.damage == 10
    assert {:ok, durable} = ShipCondition.load_or_initialize(pilot.id, ship.id, active)
    assert durable.hull == damaged.hull
    assert durable.shields == 0
    assert Sunracer.Accounts.get_player_account!(pilot.id).credits == pilot.credits

    assert {:error, :insufficient_credits} =
      GameWorld.outfitting_purchase(session.id, "beryl")
    assert {:error, :not_for_sale} =
      GameWorld.outfitting_purchase(session.id, "fake")
    assert Inventory.laser_count(pilot.id, "beryl") == 1

    account = Sunracer.Accounts.get_player_account!(pilot.id)
    {:ok, _funded} =
      account
      |> Ecto.Changeset.change(credits: 80_000)
      |> Repo.update()

    assert {:ok, %{receipt: first, outfitting: stocked}} =
      GameWorld.outfitting_purchase(session.id, "beryl")
    assert first.price == 35_000
    assert first.credits_remaining == 45_000
    assert stocked.credits == 45_000
    assert Enum.find(stocked.inventory, &(&1.id == "beryl")).quantity == 2

    assert {:ok, %{receipt: second}} =
      GameWorld.outfitting_purchase(session.id, "beryl")
    assert second.credits_remaining == 10_000
    assert {:error, :insufficient_credits} =
      GameWorld.outfitting_purchase(session.id, "beryl")
    assert Inventory.laser_count(pilot.id, "beryl") == 3
    assert Sunracer.Accounts.get_player_account!(pilot.id).credits == 10_000

    assert {:ok, %{docked: false, entity: launched}} = GameWorld.launch(session.id)
    assert launched.damage == 10
    assert launched.hull == damaged.hull
    assert launched.shields == 0
    assert {:error, :not_docked} =
      GameWorld.outfitting_fit(session.id, 1, "laser", 0, "beryl")
    assert {:error, :not_docked} =
      GameWorld.outfitting_purchase(session.id, "beryl")
  end
end
