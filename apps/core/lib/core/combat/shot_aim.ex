defmodule Core.Combat.ShotAim do
  @moduledoc """
  Validate client-observed aim for a manual laser shot. The pilot's current
  aim is used when physically plausible for the server's most recent tick;
  never trust client hit claims, positions, or damage.

  A short, capped tick window permits ordinary network delay, but is not a
  full historical input-replay proof. A later lag-compensation system should
  reconstruct validated input history for narrower anti-cheat limits.
  """

  @max_snapshot_age_ms 600
  @max_aim_offset_deg 55.0
  @max_yaw_deg_per_second 150.0
  @base_tolerance_deg 4.0

  def resolve(authoritative, request, server_tick, tick_ms)
      when is_map(authoritative) and is_map(request) do
    if Map.has_key?(request, "aim_orientation") do
      validate(authoritative, Map.get(request, "aim_orientation"),
        Map.get(request, "client_tick"), server_tick, tick_ms)
    else
      {:ok, authoritative}
    end
  end
  def resolve(_authoritative, _request, _tick, _tick_ms),
    do: {:error, :invalid_shot_aim}

  defp validate(server, client, client_tick, server_tick, tick_ms)
      when is_map(client) and is_integer(client_tick) and
           is_integer(server_tick) and is_integer(tick_ms) and tick_ms > 0 do
    age_ticks = server_tick - client_tick

    with true <- client_tick >= 0 and age_ticks >= 0 and
                   age_ticks * tick_ms <= @max_snapshot_age_ms,
         {:ok, claimed} <- normalized(client),
         {:ok, server_q} <- normalized(server),
         allowed = min(@max_aim_offset_deg,
           @base_tolerance_deg + @max_yaw_deg_per_second *
             min(350, (age_ticks + 1) * tick_ms) / 1_000),
         true <- deviation_degrees(server_q, claimed) <= allowed do
      {:ok, claimed}
    else
      _ -> {:error, :invalid_shot_aim}
    end
  end
  defp validate(_server, _client, _client_tick, _server_tick, _tick_ms),
    do: {:error, :invalid_shot_aim}

  defp normalized(q) when is_map(q) do
    values = Enum.map(~w(x y z w), &Map.get(q, &1))
    if Enum.all?(values, &finite_number?/1) do
      [x, y, z, w] = Enum.map(values, &(&1 * 1.0))
      length = :math.sqrt(x * x + y * y + z * z + w * w)
      if length >= 0.99 and length <= 1.01 do
        {:ok, %{x: x / length, y: y / length, z: z / length, w: w / length}}
      else
        {:error, :invalid_shot_aim}
      end
    else
      {:error, :invalid_shot_aim}
    end
  end
  defp normalized(_), do: {:error, :invalid_shot_aim}

  defp finite_number?(v) when is_integer(v), do: abs(v) <= 1_000_000_000
  defp finite_number?(v) when is_float(v),
    do: v == v and abs(v) <= 1_000_000_000
  defp finite_number?(_), do: false

  defp deviation_degrees(a, b) do
    dot = abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)
    2.0 * :math.acos(min(1.0, max(0.0, dot))) * 180.0 / :math.pi()
  end
end
