defmodule Core.Universe.StarSystems do
  @moduledoc """
  Read-only stellar catalogue. SOL is the only playable system.
  Atlas coordinates are schematic game display positions, never physical
  galactic coordinates or valid navigation destinations. Distance estimates
  from SOL are in light years; local strategic coordinates remain game km.
  Alpha Centauri includes Proxima; companions are not separate systems.
  Expansion planets are intentionally not defined.
  """
  alias Core.Universe.Sol

  @systems [
    %{id: "sol", name: "SOL", distance_from_sol_ly: 0, atlas_x: 425, atlas_y: 412, campaign: :first_run, provisional?: false},
    %{id: "alpha_centauri", name: "Alpha Centauri", distance_from_sol_ly: 4.37, atlas_x: 610, atlas_y: 475, campaign: :interstellar, provisional?: true},
    %{id: "barnard", name: "Barnard's Star", distance_from_sol_ly: 5.96, atlas_x: 220, atlas_y: 505, campaign: :interstellar, provisional?: true},
    %{id: "sirius", name: "Sirius", distance_from_sol_ly: 8.6, atlas_x: 785, atlas_y: 390, campaign: :interstellar, provisional?: true},
    %{id: "epsilon_eridani", name: "Epsilon Eridani", distance_from_sol_ly: 10.5, atlas_x: 490, atlas_y: 470, campaign: :interstellar, provisional?: true},
    %{id: "tau_ceti", name: "Tau Ceti", distance_from_sol_ly: 11.9, atlas_x: 340, atlas_y: 468, campaign: :interstellar, provisional?: true},
    %{id: "procyon", name: "Procyon", distance_from_sol_ly: 11.46, atlas_x: 325, atlas_y: 302, campaign: :interstellar, provisional?: true},
    %{id: "luyten_726_8", name: "Luyten 726-8", distance_from_sol_ly: 8.73, atlas_x: 192, atlas_y: 441, campaign: :interstellar, provisional?: true},
    %{id: "wolf_359", name: "Wolf 359", distance_from_sol_ly: 7.86, atlas_x: 465, atlas_y: 143, campaign: :interstellar, provisional?: true},
    %{id: "lalande_21185", name: "Lalande 21185", distance_from_sol_ly: 8.31, atlas_x: 225, atlas_y: 175, campaign: :interstellar, provisional?: true},
    %{id: "ross_154", name: "Ross 154", distance_from_sol_ly: 9.69, atlas_x: 145, atlas_y: 386, campaign: :interstellar, provisional?: true},
    %{id: "ross_128", name: "Ross 128", distance_from_sol_ly: 11.01, atlas_x: 715, atlas_y: 220, campaign: :interstellar, provisional?: true},
    %{id: "61_cygni", name: "61 Cygni", distance_from_sol_ly: 11.4, atlas_x: 650, atlas_y: 95, campaign: :interstellar, provisional?: true},
    %{id: "vega", name: "Vega", distance_from_sol_ly: 25, atlas_x: 558, atlas_y: 99, campaign: :interstellar, provisional?: true},
    %{id: "altair", name: "Altair", distance_from_sol_ly: 16.73, atlas_x: 640, atlas_y: 150, campaign: :interstellar, provisional?: true},
    %{id: "fomalhaut", name: "Fomalhaut", distance_from_sol_ly: 25.1, atlas_x: 770, atlas_y: 477, campaign: :interstellar, provisional?: true},
    %{id: "capella", name: "Capella", distance_from_sol_ly: nil, atlas_x: 147, atlas_y: 266, campaign: :interstellar, provisional?: true},
    %{id: "arcturus", name: "Arcturus", distance_from_sol_ly: nil, atlas_x: 375, atlas_y: 210, campaign: :interstellar, provisional?: true},
    %{id: "aldebaran", name: "Aldebaran", distance_from_sol_ly: nil, atlas_x: 817, atlas_y: 236, campaign: :interstellar, provisional?: true},
    %{id: "polaris", name: "Polaris", distance_from_sol_ly: nil, atlas_x: 105, atlas_y: 329, campaign: :interstellar, provisional?: true},
    %{id: "betelgeuse", name: "Betelgeuse", distance_from_sol_ly: nil, atlas_x: 222, atlas_y: 324, campaign: :interstellar, provisional?: true},
    %{id: "rigel", name: "Rigel", distance_from_sol_ly: nil, atlas_x: 255, atlas_y: 372, campaign: :interstellar, provisional?: true},
    %{id: "deneb", name: "Deneb", distance_from_sol_ly: nil, atlas_x: 342, atlas_y: 108, campaign: :interstellar, provisional?: true},
    %{id: "antares", name: "Antares", distance_from_sol_ly: nil, atlas_x: 617, atlas_y: 270, campaign: :interstellar, provisional?: true},
    %{id: "spica", name: "Spica", distance_from_sol_ly: nil, atlas_x: 701, atlas_y: 305, campaign: :interstellar, provisional?: true},
    %{id: "regulus", name: "Regulus", distance_from_sol_ly: nil, atlas_x: 748, atlas_y: 350, campaign: :interstellar, provisional?: true},
    %{id: "pollux", name: "Pollux", distance_from_sol_ly: nil, atlas_x: 860, atlas_y: 319, campaign: :interstellar, provisional?: true},
    %{id: "canopus", name: "Canopus", distance_from_sol_ly: nil, atlas_x: 865, atlas_y: 433, campaign: :interstellar, provisional?: true},
    %{id: "mirfak", name: "Mirfak", distance_from_sol_ly: nil, atlas_x: 180, atlas_y: 221, campaign: :interstellar, provisional?: true}
  ]

  def all, do: @systems

  def fetch(id) when is_binary(id) do
    case Enum.find(@systems, &(&1.id == id)) do
      nil -> :error
      system -> {:ok, system}
    end
  end
  def fetch(_), do: :error

  def bodies("sol"), do: {:ok, Sol.all()}
  def bodies(system_id) do
    case fetch(system_id) do
      {:ok, _} -> {:ok, []}
      :error -> :error
    end
  end

  def body("sol", body_id), do: Sol.fetch(body_id)
  def body(_, _), do: :error

  def game_position_km("sol", body_id), do: Sol.game_position_km(body_id)
  def game_position_km(_, _), do: :error
end
