defmodule Core.Combat.LineOfFire do
  @moduledoc """
  Server-owned manual laser ray against living NPC collision spheres.

  Direction comes from the authoritative ship attitude, never a claimed
  client target or ray. A miss remains a shot and consumes weapon cooldown.
  """
  alias Core.Combat
  alias Core.World.Orientation

  # Geometry is in the same scaled units as the 3D cockpit. These are two
  # independent emitters attached to the ship, NOT client-side offsets.
  # A wing lies 1.75 scene units either side of the nose, behind each
  # forward-facing muzzle. Camera local origin is (0, 2.75, 0).
  @scene_scale 0.06
  @muzzle_forward_scene 3.2
  @muzzle_up_scene 1.3
  @wing_half_span_scene 1.75
  @wings [:left, :right]
  # Pilot eye / cockpit camera, ship-local. MUST match the client camera
  # offset in StereoSpaceView.setCamera (Vector3(0, 2.75, 0)). The central
  # sight lies on the ray from this eye along the nose.
  @eye_up_scene 2.75

  # NPC octahedrons are rendered with radius 2 scene units (33 world
  # units); a 40-unit collision sphere allows both wing rays to hit an
  # enemy centered on the crosshair without invisible target snapping.
  @npc_radius 40.0

  @doc "Absolute server-owned XYZ positions for symmetric, rotating gun mounts."
  @spec wing_muzzles(map(), Orientation.t()) :: [map()]
  def wing_muzzles(position, orientation) do
    Enum.map(@wings, fn side ->
      offset = %{
        x: (if side == :left, do: -1.0, else: 1.0) * @wing_half_span_scene,
        y: @muzzle_up_scene,
        z: -@muzzle_forward_scene
      }

      scene = Orientation.rotate(orientation, offset)
      %{
        side: side,
        from: %{
          x: position.x + scene.x / @scene_scale,
          y: position.y + scene.z / @scene_scale,
          z: Map.get(position, :z, 0.0) + scene.y / @scene_scale
        }
      }
    end)
  end

  @doc "Server-owned pilot eye position (the cockpit camera), ship-local."
  @spec eye_position(map(), Orientation.t()) :: map()
  def eye_position(position, orientation) do
    scene = Orientation.rotate(orientation, %{x: 0.0, y: @eye_up_scene, z: 0.0})
    %{
      x: position.x + scene.x / @scene_scale,
      y: position.y + scene.z / @scene_scale,
      z: Map.get(position, :z, 0.0) + scene.y / @scene_scale
    }
  end

  @doc """
  Fire both wing lasers at what lies under the central sight.

  The sight is the ray from the pilot's eye along the nose. The server
  traces that ray against living NPC spheres; both wing beams then converge
  on the impact point (or on the sight line at maximum range on a miss).

  Previously the two beams ran parallel to the nose from the wing muzzles,
  about 24 world units below the eye line. A target centred in the sight
  was hit only by a ~2 unit margin, and drifting ~4 units upward missed
  completely, so aiming felt broken.

  Each wing still traces its own physical segment to the aim point: a ship
  between a muzzle and the aim point takes that wing's hit instead.
  Returns two beams (hit or miss). No lock-on, client ray or client target.
  """
  @spec trace_pair(map(), Orientation.t(), [map()], number()) :: [map()]
  def trace_pair(position, orientation, npcs, max_distance)
      when is_list(npcs) and is_number(max_distance) and max_distance > 0 do
    heading = Orientation.forward(orientation)
    eligible =
      Enum.filter(npcs, fn npc ->
        Combat.alive?(npc) and Map.get(npc, :state) != :surrendered and
          Combat.in_range?(%{position: position}, npc, max_distance)
      end)

    eye = eye_position(position, orientation)
    aim =
      case trace(eye, heading, eligible, max_distance) do
        {:hit, _target, impact} -> impact
        {:miss, endpoint} -> endpoint
      end

    Enum.map(wing_muzzles(position, orientation), fn %{side: side, from: origin} ->
      segment = sub(aim, origin)
      length = :math.sqrt(dot(segment, segment))

      if length <= 1.0e-9 do
        %{side: side, from: origin, to: aim, target: nil, target_id: nil, hit: false}
      else
        direction = scale(segment, 1.0 / length)
        # Small tolerance so the wing reaches the sphere surface it aims at.
        case trace_segment(origin, direction, eligible, length + 1.0e-6) do
          {:hit, target, impact} ->
            %{side: side, from: origin, to: impact, target: target,
              target_id: target.id, hit: true}

          {:miss, _endpoint} ->
            %{side: side, from: origin, to: aim, target: nil,
              target_id: nil, hit: false}
        end
      end
    end)
  end

  @doc "Server-approved pair of lock-on beams, drawn towards one actual NPC."
  def locked_pair(position, orientation, npc_position) do
    to = %{x: npc_position.x, y: npc_position.y,
           z: Map.get(npc_position, :z, 0.0)}
    Enum.map(wing_muzzles(position, orientation), fn %{side: side, from: origin} ->
      %{side: side, from: origin, to: to, hit: true}
    end)
  end

  @spec trace(map(), map(), [map()], number()) ::
          {:hit, map(), map()} | {:miss, map()}
  def trace(origin, direction, npcs, max_distance)
      when is_list(npcs) and is_number(max_distance) and max_distance > 0 do
    hit =
      npcs
      |> Enum.filter(&Combat.alive?/1)
      |> Enum.flat_map(fn npc ->
        case ray_sphere(origin, direction, npc.position, @npc_radius, max_distance) do
          nil -> []
          distance -> [{distance, to_string(npc.id), npc}]
        end
      end)
      |> Enum.sort_by(fn {distance, id, _npc} -> {distance, id} end)
      |> List.first()

    case hit do
      {distance, _id, npc} -> {:hit, npc, extend(origin, direction, distance)}
      nil -> {:miss, extend(origin, direction, max_distance)}
    end
  end

  # Wing segment from muzzle to the aim point. Weapon range was already
  # enforced (eligible targets are within range of the ship); here only the
  # entry point must lie on the segment, since the aim point is on a sphere's
  # near surface and that sphere's centre is beyond the segment end.
  defp trace_segment(origin, direction, npcs, length) do
    npcs
    |> Enum.flat_map(fn npc ->
      case segment_sphere(origin, direction, npc.position, @npc_radius, length) do
        nil -> []
        distance -> [{distance, to_string(npc.id), npc}]
      end
    end)
    |> Enum.sort_by(fn {distance, id, _npc} -> {distance, id} end)
    |> List.first()
    |> case do
      {distance, _id, npc} -> {:hit, npc, extend(origin, direction, distance)}
      nil -> {:miss, extend(origin, direction, length)}
    end
  end

  defp segment_sphere(origin, direction, center, radius, length) do
    offset = %{x: center.x - origin.x, y: center.y - origin.y,
               z: Map.get(center, :z, 0.0) - Map.get(origin, :z, 0.0)}
    projection = dot(offset, direction)
    perpendicular_sq = max(0.0, dot(offset, offset) - projection * projection)

    if perpendicular_sq > radius * radius do
      nil
    else
      entry = projection - :math.sqrt(radius * radius - perpendicular_sq)
      cond do
        entry >= 0.0 and entry <= length -> entry
        # Muzzle already inside the sphere (point-blank): it is a hit.
        entry < 0.0 and projection + :math.sqrt(radius * radius - perpendicular_sq) >= 0.0 -> 0.0
        true -> nil
      end
    end
  end

  defp ray_sphere(origin, direction, center, radius, max_distance) do
    offset = %{
      x: center.x - origin.x,
      y: center.y - origin.y,
      z: center.z - origin.z
    }

    projection = dot(offset, direction)
    center_distance_sq = dot(offset, offset)

    # Preserve the weapon's center-to-center range limit, matching the
    # existing Combat.validate_attack/3 contract for actual damage.
    if projection < 0 or center_distance_sq > max_distance * max_distance do
      nil
    else
      perpendicular_sq = max(0.0, center_distance_sq - projection * projection)

      if perpendicular_sq > radius * radius do
        nil
      else
        distance = max(0.0, projection - :math.sqrt(radius * radius - perpendicular_sq))
        if distance <= max_distance, do: distance, else: nil
      end
    end
  end

  defp extend(p, d, distance),
    do: %{x: p.x + d.x * distance, y: p.y + d.y * distance,
          z: p.z + d.z * distance}

  defp dot(a, b), do: a.x * b.x + a.y * b.y + a.z * b.z
  defp sub(a, b), do: %{x: a.x - b.x, y: a.y - b.y, z: Map.get(a, :z, 0.0) - Map.get(b, :z, 0.0)}
  defp scale(v, k), do: %{x: v.x * k, y: v.y * k, z: v.z * k}
end
