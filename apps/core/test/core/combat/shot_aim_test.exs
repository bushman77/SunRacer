defmodule Core.Combat.ShotAimTest do
  use ExUnit.Case, async: true
  alias Core.Combat.ShotAim
  alias Core.World.Orientation

  @current Orientation.identity()
  defp rotated(deg) do
    q = Orientation.from_angles(%{
      yaw: deg * :math.pi() / 180, pitch: 0.0, roll: 0.0
    })
    Map.new(q, fn {k, v} -> {to_string(k), v} end)
  end

  test "legacy manual firing continues to use server orientation" do
    assert {:ok, @current} = ShotAim.resolve(@current, %{}, 25, 100)
  end

  test "valid client direction is used, even when server faces differently" do
    request = %{"aim_orientation" => rotated(12), "client_tick" => 24}
    assert {:ok, accepted} = ShotAim.resolve(@current, request, 25, 100)
    assert_in_delta abs(accepted.y), abs(request["aim_orientation"]["y"]), 1.0e-8
  end

  test "lag-window accepts plausible rapid rotation within a recent tick" do
    request = %{"aim_orientation" => rotated(43), "client_tick" => 27}
    assert {:ok, _} = ShotAim.resolve(@current, request, 30, 100)
  end

  test "invalid quaternions, stale/future tick, and impossible turns are rejected" do
    valid = rotated(3)
    for input <- [
      %{"aim_orientation" => rotated(170), "client_tick" => 29},
      %{"aim_orientation" => valid, "client_tick" => 20},
      %{"aim_orientation" => valid, "client_tick" => 31},
      %{"aim_orientation" => valid},
      %{"aim_orientation" => %{"x"=>0,"y"=>0,"z"=>0,"w"=>0}, "client_tick"=>30},
      %{"aim_orientation" => %{"x"=>3,"y"=>0,"z"=>0,"w"=>1}, "client_tick"=>30},
      %{"aim_orientation" => %{"x"=>"0","y"=>0,"z"=>0,"w"=>1}, "client_tick"=>30},
      %{"aim_orientation" => nil, "client_tick"=>30}
    ] do
      assert {:error, :invalid_shot_aim} =
        ShotAim.resolve(@current, input, 30, 100)
    end
  end

  test "quaternions q and -q represent the same physical direction" do
    negative = %{"x" => 0.0, "y" => 0.0, "z" => 0.0, "w" => -1.0}
    assert {:ok, _} = ShotAim.resolve(@current,
      %{"aim_orientation" => negative, "client_tick" => 0}, 0, 100)
  end
end
