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

  test "each system owns its own body identities" do
    assert {:ok, %{provisional?: true}} = StarSystems.fetch("aster_reach")
    assert {:ok, %{kind: :planet}} = StarSystems.body("aster_reach", "haven")
    assert :error = StarSystems.body("sol", "haven")
    assert :error = StarSystems.body("nacre", "haven")
    assert :error = StarSystems.fetch("unknown")
    assert {:ok, %{x: x, y: y, z: 0.0}} =
             StarSystems.game_position_km("aster_reach", "haven")
    assert is_float(x) and is_float(y)
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
             Wormholes.paired_mouth("sol", "aster_sol_mouth")
    assert {:error, :unknown_wormhole} =
             Wormholes.paired_mouth("sol", "invented")
    assert [%{id: "sol_aster_mouth"}] = Wormholes.mouths("sol")
    assert length(Wormholes.mouths("aster_reach")) == 2
    assert Wormholes.mouths("unknown") == []
  end
end
