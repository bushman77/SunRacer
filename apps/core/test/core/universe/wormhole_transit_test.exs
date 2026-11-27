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

  test "wall contact adds hull-only damage and cannot leave the tunnel" do
    state = Transit.new() |> Map.put(:x, 900.0) |> Transit.tick()
    assert state.wall_contact
    assert state.hull == 299
    assert state.shields == 120
    assert abs(state.x) <= Transit.section(0).radius
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
    assert Transit.tick(aborted) == aborted
  end
end
