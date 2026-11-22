defmodule Sunracer.Story.PrologueTest do
  use ExUnit.Case, async: true

  alias Core.Universe.{GreenStarbase, StoryTraffic}
  alias Sunracer.Story.Prologue

  @pilot 77
  @vesper "flyby:" <> "traffic:sol:story:77:vesper-02" <> ":1"
  @corsair "flyby:" <> "traffic:sol:story:77:corsair-17" <> ":1"

  defp at(step, flags \\ %{}), do: %{Prologue.new() | step: step, flags: flags}

  defp nav(attrs) do
    Map.merge(
      %{
        status: :traveling,
        destination_id: "mars",
        location_id: nil,
        progress: 0.0,
        pending_encounter: nil,
        tactical_encounter: nil,
        free_flight: false,
        logout_paused: false,
        voyage_number: 1,
        position_km: %{x: 0.0, y: 0.0, z: 0.0}
      },
      attrs
    )
  end

  test "step 1 needs both throttle and rotation confirmed" do
    assert {:ok, %{step: 1} = p, []} =
             Prologue.apply(
               Prologue.new(),
               {:flight_controls, %{throttle: true, rotation: false}}
             )

    assert :ignore = Prologue.apply(p, {:flight_controls, %{throttle: true, rotation: false}})

    assert {:ok, %{step: 2}, []} =
             Prologue.apply(p, {:flight_controls, %{throttle: false, rotation: true}})
  end

  test "accepting the consignment loads crates exactly once" do
    assert {:ok, %{step: 3, flags: %{"consignment" => true}} = p, [:grant_consignment]} =
             Prologue.apply(at(2), :accept_consignment)

    assert :ignore = Prologue.apply(p, :accept_consignment)
  end

  test "a voyage to Mars clears step 3; elsewhere does not" do
    assert :ignore = Prologue.apply(at(3), {:navigation, nav(%{destination_id: "venus"})})
    assert {:ok, %{step: 4}, []} = Prologue.apply(at(3), {:navigation, nav(%{})})
  end

  test "Vesper-02 is staged mid-cruise only while no hold is pending" do
    assert :ignore = Prologue.apply(at(4), {:navigation, nav(%{progress: 0.05})})

    assert {:ok, %{step: 4}, [{:stage, :vesper_pass}]} =
             Prologue.apply(at(4), {:navigation, nav(%{progress: 0.2})})

    assert :ignore =
             Prologue.apply(
               at(4),
               {:navigation,
                nav(%{progress: 0.2, pending_encounter: %{id: "flyby:traffic:sol:meridian-01:1"}})}
             )
  end

  test "hailing or resuming past Vesper-02 advances; unrelated contacts do not" do
    assert :ignore = Prologue.apply(at(4), {:hail, "traffic:sol:meridian-01"})

    assert {:ok, %{step: 5}, []} =
             Prologue.apply(at(4), {:hail, StoryTraffic.contact_id(@pilot, :vesper_pass)})

    assert {:ok, %{step: 5}, []} = Prologue.apply(at(4), {:encounter_resolved, @vesper, 1})
  end

  test "the distress call stages Corsair-17 near the Green Starbase" do
    far = nav(%{position_km: %{x: 0.0, y: 0.0, z: 0.0}})
    near = nav(%{position_km: GreenStarbase.position_km()})
    assert :ignore = Prologue.apply(at(5), {:navigation, far})
    assert {:ok, _, [{:stage, :corsair_raid}]} = Prologue.apply(at(5), {:navigation, near})
  end

  test "ignoring the distress call loses the rescue until a later voyage" do
    assert {:ok, %{step: 5, flags: flags} = p, [:clear_story_contacts]} =
             Prologue.apply(at(5), {:encounter_resolved, @corsair, 3})

    assert flags["rescue_failed_voyage"] == 3
    near = nav(%{position_km: GreenStarbase.position_km(), voyage_number: 3})
    assert :ignore = Prologue.apply(p, {:navigation, near})

    assert {:ok, %{flags: retry_flags}, [{:stage, :corsair_raid}]} =
             Prologue.apply(p, {:navigation, %{near | voyage_number: 4}})

    refute Map.has_key?(retry_flags, "rescue_failed")
  end

  test "the fight: start, then only a surrender clears the rescue" do
    assert {:ok, %{step: 6} = fighting, []} =
             Prologue.apply(at(5), {:tactical_started, @corsair})

    for outcome <- [:retreat, :defeat, :escaped, :victory] do
      assert {:ok, %{step: 5, flags: %{"rescue_failed" => reason}}, [:clear_story_contacts]} =
               Prologue.apply(fighting, {:tactical_finished, @corsair, outcome, 2})

      assert reason == Atom.to_string(outcome)
    end

    assert {:ok, %{step: 7, flags: %{"data_chip" => true}}, []} =
             Prologue.apply(fighting, {:tactical_finished, @corsair, :surrender, 2})
  end

  test "docking, then both station conversations; Mara patches the hull once" do
    assert {:ok, %{step: 8} = docked, []} = Prologue.apply(at(7), :docked_starbase)

    assert {:ok, %{step: 8} = patched, [:patch_hull]} =
             Prologue.apply(docked, {:talked, "repair"})

    assert :ignore = Prologue.apply(patched, {:talked, "repair"})
    assert {:ok, %{step: 9}, []} = Prologue.apply(patched, {:talked, "missions"})
  end

  test "delivery at Mars needs every crate and completes the prologue" do
    mars = nav(%{status: :idle, location_id: "mars", destination_id: nil})

    assert {:ok, %{step: 9, flags: %{"short_crates" => 1}} = short, []} =
             Prologue.apply(at(9), {:navigation, mars}, %{crates: 1})

    assert :ignore = Prologue.apply(short, {:navigation, mars}, %{crates: 1})

    assert {:ok, %{step: 10, flags: %{"helios_license" => true}} = done, [:deliver]} =
             Prologue.apply(short, {:navigation, mars}, %{crates: Prologue.crates()})

    assert :ignore = Prologue.apply(done, {:navigation, mars}, %{crates: Prologue.crates()})
  end

  test "a lost consignment is reissued at Earth once" do
    earth = nav(%{status: :idle, location_id: "earth", destination_id: nil})
    p = at(9, %{"consignment" => true})

    assert {:ok, %{flags: %{"reissued" => true}} = reissued, [{:reissue, 2}]} =
             Prologue.apply(p, {:navigation, earth}, %{crates: 1})

    assert :ignore = Prologue.apply(reissued, {:navigation, earth}, %{crates: 0})
  end

  test "skip pauses every event until resumed" do
    assert {:ok, %{skipped: true} = skipped, [:clear_story_contacts]} =
             Prologue.apply(at(4), :skip)

    assert :ignore = Prologue.apply(skipped, {:navigation, nav(%{progress: 0.5})})
    refute Prologue.wants?(skipped, :navigation)
    assert {:ok, %{skipped: false, step: 4}, []} = Prologue.apply(skipped, :resume)
  end

  test "every step has one prompt, and station topics follow the step" do
    for step <- 1..10 do
      assert %{speaker: speaker, text: text, objective: objective} = Prologue.prompt(at(step))
      assert speaker != "" and text != "" and objective != ""
    end

    assert Prologue.prompt(at(2)).action.id == "contact_dispatch"
    assert {:ok, %{npc_id: "helios_dispatch", cargo: %{count: 3}, reward_credits: 500}} =
      Prologue.mission_offer(at(2))
    assert {:error, :mission_unavailable} = Prologue.mission_offer(at(1))
    assert {:error, :mission_unavailable} = Prologue.mission_offer(at(3))
    assert {:error, :mission_unavailable} =
      Prologue.mission_offer(%{at(2) | skipped: true})
  end

  test "every objective fits the stereo HUD's 58-character budget" do
    # story_hud.mjs renders the headset line as
    # objective.toUpperCase().slice(0, 58); anything longer is cut mid-word
    # and the pilot loses the end of the instruction.
    progressions =
      Enum.map(1..10, &at(&1)) ++
        [at(5, %{"rescue_failed" => true}), at(8, %{"talked_mara" => true})]

    for progress <- progressions do
      objective = Prologue.prompt(progress).objective

      assert String.length(objective) <= 58,
             "step #{progress.step} objective is #{String.length(objective)} chars: " <>
               objective
    end
    assert [%{id: "story"}] = Prologue.topics(at(8), "repair")
    assert [] = Prologue.topics(at(8, %{"talked_mara" => true}), "repair")
    assert [] = Prologue.topics(at(5), "missions")
    assert {:ok, line} = Prologue.dialogue(at(8), "missions")
    assert line =~ "route plan"
    assert :error = Prologue.dialogue(at(3), "repair")
  end
end
