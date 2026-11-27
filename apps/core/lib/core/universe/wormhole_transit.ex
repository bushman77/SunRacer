defmodule Core.Universe.WormholeTransit do
  @moduledoc """
  Deterministic, isolated SOL–Alpha Centauri tunnel flight model.

  Distances are local tunnel units, not astronomical km. Only the server
  advances time and owns position, hull, shields and terminal outcomes.
  This model does not authorize travel or change a persisted pilot location.
  """
  @length 9_600.0
  @speed 240.0
  @lateral_speed 240.0
  @step_ms 100
  @wall_hp_per_second 12
  @input_timeout_ms 500

  def length, do: @length
  def step_ms, do: @step_ms

  def new(hull \\ 300, shields \\ 120)
      when is_integer(hull) and hull > 0 and is_integer(shields) and shields >= 0 do
    %{origin: "sol", destination: "alpha_centauri", status: :in_transit,
      elapsed_ms: 0, distance: 0.0, x: 0.0, y: 0.0, roll: 0.0, speed: 0.0,
      hull: hull, max_hull: hull, shields: shields, max_shields: shields,
      exposure_damage: 0, wall_ms: 0, wall_contact: false,
      input: %{yaw: 0.0, pitch: 0.0, roll: 0.0, throttle: 0.0}, input_at_ms: 0}
  end

  @doc "Server-owned center and radius at a longitudinal position."
  def section(distance) when is_number(distance) do
    p = clamp(distance / @length, 0.0, 1.0)
    %{distance: distance,
      x: 460.0 * :math.sin(2.0 * :math.pi() * p) * :math.sin(:math.pi() * p),
      y: 310.0 * :math.sin(4.0 * :math.pi() * p) * :math.sin(:math.pi() * p),
      radius: 460.0 - 110.0 * :math.pow(:math.sin(3.0 * :math.pi() * p), 2)}
  end

  def geometry do
    for i <- 0..96, do: section(@length * i / 96)
  end

  @doc "Accept signed control intentions only; ignore all client state claims."
  def controls(%{status: :in_transit} = state, input) when is_map(input) do
    axes = Map.new([:yaw, :pitch, :roll, :throttle], fn axis ->
      value = Map.get(input, Atom.to_string(axis), Map.get(input, axis, 0))
      {axis, axis_value(value)}
    end)
    %{state | input: axes, input_at_ms: state.elapsed_ms}
  end
  def controls(state, _input), do: state

  @doc """
  Cumulative hull-only exposure, in whole HP. The incremental charge is the
  difference of the cumulative values, avoiding per-tick rounding exploits.
  D(t) = floor(t + 0.025*t^2), with t in seconds.
  """
  def exposure_damage(ms) when is_integer(ms) and ms >= 0,
    do: div(ms * 40_000 + ms * ms, 40_000_000)

  @doc "One fixed server simulation step; terminal states never advance."
  def tick(%{status: :in_transit} = state) do
    elapsed = state.elapsed_ms + @step_ms
    dt = @step_ms / 1_000
    fresh? = elapsed - state.input_at_ms <= @input_timeout_ms
    # Forward throttle persists like ordinary cruise; stale turn axes neutralize.
    input = if fresh?, do: state.input, else: %{state.input | yaw: 0.0, pitch: 0.0, roll: 0.0}
    speed = @speed * max(0.0, input.throttle)
    distance = min(@length, state.distance + speed * dt)
    x = state.x + (input.yaw * @lateral_speed + 18.0 * :math.sin(elapsed / 1700.0)) * dt
    y = state.y + (input.pitch * @lateral_speed + 12.0 * :math.cos(elapsed / 2300.0)) * dt
    wall = section(distance)
    dx = x - wall.x
    dy = y - wall.y
    offset = :math.sqrt(dx * dx + dy * dy)
    contact = offset >= wall.radius * 0.96
    scale = if contact and offset > 0, do: wall.radius * 0.96 / offset, else: 1.0
    wall_ms = state.wall_ms + if(contact, do: @step_ms, else: 0)
    exposure = exposure_damage(elapsed)
    damage = exposure - state.exposure_damage +
      div(wall_ms * @wall_hp_per_second, 1_000) -
      div(state.wall_ms * @wall_hp_per_second, 1_000)
    hull = max(0, state.hull - damage)
    status = cond do
      hull == 0 -> :destroyed
      distance >= @length and offset * scale <= wall.radius * 0.7 -> :arrived
      true -> :in_transit
    end

    %{state | elapsed_ms: elapsed, distance: if(status == :in_transit, do: min(distance, @length - 0.01), else: distance),
      x: wall.x + dx * scale, y: wall.y + dy * scale,
      roll: :math.fmod(state.roll + input.roll * dt * 1.5, 2.0 * :math.pi()),
      speed: if(status == :in_transit, do: speed, else: 0.0), hull: hull,
      exposure_damage: exposure, wall_ms: wall_ms, wall_contact: contact, status: status}
  end
  def tick(state), do: state

  def abort(%{status: :in_transit} = state), do: %{state | status: :aborted, speed: 0.0}
  def abort(state), do: state

  def public(state) do
    wall = section(state.distance)
    offset = :math.sqrt(:math.pow(state.x - wall.x, 2) + :math.pow(state.y - wall.y, 2))
    Map.take(state, [:origin, :destination, :status, :elapsed_ms, :distance, :x, :y, :roll,
      :speed, :hull, :max_hull, :shields, :max_shields, :exposure_damage, :wall_contact])
    |> Map.merge(%{progress: state.distance / @length, clearance: max(0.0, wall.radius - offset),
      damage_rate: 1.0 + state.elapsed_ms / 20_000.0,
      throttle: state.input.throttle})
  end

  defp axis_value(n) when is_number(n) and n >= -1 and n <= 1, do: n * 1.0
  defp axis_value(_), do: 0.0
  defp clamp(n, low, high), do: max(low, min(high, n))
end
