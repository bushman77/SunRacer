defmodule Core.Universe.InterstellarCatalogTest do
  use ExUnit.Case, async: true

  alias Core.Universe.{Sol, StarSystems, Wormholes}

  test "SOL keeps its existing bodies and coordinates" do
    assert StarSystems.bodies("sol") == {:ok, Sol.all()}

    for body <- Sol.all() do
      assert StarSystems.game_position_km("sol", body.id) ==
               Sol.game_position_km(body.id)
    end
  end

  test "real expansion systems are charted but have no playable bodies" do
    systems = StarSystems.all()
    assert length(systems) >= 21
    assert length(Enum.uniq_by(systems, & &1.id)) == length(systems)
    assert {:ok, %{name: "Alpha Centauri", provisional?: true}} = StarSystems.fetch("alpha_centauri")
    assert {:ok, []} = StarSystems.bodies("alpha_centauri")
    assert :error = StarSystems.body("alpha_centauri", "haven")
    assert :error = StarSystems.game_position_km("alpha_centauri", "haven")
    assert :error = StarSystems.fetch("unknown")
    assert :error = StarSystems.bodies("unknown")
  end

  test "campaign is one ordered chain from SOL through every charted system" do
    systems = StarSystems.all()
    assert Enum.map(systems, & &1.campaign_phase) == Enum.to_list(1..length(systems))
    assert Enum.take(Enum.map(systems, & &1.id), 6) ==
             ["sol", "alpha_centauri", "barnard", "sirius", "epsilon_eridani", "tau_ceti"]
    links = Wormholes.campaign_links()
    assert length(links) == length(systems) - 1

    for {[from, to], link} <- Enum.zip(Enum.chunk_every(systems, 2, 1, :discard), links) do
      assert link == %{from_system_id: from.id, to_system_id: to.id,
        unlock_after_phase: from.campaign_phase}
    end

    for %{mouths: [from, to]} <- Wormholes.all() do
      assert Enum.any?(links, &(&1.from_system_id == from.system_id and
        &1.to_system_id == to.system_id))
    end
  end

  test "mouths are unique, connected to known systems and reciprocal" do
    mouths = Enum.flat_map(Wormholes.all(), & &1.mouths)
    ids = Enum.map(mouths, & &1.id)
    assert length(ids) == length(Enum.uniq(ids))

    for mouth <- mouths do
      assert {:ok, _} = StarSystems.fetch(mouth.system_id)
      assert {:ok, other} = Wormholes.paired_mouth(mouth.system_id, mouth.id)
      refute other.system_id == mouth.system_id
      assert {:ok, ^mouth} = Wormholes.paired_mouth(other.system_id, other.id)
    end
  end

  test "Alpha Centauri approach is beyond Pluto in the east-southeast Atlas sector" do
    assert [%{id: "sol_alpha_mouth", position_km: point,
      destination_system_id: "alpha_centauri", transit_available: false,
      name: "Alpha Centauri Wormhole"}] = Wormholes.charted_mouths("sol")
    assert {:ok, ^point} = Sol.waypoint(point)
    assert point.x > 0 and point.y > 0 and point.z == 0
    radius = :math.sqrt(point.x * point.x + point.y * point.y)
    {:ok, pluto} = Sol.fetch("pluto")
    gap = radius - Sol.game_radius_km(pluto.au)
    assert gap > 0 and gap < 10_000_000
    assert_in_delta :math.atan2(point.y, point.x) * 180 / :math.pi(), 22.5, 0.2
  end

  test "a mouth in another system cannot be resolved as a local entry" do
    assert {:error, :unknown_wormhole} =
             Wormholes.paired_mouth("sol", "alpha_sol_mouth")
    assert {:error, :unknown_wormhole} =
             Wormholes.paired_mouth("sol", "invented")
    assert [%{id: "sol_alpha_mouth"}] = Wormholes.mouths("sol")
    assert length(Wormholes.mouths("alpha_centauri")) == 2
    assert Wormholes.mouths("unknown") == []
  end
end
