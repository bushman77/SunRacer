defmodule Core.Universe.Wormholes do
  @moduledoc """
  Paired wormhole mouths in system-local game-km coordinates.

  Pure topology only: resolving a paired mouth is not permission to jump.
  Live transit must separately enforce campaign unlocks, proximity, ship
  state and successful physical tunnel traversal before moving the pilot.
  Mouth coordinates and links are fictional, provisional development content.
  """

  @links [
    %{
      id: "sol_alpha",
      mouths: [
        %{id: "sol_alpha_mouth", system_id: "sol",
          position_km: %{x: 84_000_000.0, y: 35_000_000.0, z: 0.0}},
        %{id: "alpha_sol_mouth", system_id: "alpha_centauri",
          position_km: %{x: -36_000_000.0, y: 18_000_000.0, z: 0.0}}
      ]
    },
    %{
      id: "alpha_barnard",
      mouths: [
        %{id: "alpha_barnard_mouth", system_id: "alpha_centauri",
          position_km: %{x: 45_000_000.0, y: -25_000_000.0, z: 0.0}},
        %{id: "barnard_alpha_mouth", system_id: "barnard",
          position_km: %{x: 25_000_000.0, y: -42_000_000.0, z: 0.0}}
      ]
    }
  ]

  def all, do: @links

  @doc "All planned campaign edges, including those without physical mouths yet."
  def campaign_links, do: Core.Universe.StarSystems.campaign_links()

  def mouths(system_id) do
    @links
    |> Enum.flat_map(& &1.mouths)
    |> Enum.filter(&(&1.system_id == system_id))
  end

  @doc "Charted approach sites, not authorization for interstellar transit."
  def charted_mouths(system_id) do
    Enum.map(mouths(system_id), fn mouth ->
      {:ok, paired} = paired_mouth(system_id, mouth.id)
      {:ok, destination} = Core.Universe.StarSystems.fetch(paired.system_id)
      Map.merge(mouth, %{destination_system_id: paired.system_id,
        name: destination.name <> " Wormhole", transit_available: false})
    end)
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
