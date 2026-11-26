defmodule Core.Universe.StarSystems do
  @moduledoc """
  Server-owned interstellar catalogue foundation.

  Each system has an independent compressed game-km frame. SOL delegates to
  its existing catalogue so neither its coordinates nor the campaign change.
  The two expansion systems are provisional development content, not unlocked
  live destinations. No astronomical or tactical coordinates are mixed here.
  """

  alias Core.Universe.Sol

  @systems [
    %{id: "sol", name: "SOL", campaign: :first_run, provisional?: false},
    %{id: "aster_reach", name: "Aster Reach", campaign: :interstellar, provisional?: true},
    %{id: "nacre", name: "Nacre", campaign: :interstellar, provisional?: true}
  ]

  @expansion_bodies %{
    "aster_reach" => [
      %{id: "aster", name: "Aster", kind: :star, au: 0.0, radius_km: nil, phase_deg: 0},
      %{id: "haven", name: "Haven", kind: :planet, au: 0.95, radius_km: 5900.0, phase_deg: 65},
      %{id: "cinder", name: "Cinder", kind: :planet, au: 1.8, radius_km: 4100.0, phase_deg: 220}
    ],
    "nacre" => [
      %{id: "nacre_star", name: "Nacre", kind: :star, au: 0.0, radius_km: nil, phase_deg: 0},
      %{id: "opal", name: "Opal", kind: :planet, au: 1.2, radius_km: 7100.0, phase_deg: 110},
      %{id: "shoal", name: "Shoal", kind: :planet, au: 4.1, radius_km: 26000.0, phase_deg: 290}
    ]
  }

  def all, do: @systems

  def fetch(id) when is_binary(id) do
    case Enum.find(@systems, &(&1.id == id)) do
      nil -> :error
      system -> {:ok, system}
    end
  end

  def fetch(_), do: :error

  def bodies("sol"), do: {:ok, Sol.all()}
  def bodies(system_id), do: Map.fetch(@expansion_bodies, system_id)

  def body("sol", body_id), do: Sol.fetch(body_id)

  def body(system_id, body_id) do
    with {:ok, bodies} <- bodies(system_id),
         %{} = body <- Enum.find(bodies, &(&1.id == body_id)) do
      {:ok, body}
    else
      _ -> :error
    end
  end

  def game_position_km("sol", body_id), do: Sol.game_position_km(body_id)

  def game_position_km(system_id, body_id) do
    with {:ok, body} <- body(system_id, body_id) do
      radius = Sol.game_radius_km(body.au)
      phase = body.phase_deg * :math.pi() / 180.0
      {:ok, %{x: radius * :math.cos(phase), y: radius * :math.sin(phase), z: 0.0}}
    end
  end
end
