defmodule Core.Universe.SpaceEnvironment do
  @moduledoc """
  Read-only environmental regions in compressed SOL game-kilometres.

  These fixed, provisional zones describe cockpit scenery and Atlas warnings,
  not combat obstacles, mining resources, or damage. A strategic SOL position
  selects the region; local tactical XYZ must never be used for classification.
  """

  alias Core.Universe.Sol

  @belt_inner_au 2.1
  @belt_outer_au 3.4
  @belt_half_thickness_km 2_400_000.0
  @storm_au 2.75
  @storm_phase_radians 305.0 * :math.pi() / 180.0
  @storm_radius_km 1_350_000.0
  @earth_debris_radius_km 520_000.0

  @doc "Stable, public geometry for read-only Atlas overlays."
  def catalog do
    {:ok, earth} = Sol.game_position_km("earth")
    radius = Sol.game_radius_km(@storm_au)

    [
      %{
        id: "sol:asteroid_belt", kind: "asteroid_belt",
        inner_radius_km: Sol.game_radius_km(@belt_inner_au),
        outer_radius_km: Sol.game_radius_km(@belt_outer_au),
        half_thickness_km: @belt_half_thickness_km,
        visual_only: true
      },
      %{
        id: "sol:ion_storm:alpha", kind: "ion_storm",
        center_km: %{
          x: radius * :math.cos(@storm_phase_radians),
          y: radius * :math.sin(@storm_phase_radians),
          z: 0.0
        },
        radius_km: @storm_radius_km, visual_only: true
      },
      %{
        id: "sol:orbital_debris:earth", kind: "orbital_debris",
        center_km: earth, radius_km: @earth_debris_radius_km,
        visual_only: true
      }
    ]
  end

  @doc """
  Select one dominant region for the authoritative ship position.
  Intensity ramps towards belt/storm interiors without changing physics.
  """
  def at(%{x: x, y: y, z: z} = position)
      when is_number(x) and is_number(y) and is_number(z) do
    if Enum.all?([x, y, z], &finite?/1) do
      [belt, storm, debris] = catalog()
      radius = :math.sqrt(x * x + y * y)
      storm_distance = distance(position, storm.center_km)
      debris_distance = distance(position, debris.center_km)

      cond do
        storm_distance < storm.radius_km ->
          profile(storm, 1.0 - storm_distance / storm.radius_km)

        radius >= belt.inner_radius_km and radius <= belt.outer_radius_km and
            abs(z) <= belt.half_thickness_km ->
          edge = min(radius - belt.inner_radius_km,
            belt.outer_radius_km - radius)
          altitude_edge = belt.half_thickness_km - abs(z)
          profile(belt, min(1.0, min(edge / 850_000.0,
            altitude_edge / 550_000.0)))

        debris_distance < debris.radius_km ->
          profile(debris, 0.55 * (1.0 - debris_distance / debris.radius_km))

        true ->
          open_space()
      end
    else
      open_space()
    end
  end

  def at(_), do: open_space()

  defp profile(region, intensity) do
    %{region_id: region.id, kind: region.kind,
      intensity: max(0.0, min(1.0, intensity)), visual_only: true}
  end

  defp open_space do
    %{region_id: "sol:open_space", kind: "open_space",
      intensity: 0.025, visual_only: true}
  end

  defp distance(a, b) do
    :math.sqrt(:math.pow(a.x - b.x, 2) +
      :math.pow(a.y - b.y, 2) + :math.pow(a.z - b.z, 2))
  end

  defp finite?(number), do: number == number and abs(number) < 1.0e10
end
