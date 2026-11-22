defmodule Sunracer.StoryTest do
  use Sunracer.DataCase

  import Sunracer.AccountsFixtures
  import ExUnit.CaptureLog

  alias Sunracer.Accounts.PlayerAccount
  alias Sunracer.{Inventory, Piracy, Repo, Story}
  alias Sunracer.Story.Prologue

  @vesper_contact "traffic:sol:story:1:vesper-02"
  @corsair "flyby:traffic:sol:story:1:corsair-17:2"

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

  defp crates(pilot), do: Map.get(Inventory.cargo_manifest(pilot), Prologue.cargo_id(), 0)

  defp record!(pilot, event) do
    capture_log(fn -> send(self(), {:result, Story.record(pilot, event)}) end)
    assert_received {:result, result}
    result
  end

  test "a new pilot starts the prologue at step 1" do
    pilot = player_account_fixture()

    assert %{step: 1, complete: false, skipped: false, prompt: %{speaker: speaker}} =
             Story.snapshot(pilot.id)
    refute Map.has_key?(Story.snapshot(pilot.id), :scene)

    assert speaker == "Dispatcher Halden Ross"
  end

  test "the whole prologue, paid once, from server-confirmed events" do
    pilot = player_account_fixture()
    id = pilot.id
    :ok = Phoenix.PubSub.subscribe(Sunracer.PubSub, "world:sol")

    assert {:ok, %{progress: %{step: 1}}} =
             record!(id, {:flight_controls, %{throttle: true, rotation: false}})

    assert {:ok, %{story: %{step: 2}}} =
             record!(id, {:flight_controls, %{throttle: false, rotation: true}})

    assert_receive {:story_updated, %{player_id: ^id,
      story: %{step: 2, scene: %{id: "first_run:systems_green"}}}}

    assert {:ok, %{story: %{step: 3}}} = record!(id, :accept_consignment)
    assert_receive {:story_updated, %{player_id: ^id,
      story: %{step: 3, scene: %{id: "first_run:consignment_loaded"}}}}
    assert crates(id) == Prologue.crates()
    assert :ignored = record!(id, :accept_consignment)
    refute_receive {:story_updated, %{player_id: ^id,
      story: %{scene: %{id: "first_run:consignment_loaded"}}}}, 20
    assert crates(id) == Prologue.crates()

    assert {:ok, %{story: %{step: 4}}} = record!(id, {:navigation, nav(%{})})
    assert {:ok, %{story: %{step: 5}}} = record!(id, {:hail, @vesper_contact})

    # A lost rescue goes back to step 5; a later fight can still win it.
    assert {:ok, %{story: %{step: 6}}} = record!(id, {:tactical_started, @corsair})

    assert {:ok, %{story: %{step: 5}, progress: %{flags: %{"rescue_failed" => "retreat"}}}} =
             record!(id, {:tactical_finished, @corsair, :retreat, 2})

    assert {:ok, %{story: %{step: 6}}} = record!(id, {:tactical_started, @corsair})

    assert {:ok, %{story: %{step: 7}}} =
             record!(id, {:tactical_finished, @corsair, :surrender, 3})

    assert {:ok, %{story: %{step: 8}}} = record!(id, :docked_starbase)
    assert [%{id: "story"}] = Story.topics(id, "repair")

    capture_log(fn ->
      assert {:ok, patch_line} = Story.talk(id, "repair")
      assert patch_line =~ "patched"
    end)

    assert [] = Story.topics(id, "repair")
    assert {:ok, chip_line} = Story.talk(id, "missions")
    assert chip_line =~ "flight plan"
    assert {:error, :invalid_station_topic} = Story.talk(id, "missions")
    assert %{step: 9} = Story.snapshot(id)

    before = Repo.get!(PlayerAccount, id).credits
    mars = nav(%{status: :idle, location_id: "mars", destination_id: nil})

    assert {:ok, %{story: %{complete: true, license: true, reward: %{credits: 500}}}} =
             record!(id, {:navigation, mars})

    assert Repo.get!(PlayerAccount, id).credits == before + 500
    assert crates(id) == 0
    assert Piracy.faction_standing(id, "helios_couriers") == Prologue.helios_standing_gain()
    assert %{credits: 500} = Story.reward_receipt(id)

    # Replays after completion change nothing.
    assert :ignored = record!(id, {:navigation, mars})
    assert Repo.get!(PlayerAccount, id).credits == before + 500
  end

  test "a short delivery waits, and Earth reissues the consignment once" do
    pilot = player_account_fixture()
    id = pilot.id

    for event <- [{:flight_controls, %{throttle: true, rotation: true}}, :accept_consignment],
        do: assert({:ok, _} = record!(id, event))

    {:ok, _} = Inventory.remove_cargo(id, Prologue.cargo_id(), 2)
    earth = nav(%{status: :idle, location_id: "earth", destination_id: nil})
    assert {:ok, _} = record!(id, {:navigation, earth})
    assert crates(id) == Prologue.crates()

    {:ok, _} = Inventory.remove_cargo(id, Prologue.cargo_id(), 2)
    assert :ignored = record!(id, {:navigation, earth})
    assert crates(id) == Prologue.crates() - 2
  end

  test "a full hold refuses the consignment without advancing" do
    pilot = player_account_fixture()
    id = pilot.id
    {:ok, _} = Inventory.add_cargo(id, "titanium", 3)
    assert {:ok, _} = record!(id, {:flight_controls, %{throttle: true, rotation: true}})
    assert {:error, :cargo_hold_full} = record!(id, :accept_consignment)
    assert %{step: 2} = Story.snapshot(id)
    assert crates(id) == 0
  end

  test "skip hides the prompt and pauses the prologue until resumed" do
    pilot = player_account_fixture()
    id = pilot.id
    assert {:ok, %{story: %{skipped: true, prompt: nil}}} = record!(id, :skip)
    assert :ignored = record!(id, {:flight_controls, %{throttle: true, rotation: true}})
    assert {:ok, %{story: %{skipped: false, step: 1}}} = record!(id, :resume)
  end
end
