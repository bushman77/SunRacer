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

  test "Follow the Copy is ordered, location-gated, and pays once" do
    p = Map.merge(Chapter.new(), %{step: 4, flags: %{"station_records_complete" => true,
      "station_distribution" => true, "exchange_reference" => true}})
    assert :ignore = Chapter.apply(p, :dispatch_original)
    assert {:ok, earth, []} = Chapter.apply(p, :accept_follow_copy)
    assert earth.step == 5
    assert :ignore = Chapter.apply(earth, :clearing_audit)
    assert :error = Chapter.dialogue(earth, "venus_auditor", "leaked_routes.clearing_audit")
    contact = Chapter.local_contact(earth)
    assert %{location_id: "earth"} = contact
    nav = %{system_id: "sol", status: :idle, location_id: "earth", pending_encounter: nil,
      tactical_encounter: nil, free_flight: false, logout_paused: false}
    assert Chapter.local_contact_available?(contact, nav)
    for invalid <- [%{location_id: "venus"}, %{status: :traveling}, %{system_id: "other"},
                    %{pending_encounter: %{}}, %{tactical_encounter: %{}},
                    %{free_flight: true}, %{logout_paused: true}] do
      refute Chapter.local_contact_available?(contact, Map.merge(nav, invalid))
    end
    assert {:ok, venus, []} = Chapter.apply(earth, :dispatch_original)
    assert venus.step == 6
    assert :ignore = Chapter.apply(venus, :dispatch_original)
    assert %{location_id: "venus"} = Chapter.local_contact(venus)
    assert {:ok, done, [{:story_credits, "sol.leaked_routes.follow_the_copy", 400}]} =
      Chapter.apply(venus, :clearing_audit)
    assert done.step == 7
    assert done.flags["clearing_audit"]
    refute Chapter.public(done).complete
    assert nil == Chapter.local_contact(done)
    assert :ignore = Chapter.apply(done, :clearing_audit)
    assert :ignore = Chapter.apply(done, :accept_secure_record)
    assert %{id: "leaked_routes:follow_copy_complete"} = Chapter.scene(venus, done)
    assert nil == Chapter.scene(done, done)
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
