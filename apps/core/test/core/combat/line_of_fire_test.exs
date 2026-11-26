defmodule Core.Combat.LineOfFireTest do
  use ExUnit.Case, async: true

  alias Core.Combat.LineOfFire
  alias Core.World.FlightDynamics
  alias Core.World.Orientation
  alias Core.World.Position

  @origin %Position{x: 1_000.0, y: 1_000.0, z: 0.0}
  # Pilot eye (cockpit camera) height in world units: 2.75 scene / 0.06.
  # The central sight lies on the nose ray from this eye.
  @eye_z 2.75 / 0.06
  defp npc(id, x, y, z \\ 0.0) do
    %{id: id, position: %Position{x: x, y: y, z: z},
      kind: :npc, status: :alive, hull: 100}
  end

  test "two real wing-mounted rays hit an enemy under the central sight" do
    enemy = npc("ahead", 1_000.0, 700.0, @eye_z)
    beams = LineOfFire.trace_pair(
      @origin, Orientation.identity(), [enemy], 720.0
    )

    assert length(beams) == 2
    assert Enum.map(beams, & &1.side) == [:left, :right]
    assert Enum.all?(beams, & &1.hit)
    assert Enum.all?(beams, &(&1.target_id == "ahead"))
    [left, right] = beams
    assert left.from.x < @origin.x
    assert right.from.x > @origin.x
    assert_in_delta left.from.y, right.from.y, 1.0e-8
    assert_in_delta left.from.z, right.from.z, 1.0e-8
    # Both beams converge on the point under the sight (front surface).
    assert left.to.y > enemy.position.y
    assert right.to.y > enemy.position.y
    assert_in_delta left.to.x, enemy.position.x, 1.0e-6
    assert_in_delta right.to.x, enemy.position.x, 1.0e-6
    assert_in_delta left.to.z, enemy.position.z, 1.0e-6
  end

  test "the hit zone is centred on the sight, not below it" do
    # Regression: parallel beams 24 units below the eye missed a target
    # only ~4 units above the sight centre. Small aim errors in any
    # direction now still hit with both beams.
    for {dx, dz} <- [{0.0, 4.0}, {0.0, 20.0}, {0.0, -20.0}, {20.0, 0.0}, {-20.0, 0.0},
                     {25.0, 25.0}] do
      enemy = npc("aim", 1_000.0 + dx, 600.0, @eye_z + dz)
      beams = LineOfFire.trace_pair(@origin, Orientation.identity(), [enemy], 720.0)
      assert Enum.all?(beams, & &1.hit), "missed at offset #{inspect({dx, dz})}"
    end

    # Well outside the sight it still misses.
    wide = npc("wide", 1_000.0, 600.0, @eye_z + 60.0)
    refute Enum.any?(LineOfFire.trace_pair(@origin, Orientation.identity(), [wide], 720.0),
             & &1.hit)
  end

  test "eye position matches the cockpit camera and rotates with the ship" do
    assert_in_delta LineOfFire.eye_position(@origin, Orientation.identity()).z,
                    @eye_z, 1.0e-9
    rolled = Orientation.from_angles(%{yaw: 0.0, pitch: 0.0, roll: :math.pi() / 2})
    eye = LineOfFire.eye_position(@origin, rolled)
    assert_in_delta eye.z, 0.0, 1.0e-6
    assert_in_delta abs(eye.x - @origin.x), @eye_z, 1.0e-6
  end

  test "the actual player weapon reaches beyond the old range and stops at the new cap" do
    range = Core.Combat.player_attack_range()
    enemy = npc("extended", 1_000.0, 0.0, @eye_z)
    beams = LineOfFire.trace_pair(@origin, Orientation.identity(), [enemy], range)
    assert Enum.all?(beams, & &1.hit)
    beyond = npc("beyond", 1_000.0, -100.0, @eye_z)
    refute Enum.any?(LineOfFire.trace_pair(@origin, Orientation.identity(), [beyond], range), & &1.hit)
  end

  test "a distant centered ship can be struck at 3,200 world units" do
    enemy = npc("distant", 1_000.0, 4_200.0, @eye_z)
    facing_south = Orientation.from_angles(%{yaw: :math.pi(), pitch: 0.0, roll: 0.0})

    beams = LineOfFire.trace_pair(@origin, facing_south, [enemy], 3_600.0)
    assert Enum.map(beams, & &1.side) == [:left, :right]
    assert Enum.all?(beams, & &1.hit)
    assert Enum.all?(beams, &(&1.target_id == "distant"))
    assert Enum.all?(beams, &(&1.to.y < enemy.position.y))
  end

  test "ships outside the extended range are not damaged" do
    enemy = npc("beyond", 1_000.0, 4_800.0)
    facing_south = Orientation.from_angles(%{yaw: :math.pi(), pitch: 0.0, roll: 0.0})
    beams = LineOfFire.trace_pair(@origin, facing_south, [enemy], 3_600.0)

    assert length(beams) == 2
    refute Enum.any?(beams, & &1.hit)
    assert Enum.all?(beams, &(is_nil(&1.target_id)))
    assert Enum.all?(beams, &(&1.to.y < enemy.position.y))
  end

  test "a ship between one wing and the aim point takes that wing's hit" do
    main = npc("main", 1_000.0, 500.0, @eye_z)
    # Sits on the left muzzle's path to the aim point, clear of the right one.
    blocker = npc("blocker", 962.0, 905.0, 15.0)
    [left, right] =
      LineOfFire.trace_pair(@origin, Orientation.identity(), [main, blocker], 720.0)

    assert left.hit and right.hit
    assert left.target_id == "blocker"
    assert right.target_id == "main"
  end

  test "two distinct red rays miss targets behind or outside range" do
    enemies = [npc("behind", 1_000.0, 1_200.0),
               npc("far", 1_000.0, 100.0),
               npc("side", 1_300.0, 760.0)]
    shots = LineOfFire.trace_pair(@origin, Orientation.identity(), enemies, 720.0)
    assert length(shots) == 2
    assert Enum.all?(shots, &(not &1.hit))
    assert Enum.all?(shots, &(is_nil(&1.target_id)))
    assert Enum.all?(shots, &(&1.to.y < &1.from.y))
  end

  test "gun mounts and their rays rotate with the ship through yaw and roll" do
    east = Orientation.from_angles(%{yaw: :math.pi() / 2, pitch: 0.0, roll: 0.0})
    target = npc("east", 1_350.0, 1_000.0, @eye_z)
    east_beams = LineOfFire.trace_pair(@origin, east, [target], 720.0)
    assert Enum.all?(east_beams, & &1.hit)
    assert Enum.all?(east_beams, &(&1.to.x > &1.from.x))

    rolled = Orientation.from_angles(%{yaw: 0.0, pitch: 0.0, roll: :math.pi() / 2})
    [left, right] = LineOfFire.wing_muzzles(@origin, rolled)
    # After a 90-degree bank the two symmetric wing tips are separated in Z.
    assert abs(left.from.z - right.from.z) > 50
    assert_in_delta left.from.x, right.from.x, 1.0e-8
  end

  test "fires down the current nose with no selected target" do
    east = FlightDynamics.forward(%{yaw: :math.pi() / 2, pitch: 0.0})
    enemy = npc("east", 1_250.0, 1_000.0)
    assert {:hit, ^enemy, point} = LineOfFire.trace(@origin, east, [enemy], 720.0)
    assert point.x > @origin.x
    assert_in_delta point.y, @origin.y, 1.0e-7
  end

  test "ray behind, sideways or out of range misses" do
    north = FlightDynamics.forward(%{yaw: 0.0, pitch: 0.0})
    enemies = [npc("back", 1_000.0, 1_250.0),
               npc("side", 1_090.0, 800.0),
               npc("far", 1_000.0, 200.0)]
    assert {:miss, endpoint} = LineOfFire.trace(@origin, north, enemies, 720.0)
    assert_in_delta endpoint.y, 280.0, 1.0e-8
    assert_in_delta endpoint.x, 1_000.0, 1.0e-8
  end

  test "nearest living ship in beam wins even if a more distant target is locked" do
    north = FlightDynamics.forward(%{yaw: 0.0, pitch: 0.0})
    far = npc("far", 1_000.0, 500.0)
    near = npc("near", 1_000.0, 830.0)
    dead = %{npc("destroyed", 1_000.0, 910.0) | hull: 0, status: :destroyed}
    assert {:hit, ^near, point} =
      LineOfFire.trace(@origin, north, [far, dead, near], 720.0)
    assert_in_delta point.y, 870.0, 1.0e-8
  end

  test "3D pitch determines hit height independently of roll" do
    angle = :math.pi() / 4
    forward = FlightDynamics.forward(%{yaw: 0.0, pitch: angle, roll: 1.4})
    enemy = npc("up", 1_000.0, 800.0, 200.0)
    assert {:hit, ^enemy, impact} =
      LineOfFire.trace(@origin, forward, [enemy], 720.0)
    assert impact.z > 100.0

    horizontal = FlightDynamics.forward(%{yaw: 0.0, pitch: 0.0, roll: 1.4})
    assert {:miss, _} = LineOfFire.trace(@origin, horizontal, [enemy], 720.0)
  end
end
