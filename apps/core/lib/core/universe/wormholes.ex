defmodule Core.Universe.Wormholes do
  @moduledoc """
  Paired wormhole mouths in system-local game-km coordinates.

  Pure topology only: resolving a paired mouth is not permission to jump.
  Live transit must separately enforce campaign unlocks, proximity, ship
  state and successful physical tunnel traversal before moving the pilot.
  Coordinates and expansion names are provisional development content.
  """

  @links [
    %{
      id: "sol_aster",
      mouths: [
        %{id: "sol_aster_mouth", system_id: "sol",
          position_km: %{x: 80_000_000.0, y: 42_000_000.0, z: 0.0}},
        %{id: "aster_sol_mouth", system_id: "aster_reach",
          position_km: %{x: -36_000_000.0, y: 18_000_000.0, z: 0.0}}
      ]
    },
    %{
      id: "aster_nacre",
      mouths: [
        %{id: "aster_nacre_mouth", system_id: "aster_reach",
          position_km: %{x: 45_000_000.0, y: -25_000_000.0, z: 0.0}},
        %{id: "nacre_aster_mouth", system_id: "nacre",
          position_km: %{x: 25_000_000.0, y: -42_000_000.0, z: 0.0}}
      ]
    }
  ]

  def all, do: @links

  def mouths(system_id) do
    @links
    |> Enum.flat_map(& &1.mouths)
    |> Enum.filter(&(&1.system_id == system_id))
  end

  @doc "Resolve a known mouth only within its owning system."
  def paired_mouth(system_id, mouth_id) do
    Enum.find_value(@links, {:error, :unknown_wormhole}, fn %{mouths: [a, b]} ->
      cond do
        a.system_id == system_id and a.id == mouth_id -> {:ok, b}
        b.system_id == system_id and b.id == mouth_id -> {:ok, a}
        true -> nil
      end
    end)
  end
end
