defmodule Core.Universe.StoryTrafficNavigationTest do
  use ExUnit.Case, async: true

  alias Core.Universe.{Navigation, StoryTraffic}

  @pilot 41
  @other 42

  setup do
    receiver = self()
    name = :"#{__MODULE__}.Test#{System.unique_integer([:positive])}"
    # No shared traffic: only staged story vessels can be on sensors.
    start_supervised!(
      {Navigation,
       name: name,
       auto_tick: false,
       tick_ms: 1_000,
       traffic: %{},
       event_sink: fn map_id, event, payload -> send(receiver, {map_id, event, payload}) end}
    )

    %{server: name}
  end

  defp cruise_to_mars(server, pilot, ticks) do
    assert {:ok, %{status: :traveling}} = Navigation.set_course(server, pilot, "mars")
    for _ <- 1..ticks, do: :ok = Navigation.tick(server)
    {:ok, navigation} = Navigation.snapshot(server, pilot)
    navigation
  end

  test "staging requires an active cruise", %{server: server} do
    assert {:error, :no_active_course} =
             Navigation.stage_story_contact(server, @pilot, :vesper_pass)

    assert {:error, :invalid_story_script} =
             Navigation.stage_story_contact(server, @pilot, :dragon)
  end

  test "Vesper-02 close pass is private, hailable and protected", %{server: server} do
    cruise_to_mars(server, @pilot, 20)
    _ = cruise_to_mars(server, @other, 20)

    assert {:ok, navigation} = Navigation.stage_story_contact(server, @pilot, :vesper_pass)
    vesper_id = StoryTraffic.contact_id(@pilot, :vesper_pass)

    assert %{
             contact_id: ^vesper_id,
             classification: :neutral_flyby,
             call_sign: "Vesper-02",
             story_script: :vesper_pass
           } = navigation.pending_encounter

    assert navigation.cruise_paused
    assert Enum.any?(navigation.contacts, &(&1.id == vesper_id))
    assert_receive {"sol", :solar_encounter_started, %{player_id: @pilot}}

    # Idempotent: staging again returns the same hold.
    assert {:ok, again} = Navigation.stage_story_contact(server, @pilot, :vesper_pass)
    assert again.pending_encounter.id == navigation.pending_encounter.id

    # Another pilot on the same lane sees nothing and cannot hail it.
    assert {:ok, other} = Navigation.snapshot(server, @other)
    refute Enum.any?(other.contacts, &(&1.id == vesper_id))
    assert {:error, :unknown_contact} = Navigation.hail(server, @other, vesper_id)

    assert {:ok, %{message: message, call_sign: "Vesper-02"}} =
             Navigation.hail(server, @pilot, vesper_id)

    assert message =~ "Ines Varga"

    assert {:error, :story_contact_protected} =
             Navigation.enter_tactical(server, @pilot, navigation.pending_encounter.id)

    assert {:ok, %{pending_encounter: nil}} =
             Navigation.resolve_encounter(
               server,
               @pilot,
               navigation.pending_encounter.id,
               :continue
             )
  end

  test "Corsair-17 is a private hostile with a scripted surrender", %{server: server} do
    cruise_to_mars(server, @pilot, 100)

    assert {:ok, %{pending_encounter: encounter}} =
             Navigation.stage_story_contact(server, @pilot, :corsair_raid)

    assert %{classification: :hostile_contact, call_sign: "Corsair-17"} = encounter

    assert {:ok, %{tactical_encounter: tactical}} =
             Navigation.enter_tactical(server, @pilot, encounter.id)

    assert tactical.surrender_at == 0.5
    assert tactical.private_to == @pilot

    assert {:ok, source} = Navigation.tactical_contact(server, @pilot, encounter.id)
    assert source.cargo == %{"civilian_mail" => 40}

    combat = tactical.combat

    report = %{
      contact_id: tactical.contact_id,
      voyage_number: tactical.voyage_number,
      encounter_id: encounter.id,
      combat: %{combat | hull: div(combat.max_hull, 2), shields: 0, status: :surrendered}
    }

    assert {:ok, %{tactical_encounter: nil, pending_encounter: nil}} =
             Navigation.finish_tactical(server, @pilot, encounter.id, :surrender, report)

    # Retrying the identical settlement is accepted; the vessel is disabled.
    assert {:ok, _} =
             Navigation.finish_tactical(server, @pilot, encounter.id, :surrender, report)

    assert {:ok, navigation} = Navigation.snapshot(server, @pilot)
    corsair = Enum.find(navigation.contacts, &(&1.id == tactical.contact_id))
    assert corsair.state == :disabled
  end

  test "clearing story contacts releases a story hold", %{server: server} do
    cruise_to_mars(server, @pilot, 100)
    assert {:ok, _} = Navigation.stage_story_contact(server, @pilot, :corsair_raid)
    assert {:ok, navigation} = Navigation.clear_story_contacts(server, @pilot)
    assert navigation.pending_encounter == nil
    refute Enum.any?(navigation.contacts, &StoryTraffic.story_id?(&1.id))
  end

  test "arrival retires the pilot's story vessels", %{server: server} do
    cruise_to_mars(server, @pilot, 20)

    assert {:ok, %{pending_encounter: encounter}} =
             Navigation.stage_story_contact(server, @pilot, :vesper_pass)

    assert {:ok, _} = Navigation.resolve_encounter(server, @pilot, encounter.id, :continue)

    for _ <- 1..300, do: :ok = Navigation.tick(server)

    assert {:ok, %{status: :idle, location_id: "mars", contacts: contacts}} =
             Navigation.snapshot(server, @pilot)

    refute Enum.any?(contacts, &StoryTraffic.story_id?(&1.id))
  end

  test "script IDs are recognised without trusting other traffic" do
    assert StoryTraffic.script_of(StoryTraffic.contact_id(7, :vesper_pass)) == :vesper_pass

    assert StoryTraffic.script_of("flyby:" <> StoryTraffic.contact_id(7, :corsair_raid) <> ":3") ==
             :corsair_raid

    assert StoryTraffic.script_of("traffic:sol:vesper-02") == nil
    assert StoryTraffic.script_of(nil) == nil
  end
end
