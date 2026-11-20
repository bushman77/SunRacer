defmodule Core.Universe.SpaceEnvironmentTest do
  use ExUnit.Case, async: true

  alias Core.Universe.{Sol, SpaceEnvironment}

  test "open space is sparse and environmental data is visual-only" do
    {:ok, mars} = Sol.game_position_km("mars")
    area = SpaceEnvironment.at(%{mars | z: 5_000_000.0})
    assert area.kind == "open_space"
    assert area.intensity < 0.05
    assert area.visual_only
    assert Enum.all?(SpaceEnvironment.catalog(), & &1.visual_only)
  end

  test "Earth's orbital debris does not spread through interplanetary space" do
    {:ok, earth} = Sol.game_position_km("earth")
    nearby = SpaceEnvironment.at(earth)
    assert nearby.region_id == "sol:orbital_debris:earth"
    assert nearby.kind == "orbital_debris"
    assert nearby.intensity > 0.5
    assert SpaceEnvironment.at(%{earth | z: 900_000.0}).kind == "open_space"
  end

  test "asteroid belt is a bounded 3D band between Mars and Jupiter" do
    [belt | _] = SpaceEnvironment.catalog()
    middle = (belt.inner_radius_km + belt.outer_radius_km) / 2
    central = SpaceEnvironment.at(%{x: middle, y: 0.0, z: 0.0})
    assert central.kind == "asteroid_belt"
    assert central.intensity == 1.0
    assert SpaceEnvironment.at(%{x: middle, y: 0.0,
      z: belt.half_thickness_km + 1}).kind == "open_space"
    assert SpaceEnvironment.at(%{x: belt.inner_radius_km - 1,
      y: 0.0, z: 0.0}).kind == "open_space"
    near_edge = SpaceEnvironment.at(%{
      x: belt.inner_radius_km + 10_000.0, y: 0.0, z: 0.0
    })
    assert near_edge.kind == "asteroid_belt"
    assert near_edge.intensity < central.intensity
  end

  test "fixed fictional storm takes precedence over surrounding belt" do
    [_belt, storm, _debris] = SpaceEnvironment.catalog()
    assert SpaceEnvironment.at(storm.center_km).kind == "ion_storm"
    assert SpaceEnvironment.at(storm.center_km).intensity == 1.0
    assert SpaceEnvironment.at(%{storm.center_km |
      z: storm.radius_km + 1}).kind == "open_space"
  end

  test "malformed locations do not create hazards or crash classification" do
    for position <- [nil, %{}, %{x: 1.0, y: 2.0},
      %{x: :infinity, y: 0, z: 0}, %{x: 1.0e11, y: 0, z: 0}] do
      assert SpaceEnvironment.at(position).kind == "open_space"
    end
  end
end
