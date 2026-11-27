defmodule Core.Universe.WormholeTransitTest do
  use ExUnit.Case, async: true
  alias Core.Universe.WormholeTransit, as: Transit

  test "time exposure accelerates and directly damages hull, not shields" do
    start = Transit.new(300, 120)
    after_20 = Enum.reduce(1..200, start, fn _, s -> Transit.tick(s) end)
    after_40 = Enum.reduce(1..200, after_20, fn _, s -> Transit.tick(s) end)
    assert after_20.hull == 270
    assert after_40.hull == 220
    assert after_40.shields == 120
    assert after_40.distance == 0
    assert Transit.exposure_damage(60_000) == 150
  end

  test "idle pilot eventually dies; terminal state does not advance" do
    state = Enum.reduce(1..1200, Transit.new(), fn _, s -> Transit.tick(s) end)
    assert state.status == :destroyed
    assert state.hull == 0
    assert state.shields == 120
    assert Transit.tick(state) == state
    assert Transit.abort(state) == state
  end

  test "untrusted claims cannot skip or repair a transit" do
    initial = Transit.new()
    state = Transit.controls(initial, %{"distance" => 9600, "hull" => 999,
      "elapsed_ms" => 0, "status" => "arrived", "yaw" => 300, "throttle" => 1})
    assert state.hull == initial.hull
    assert state.distance == 0
    assert state.input.yaw == 0
    assert Transit.tick(state).distance == 24
  end

  test "wall contact adds hull-only damage and allows a real boundary breach" do
    state = Transit.new() |> Map.put(:x, 900.0) |> Transit.tick()
    assert state.wall_contact
    assert state.outside
    assert state.hull == 299
    assert state.shields == 120
    assert state.x > Transit.section(0).radius
    assert Transit.public(state).clearance < 0
    assert Transit.public(state).breach_remaining_ms == 2_900
  end

  test "three continuous seconds outside eject to SOL with damage retained" do
    initial = Transit.new() |> Map.put(:x, 900.0)
    almost = advance(initial, 29)
    assert almost.status == :in_transit
    assert Transit.public(almost).breach_remaining_ms == 100
    returned = Transit.tick(almost)
    assert returned.status == :ejected
    assert returned.location == :sol_entrance
    assert returned.distance == 0
    assert returned.hull == 261
    assert returned.shields == 120
    assert returned.cooldown_ms == 10_000
    assert Transit.public(returned).damage_rate == 0
    assert Transit.retry(returned) == {:error, :reentry_unavailable}
    cooling = advance(returned, 99)
    assert cooling.cooldown_ms == 100
    assert cooling.hull == returned.hull
    assert Transit.retry(cooling) == {:error, :reentry_unavailable}
    ready = Transit.tick(cooling)
    refute Transit.ticking?(ready)
    assert {:ok, retry} = Transit.retry(ready)
    assert retry.status == :in_transit
    assert retry.elapsed_ms == 0
    assert retry.outside_ms == 0
    assert retry.hull == returned.hull
    assert retry.max_hull == 300
    assert retry.shields == returned.shields
    assert retry.max_shields == 120
  end

  test "steering inside cancels the countdown without undoing damage" do
    breached = advance(Transit.new() |> Map.put(:x, 500.0), 10)
    assert breached.outside
    recovered = Enum.reduce(1..10, breached, fn _, s ->
      s |> Transit.controls(%{yaw: -1}) |> Transit.tick()
    end)
    refute recovered.outside
    assert recovered.outside_ms == 0
    assert Transit.public(recovered).breach_remaining_ms == nil
    assert recovered.status == :in_transit
    assert recovered.hull <= breached.hull
    second = recovered |> Map.put(:x, 900.0) |> Transit.tick()
    assert second.outside_ms == 100
  end

  test "destruction takes precedence over ejection and no retry is possible" do
    almost = advance(Transit.new() |> Map.put(:x, 900.0), 29)
    dead = almost |> Map.put(:hull, 1) |> Transit.tick()
    assert dead.status == :destroyed
    assert dead.hull == 0
    assert dead.shields == 120
    assert Transit.retry(dead) == {:error, :reentry_unavailable}
  end

  test "a breach at the exit cannot grant arrival" do
    state = Transit.new() |> Map.merge(%{distance: Transit.length() - 0.01, x: 900.0})
    state = state |> Transit.controls(%{throttle: 1}) |> Transit.tick()
    assert state.status == :in_transit
    assert state.outside
    assert state.distance < Transit.length()
  end

  test "a steered traversal reaches the destination with accumulated damage" do
    state = Enum.reduce_while(1..450, Transit.new(), fn _, s ->
      target = Transit.section(min(Transit.length(), s.distance + 24))
      yaw = max(-1.0, min(1.0, (target.x - s.x) / 24))
      pitch = max(-1.0, min(1.0, (target.y - s.y) / 24))
      next = s |> Transit.controls(%{yaw: yaw, pitch: pitch, throttle: 1}) |> Transit.tick()
      if next.status == :in_transit, do: {:cont, next}, else: {:halt, next}
    end)
    assert state.status == :arrived
    assert state.distance == Transit.length()
    assert state.hull == 220
    assert state.shields == 120
  end

  test "abort retains damage without granting arrival" do
    state = Enum.reduce(1..200, Transit.new(), fn _, s -> Transit.tick(s) end)
    aborted = Transit.abort(state)
    assert aborted.status == :aborted
    assert aborted.hull == state.hull
    assert aborted.location == :sol_entrance
    assert aborted.cooldown_ms == 10_000
    assert Transit.retry(aborted) == {:error, :reentry_unavailable}
    assert Transit.tick(aborted).hull == aborted.hull
    assert {:ok, retry} = aborted |> advance(100) |> Transit.retry()
    assert retry.hull == state.hull
  end

  defp advance(state, ticks), do: Enum.reduce(1..ticks, state, fn _, s -> Transit.tick(s) end)
end
