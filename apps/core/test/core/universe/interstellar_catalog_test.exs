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
