defmodule Core.World.GreenStarbaseDockingTest do
  use ExUnit.Case, async: true

  alias Core.Universe.GreenStarbase
  alias Core.World.{Entity, FlightDynamics, GreenStarbaseDocking, GreenStarbaseSafety,
                    MapDefinition, Orientation, Position}

  defp at(x, y, z) do
    origin = GreenStarbase.local_site()
    %Position{x: origin.x + x / 0.06, y: origin.y + z / 0.06,
      z: origin.z + y / 0.06}
  end

  defp ship(position) do
    %Entity{id: 13, kind: :player, player_id: 13, session_id: 4,
      position: position, speed: 320, hull: 200, max_hull: 200,
      shields: 0, max_shields: 0, shield_absorption: 0.0,
      damage: 10, attack_range: 3_600, attack_cooldown_ticks: 1,
      next_attack_tick: 0, status: :alive}
  end

  test "only the empty central hangar volume can authorize docking" do
    assert GreenStarbaseDocking.inside_bay?(at(0, 0, -12))
    assert GreenStarbaseDocking.inside_bay?(at(0, 0, 5))
    refute GreenStarbaseDocking.inside_bay?(at(0, 0, -30))
    refute GreenStarbaseDocking.inside_bay?(at(0, 0, 22))
    refute GreenStarbaseDocking.inside_bay?(at(18, 0, -12))
    refute GreenStarbaseDocking.inside_bay?(at(0, 11, -12))
    refute GreenStarbaseSafety.inside?(at(0, 0, 0))
    assert :ok == GreenStarbaseDocking.ready?(ship(at(0, 0, 0)))
    assert :ok == GreenStarbaseDocking.auto_ready?(ship(at(0, 0, 0)))
    assert {:error, :outside_docking_bay} =
      GreenStarbaseDocking.ready?(ship(at(0, 0, -40)))
  end

  test "moving, navigating, fighting and destroyed ships cannot dock" do
    resting = ship(at(0, 0, -8))
    assert {:error, :reduce_speed_to_dock} =
      GreenStarbaseDocking.ready?(%{resting | throttle: 0.5})
    assert {:error, :reduce_speed_to_dock} =
      GreenStarbaseDocking.ready?(%{resting |
        velocity: %{x: 30.0, y: 0.0, z: 0.0}})
    # Manually requesting a dock at low speed still works, but the automatic
    # hold must not complete if the ship is slowly drifting.
    moving = %{resting | velocity: %{x: 2.0, y: 0.0, z: 0.0}}
    assert :ok == GreenStarbaseDocking.ready?(moving)
    assert {:error, :ship_still_moving} =
      GreenStarbaseDocking.auto_ready?(moving)
    assert {:error, :stop_navigation_first} =
      GreenStarbaseDocking.ready?(%{resting | destination: at(0, 0, 10)})
    assert {:error, :disengage_combat_first} =
      GreenStarbaseDocking.ready?(%{resting | engaged_target_id: "enemy"})
    assert {:error, :ship_destroyed} =
      GreenStarbaseDocking.ready?(%{resting | status: :destroyed})
  end

  test "parking never grants a repair, preserves ship identity and safe launch exits hull" do
    before = ship(at(0, 0, -8))
    parked = GreenStarbaseDocking.park(%{before | hull: 82})
    assert parked.docked
    assert parked.hull == 82
    assert parked.id == before.id
    assert parked.velocity == %{x: 0.0, y: 0.0, z: 0.0}
    launch = GreenStarbaseDocking.launch_position()
    refute GreenStarbaseSafety.inside?(launch)
    assert launch.y < GreenStarbase.bay_mouth().y
    # Nose points away from the station (north, -Y).
    nose = Orientation.forward(Orientation.from_angles(GreenStarbaseDocking.launch_attitude()))
    assert nose.y < -0.99
  end

  test "full throttle straight after launch flies clear without touching the hull" do
    map = %MapDefinition{id: "sol:free_13", name: "SOL Deep Space",
      width: 24_000, height: 24_000, altitude_min: -12_000, altitude_max: 12_000,
      spawn: %Position{x: 12_000.0, y: 12_000.0, z: 0.0}}
    attitude = GreenStarbaseDocking.launch_attitude()
    launched = %{ship(GreenStarbaseDocking.launch_position()) |
      attitude: attitude, orientation: Orientation.from_angles(attitude)}
    {:ok, ship} = FlightDynamics.controls(launched, %{"throttle" => 1.0}, 0)

    final =
      Enum.reduce(1..100, ship, fn tick, current ->
        moved = FlightDynamics.step(current, map, 0.1, tick)
        # Regression: the old yaw-pi launch hit :hangar_rear_wall at ~4 s.
        assert :clear == GreenStarbaseSafety.first_contact(current.position, moved.position)
        moved
      end)

    assert final.cruise_speed > 300.0
    assert final.position.y < GreenStarbaseDocking.launch_position().y - 2_000.0
    assert GreenStarbaseSafety.warning(final.position, true) == nil or
      GreenStarbaseSafety.warning(final.position, true).level != :critical
  end
end
