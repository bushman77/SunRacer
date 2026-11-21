defmodule Darkorbit.Story.Prologue do
  @moduledoc """
  Pure step engine for the "First Run" prologue (docs/story-first-run.md).

  The engine never reads the database, a socket or a clock. It receives the
  pilot's progress and one *server-confirmed* event, and answers with the new
  progress plus the effects the caller must perform (load crates, stage a
  story vessel, pay out). `Darkorbit.Story` applies it inside a row lock, so
  every advance is idempotent: replaying an event at a later step is ignored.

  Steps (Trigger column of the design doc):

    1. Systems check: throttle and rotation confirmed by the flight server.
    2. Consignment: the pilot accepts; the server loads 3 medical crates.
    3. Clearance: a voyage to Mars is under way.
    4. Vesper-02: hail or resume on the staged Vesper-02 close pass.
    5. Distress: tactical combat starts against the staged Corsair-17.
    6. Surrender: the surrender settlement is recorded.
    7. Limping in: docked at the Green Starbase.
    8. The station: validated dialogue with Mara Venn and Juno Rook.
    9. Mars: arrival at Mars with all three crates aboard.

  Step 10 means complete. Failure rules: death keeps the current step (the
  normal Earth respawn applies); losing the rescue (resume past the distress
  call, retreat, defeat, escape, or destroying Corsair-17 and its chip)
  returns to step 5, re-armed for the pilot's *next* voyage past the
  starbase. One crate reissue at Earth guards against a soft lock.
  """

  alias Core.Universe.StoryTraffic

  @chapter "prologue"
  @complete 10
  # The Sunracer's hold is 4 t (Core.Ships.Catalog): three 1 t crates leave
  # room for one seized crate from Corsair-17.
  @crates 3
  @cargo_id "medical_supplies"
  @first_pay 500
  @helios "helios_couriers"
  @helios_standing_gain 5
  # Earth-Mars cruise is ~260 s; Vesper-02 closes in early on the lane.
  @vesper_after_progress 0.12
  # The Green Starbase sits at the Earth-Mars midpoint; ~38 s either side.
  @distress_radius_km 2_500_000.0

  @type progress :: %{step: 1..10, flags: map(), skipped: boolean()}
  @type effect ::
          :grant_consignment
          | {:reissue, pos_integer()}
          | {:stage, StoryTraffic.script()}
          | :clear_story_contacts
          | :patch_hull
          | :deliver

  def chapter, do: @chapter
  def complete_step, do: @complete
  def crates, do: @crates
  def cargo_id, do: @cargo_id
  def first_pay, do: @first_pay
  def helios_faction, do: @helios
  def helios_standing_gain, do: @helios_standing_gain

  @spec new() :: progress()
  def new, do: %{step: 1, flags: %{}, skipped: false}

  @doc """
  Apply one server-confirmed event. `facts` carries server-read values the
  engine cannot know: `:crates` (medical crates aboard) for navigation events.

  Returns `:ignore` when nothing changes and nothing must be done.
  """
  @spec apply(progress(), term(), map()) :: {:ok, progress(), [effect()]} | :ignore
  def apply(progress, event, facts \\ %{})

  def apply(%{skipped: true} = progress, :resume, _facts),
    do: {:ok, %{progress | skipped: false}, []}

  def apply(%{skipped: true}, _event, _facts), do: :ignore
  def apply(%{step: @complete}, _event, _facts), do: :ignore

  def apply(progress, :skip, _facts),
    do: {:ok, %{progress | skipped: true}, [:clear_story_contacts]}

  def apply(%{step: 1} = progress, {:flight_controls, input}, _facts) when is_map(input) do
    flags =
      progress.flags
      |> put_if(Map.get(input, :throttle) == true, "throttle")
      |> put_if(Map.get(input, :rotation) == true, "rotation")

    cond do
      flags["throttle"] && flags["rotation"] -> {:ok, advance(progress, 2, flags), []}
      flags != progress.flags -> {:ok, %{progress | flags: flags}, []}
      true -> :ignore
    end
  end

  def apply(%{step: 2} = progress, :accept_consignment, _facts),
    do:
      {:ok, advance(progress, 3, Map.put(progress.flags, "consignment", true)),
       [:grant_consignment]}

  def apply(progress, {:navigation, nav}, facts) when is_map(nav),
    do: navigation(progress, nav, facts)

  def apply(%{step: 4} = progress, {:hail, contact_id}, _facts) do
    if StoryTraffic.script_of(contact_id) == :vesper_pass,
      do: {:ok, advance(progress, 5, Map.put(progress.flags, "varga_hailed", true)), []},
      else: :ignore
  end

  def apply(%{step: 4} = progress, {:encounter_resolved, encounter_id, _voyage}, _facts) do
    if StoryTraffic.script_of(encounter_id) == :vesper_pass,
      do: {:ok, advance(progress, 5, progress.flags), []},
      else: :ignore
  end

  def apply(%{step: 5} = progress, {:encounter_resolved, encounter_id, voyage}, _facts) do
    if StoryTraffic.script_of(encounter_id) == :corsair_raid,
      do: rescue_failed(progress, voyage, "ignored"),
      else: :ignore
  end

  def apply(%{step: 5} = progress, {:tactical_started, encounter_id}, _facts) do
    if StoryTraffic.script_of(encounter_id) == :corsair_raid,
      do: {:ok, advance(progress, 6, Map.delete(progress.flags, "rescue_failed")), []},
      else: :ignore
  end

  def apply(%{step: 6} = progress, {:tactical_finished, encounter_id, outcome, voyage}, _facts) do
    cond do
      StoryTraffic.script_of(encounter_id) != :corsair_raid ->
        :ignore

      outcome == :surrender ->
        {:ok, advance(progress, 7, Map.put(progress.flags, "data_chip", true)), []}

      true ->
        rescue_failed(progress, voyage, Atom.to_string(outcome))
    end
  end

  def apply(%{step: 7} = progress, :docked_starbase, _facts),
    do: {:ok, advance(progress, 8, progress.flags), []}

  def apply(%{step: 8} = progress, {:talked, attendant_id}, _facts)
      when attendant_id in ["repair", "missions"] do
    key = if attendant_id == "repair", do: "talked_mara", else: "talked_juno"

    effects =
      if attendant_id == "repair" and progress.flags["talked_mara"] != true,
        do: [:patch_hull],
        else: []

    flags = Map.put(progress.flags, key, true)

    cond do
      flags["talked_mara"] && flags["talked_juno"] -> {:ok, advance(progress, 9, flags), effects}
      flags != progress.flags -> {:ok, %{progress | flags: flags}, effects}
      true -> :ignore
    end
  end

  def apply(_progress, _event, _facts), do: :ignore

  @doc "Cheap pre-check so channels skip events this step cannot use."
  @spec wants?(progress() | nil, atom()) :: boolean()
  def wants?(nil, _kind), do: false
  def wants?(%{skipped: true}, _kind), do: false
  def wants?(%{step: @complete}, _kind), do: false
  def wants?(%{step: step}, :flight_controls), do: step == 1
  def wants?(%{step: step}, :navigation), do: step in 3..9
  def wants?(%{step: step}, :docked), do: step == 7
  def wants?(_progress, _kind), do: false

  # -- Navigation (steps 3, 4, 5, 9 and the crate reissue) ---------------

  defp navigation(%{step: step} = progress, nav, facts) do
    crates = Map.get(facts, :crates)

    cond do
      step in 3..9 and reissue?(progress, nav, crates) ->
        {:ok, %{progress | flags: Map.put(progress.flags, "reissued", true)},
         [{:reissue, @crates - crates}]}

      step == 3 and traveling_to?(nav, "mars") ->
        {:ok, advance(progress, 4, progress.flags), []}

      step == 4 and cruising?(nav) and nav.destination_id == "mars" and
          Map.get(nav, :progress, 0.0) >= @vesper_after_progress ->
        {:ok, progress, [{:stage, :vesper_pass}]}

      step == 5 and cruising?(nav) and near_starbase?(nav) and
          nav.voyage_number != progress.flags["rescue_failed_voyage"] ->
        {:ok, %{progress | flags: Map.delete(progress.flags, "rescue_failed")},
         [{:stage, :corsair_raid}]}

      step == 9 and idle_at?(nav, "mars") and is_integer(crates) and crates >= @crates ->
        flags = progress.flags |> Map.delete("short_crates") |> Map.put("helios_license", true)
        {:ok, advance(progress, @complete, flags), [:deliver]}

      step == 9 and idle_at?(nav, "mars") and is_integer(crates) and
          progress.flags["short_crates"] != crates ->
        {:ok, %{progress | flags: Map.put(progress.flags, "short_crates", crates)}, []}

      true ->
        :ignore
    end
  end

  defp reissue?(progress, nav, crates) do
    is_integer(crates) and crates < @crates and progress.flags["consignment"] == true and
      progress.flags["reissued"] != true and idle_at?(nav, "earth")
  end

  defp traveling_to?(nav, destination),
    do: nav.status == :traveling and nav.destination_id == destination

  defp cruising?(nav) do
    nav.status == :traveling and Map.get(nav, :pending_encounter) == nil and
      Map.get(nav, :tactical_encounter) == nil and Map.get(nav, :free_flight) != true and
      Map.get(nav, :logout_paused) != true
  end

  defp idle_at?(nav, location),
    do: nav.status == :idle and nav.location_id == location

  defp near_starbase?(%{position_km: position}) when is_map(position),
    do: StoryTraffic.starbase_distance_km(position) <= @distress_radius_km

  defp near_starbase?(_nav), do: false

  defp rescue_failed(progress, voyage, reason) do
    flags =
      progress.flags
      |> Map.put("rescue_failed", reason)
      |> Map.put("rescue_failed_voyage", voyage)

    {:ok, %{progress | step: 5, flags: flags}, [:clear_story_contacts]}
  end

  defp advance(progress, step, flags), do: %{progress | step: step, flags: flags}

  defp put_if(flags, true, key), do: Map.put(flags, key, true)
  defp put_if(flags, _false, _key), do: flags

  # -- In-character prompts ----------------------------------------------

  @ross "Dispatcher Halden Ross"
  @varga "Captain Ines Varga"
  @kade "Eno Kade"
  @juno "Juno Rook"

  @doc "The one prompt for the pilot's current step (HUD and headset)."
  @spec prompt(progress()) :: map()
  def prompt(%{step: 1, flags: flags}) do
    line(
      @ross,
      "Helios dispatch, Earth orbit",
      "Morning, courier. The Sunracer is yours for this run. Bring the throttle " <>
        "up and swing the nose around so I can see the controls answer.",
      "Throttle up and turn the ship",
      checks: [check("Throttle", flags["throttle"]), check("Steering", flags["rotation"])]
    )
  end

  def prompt(%{step: 2}) do
    line(
      @ross,
      "Helios dispatch, Earth orbit",
      "Systems look clean. Three crates of medical supplies for the Mars refinery: " <>
        "routine, low pay, the run every new courier starts on.",
      "Accept the Mars consignment",
      action: %{id: "accept_consignment", label: "Accept consignment"}
    )
  end

  def prompt(%{step: 3}) do
    line(
      @ross,
      "Helios dispatch, Earth orbit",
      "Crates are aboard; they arrive with you or not at all. Open the Atlas, plot " <>
        "Earth to Mars and engage cruise. Quiet lane today. Enjoy it.",
      "Plot a course to Mars and engage cruise"
    )
  end

  def prompt(%{step: 4}) do
    line(
      @ross,
      "Helios dispatch, Earth orbit",
      "Heads up: Vesper-02 is running your lane. Captain Varga likes to say hello " <>
        "to new couriers. Hail her when she closes, then resume cruise.",
      "Hail Vesper-02, then resume cruise"
    )
  end

  def prompt(%{step: 5, flags: %{"rescue_failed" => _}}) do
    line(
      @kade,
      "Green Starbase communications",
      "Vesper-02 went dark. Corsair-17 is still hunting couriers, and Helios won't " <>
        "stop flying this lane. Cruise past the Green Starbase again and I'll call you in.",
      "Cruise past the Green Starbase to retry the rescue"
    )
  end

  def prompt(%{step: 5}) do
    line(
      @kade,
      "Green Starbase communications",
      "Any ship near the Green Starbase: Vesper-02 is under attack and you're the " <>
        "closest hull. Raider designation Corsair-17. Keep cruising; I'll vector you in.",
      "Cruise on past the Green Starbase and attack Corsair-17"
    )
  end

  def prompt(%{step: 6}) do
    line(
      @kade,
      "Green Starbase communications",
      "Keep the sight on Corsair-17 and let your shields soak the return fire. " <>
        "If it offers surrender, accept it, and seize its hold if you have the room.",
      "Bring Corsair-17 to surrender and accept it"
    )
  end

  def prompt(%{step: 7}) do
    line(
      @varga,
      "Vesper-02",
      "That was flying, rookie. I owe you one. Your hull's chewed up, though: divert to " <>
        "the Green Starbase and let Mara Venn look at it. I'll limp on to Mars.",
      "Plot to the Green Starbase, line up on the bay and hold still to dock"
    )
  end

  def prompt(%{step: 8, flags: flags}) do
    line(
      @kade,
      "Green Starbase communications",
      "Welcome aboard. Mara Venn is in the repair bay, and Juno Rook wants your " <>
        "report in the Mission Office.",
      "Talk to Mara Venn and Juno Rook",
      checks: [
        check("Mara Venn, repair bay", flags["talked_mara"]),
        check("Juno Rook, Mission Office", flags["talked_juno"])
      ]
    )
  end

  def prompt(%{step: 9, flags: %{"short_crates" => count}}) when is_integer(count) do
    line(
      @ross,
      "Helios dispatch",
      "Mars refinery counts #{count} of #{@crates} crates. Helios pays on a full " <>
        "consignment. Bring all #{@crates}; dispatch at Earth can reissue a lost load once.",
      "Deliver all #{@crates} medical crates to Mars"
    )
  end

  def prompt(%{step: 9}) do
    line(
      @juno,
      "Green Starbase Mission Office",
      "Not a word about that chip, courier. Finish your run: launch, cruise on to " <>
        "Mars and deliver those crates.",
      "Launch, cruise to Mars and deliver the #{@crates} crates"
    )
  end

  def prompt(%{step: @complete}) do
    line(
      @juno,
      "Green Starbase Mission Office",
      "First run done, and paid. Come back to the Green Starbase when you can. " <>
        "We need to talk about where that chip came from.",
      "Prologue complete. Return to the Green Starbase when Chapter 1 opens"
    )
  end

  defp line(speaker, station, text, objective, opts \\ []) do
    %{
      speaker: speaker,
      station: station,
      text: text,
      objective: objective,
      checks: Keyword.get(opts, :checks, []),
      action: Keyword.get(opts, :action)
    }
  end

  defp check(label, done), do: %{label: label, done: done == true}

  # -- Station dialogue -----------------------------------------------------

  @doc "Extra story topics an attendant offers at the pilot's current step."
  @spec topics(progress() | nil, String.t()) :: [map()]
  def topics(nil, _attendant), do: []
  def topics(%{skipped: true}, _attendant), do: []

  def topics(%{step: 8, flags: flags}, "repair") do
    if flags["talked_mara"], do: [], else: [%{id: "story", label: "Patch up the Sunracer"}]
  end

  def topics(%{step: 8, flags: flags}, "missions") do
    if flags["talked_juno"], do: [], else: [%{id: "story", label: "Report the Corsair-17 attack"}]
  end

  def topics(%{step: step}, "comms") when step in 8..@complete,
    do: [%{id: "story", label: "Any word from Vesper-02?"}]

  def topics(%{step: @complete}, "missions"),
    do: [%{id: "story", label: "About the data chip"}]

  def topics(_progress, _attendant), do: []

  @doc "The story line for a topic offered by `topics/2`, or `:error`."
  @spec dialogue(progress(), String.t()) :: {:ok, String.t()} | :error
  def dialogue(progress, attendant_id) do
    if Enum.any?(topics(progress, attendant_id), &(&1.id == "story")),
      do: {:ok, dialogue_text(progress, attendant_id)},
      else: :error
  end

  defp dialogue_text(%{step: 8}, "repair"),
    do:
      "Hold still; this is a field patch, not a refit. There: hull and shields back " <>
        "to full. Funny thing about those burn marks. They came from military-grade " <>
        "emitters. Too good for a small-time outfit like Corsair-17."

  defp dialogue_text(%{step: 8}, "missions"),
    do:
      "Corsair-17, Vesper-02, and a data chip from the raider's hold? Let me see it. " <>
        "...That's your route plan, filed with Helios dispatch before you launched. " <>
        "Somebody is selling courier routes. Say nothing about this for now. To anyone."

  defp dialogue_text(_progress, "comms"),
    do:
      "Vesper-02 pinged us from the lane: limping, but alive and headed for Mars. " <>
        "Captain Varga says to tell you she owes you a drink."

  defp dialogue_text(_progress, "missions"),
    do:
      "I'm still pulling that chip apart. Come back soon. I'll need a courier " <>
        "nobody is watching."
end
