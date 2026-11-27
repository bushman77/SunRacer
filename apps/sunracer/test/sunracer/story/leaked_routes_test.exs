defmodule Sunracer.Story.LeakedRoutesTest do
  use ExUnit.Case, async: true
  alias Sunracer.Story.LeakedRoutes, as: Chapter

  test "explicit acceptance, either order, no early or repeated payout" do
    initial = Chapter.new()
    assert :ignore = Chapter.apply(initial, :station_distribution)
    assert :ignore = Chapter.apply(initial, :report_distribution)
    assert {:ok, active, []} = Chapter.apply(initial, :accept_station_records)
    assert :ignore = Chapter.apply(active, :accept_station_records)
    for {first, second} <- [{:station_distribution, :exchange_reference},
                            {:exchange_reference, :station_distribution}] do
      assert {:ok, partial, []} = Chapter.apply(active, first)
      assert partial.step == 2
      assert :ignore = Chapter.apply(partial, first)
      assert :ignore = Chapter.apply(partial, :report_distribution)
      assert {:ok, ready, []} = Chapter.apply(partial, second)
      assert ready.step == 3
      assert {:ok, next, [{:story_credits, "sol.leaked_routes.station_records", 200}]} =
        Chapter.apply(ready, :report_distribution)
      assert next.step == 4
      refute Chapter.public(next).complete
      assert :ignore = Chapter.apply(next, :report_distribution)
      assert :ignore = Chapter.apply(next, :skip)
    end
  end

  test "eligibility requires all First Run evidence and completion" do
    p = %{step: 10, skipped: false, flags: %{"data_chip" => true, "talked_mara" => true,
      "talked_juno" => true, "helios_license" => true}}
    assert Chapter.eligible?(p)
    refute Chapter.eligible?(%{p | step: 9})
    refute Chapter.eligible?(%{p | skipped: true})
    refute Chapter.eligible?(%{p | flags: Map.delete(p.flags, "data_chip")})
  end
end
