defmodule SunracerWeb.AtlasPilotsTest do
  use ExUnit.Case, async: true
  alias SunracerWeb.AtlasPilots

  defp player(id, x, extra \\ %{}), do: Map.merge(%{kind: :player, player_id: id,
    status: :active, position_3d: %{x: x, y: 0, z: 0}}, extra)

  test "only nearby visible live player entities qualify as neutral contacts" do
    map = %{entities: [player(1, 0), player(2, 5000), player(3, 5001),
      player(4, 1, %{kind: :npc}), player(5, 1, %{status: :destroyed}),
      player(6, 1, %{private_to: 9}), player(7, 1, %{position_3d: nil})]}
    assert AtlasPilots.nearby_ids(map, 1) == [2]
    assert AtlasPilots.nearby_ids(map, 99) == []
  end

  test "party takes precedence over guild, unrelated pilots remain neutral" do
    assert AtlasPilots.relation(2, [2], [2,3]) == "party"
    assert AtlasPilots.relation(3, [2], [2,3]) == "guild"
    assert AtlasPilots.relation(4, [2], [2,3]) == "neutral"
  end
end
