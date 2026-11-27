defmodule Sunracer.Story.LeakedRoutes do
  @moduledoc """
  SOL chapter 1, revision 1: The Distribution List and Follow the Copy.

  Stops at step 7 pending Secure the Record. World validates contact access
  and Story settles durable effects.
  """
  @chapter "sol.leaked_routes"
  @reward "sol.leaked_routes.station_records"
  @offer "leaked_routes.offer_station_records"
  @accept "leaked_routes.accept_station_records"
  @decline "leaked_routes.decline_station_records"
  @eno "leaked_routes.station_distribution"
  @tarek "leaked_routes.exchange_reference"
  @report "leaked_routes.report_distribution"
  @follow_reward "sol.leaked_routes.follow_the_copy"
  @follow_offer "leaked_routes.offer_follow_copy"
  @dispatch "leaked_routes.dispatch_original"
  @audit "leaked_routes.clearing_audit"

  def chapter, do: @chapter
  def reward_id, do: @reward
  def offer_topic, do: @offer
  def accept_topic, do: @accept
  def decline_topic, do: @decline
  def new, do: %{chapter: @chapter, step: 1, flags: %{"revision" => 1}, skipped: false}

  def eligible?(%{step: 10, skipped: false, flags: flags}) do
    Enum.all?(["data_chip", "talked_mara", "talked_juno", "helios_license"],
      &(flags[&1] == true))
  end
  def eligible?(_), do: false

  def topics(%{skipped: true}, _), do: []
  def topics(%{step: 1}, "missions"),
    do: [%{id: @offer, label: "About the leaked route"}]
  def topics(%{step: 2, flags: flags}, "comms"),
    do: if(flags["station_distribution"], do: [],
      else: [%{id: @eno, label: "Who received our route?"}])
  def topics(%{step: 2, flags: flags}, "trade"),
    do: if(flags["exchange_reference"], do: [],
      else: [%{id: @tarek, label: "How was the route distributed?"}])
  def topics(%{step: 3}, "missions"),
    do: [%{id: @report, label: "Report the distribution list"}]
  def topics(%{step: 4, flags: %{"station_records_complete" => true}}, "missions"),
    do: [%{id: @follow_offer, label: "Follow the copy"}]
  def topics(%{step: 5, flags: %{"follow_copy_accepted" => true}}, "helios_dispatch"),
    do: [%{id: @dispatch, label: "Request original flight plan"}]
  def topics(%{step: 6, flags: %{"dispatch_original" => true}}, "venus_auditor"),
    do: [%{id: @audit, label: "Audit batch AX-41"}]
  def topics(_, _), do: []

  def local_contact(%{step: 5, skipped: false, flags: %{"follow_copy_accepted" => true}}),
    do: %{npc_id: "helios_dispatch", location_id: "earth", name: "Dispatcher Halden Ross",
      role: "Helios dispatch · Earth orbit", title: "Follow the Copy",
      message: "Helios dispatch here. What record do you need?",
      topic: @dispatch, action_label: "Request original flight plan"}
  def local_contact(%{step: 6, skipped: false, flags: %{"dispatch_original" => true}}),
    do: %{npc_id: "venus_auditor", location_id: "venus", name: "Nadia Pell",
      role: "Venus orbital freight exchange · Audit clerk", title: "Follow the Copy",
      message: "Freight exchange audit desk. Which distribution batch are you investigating?",
      topic: @audit, action_label: "Audit batch AX-41"}
  def local_contact(_), do: nil

  def local_contact_available?(%{location_id: location}, %{
        system_id: "sol", status: :idle, location_id: location,
        pending_encounter: nil, tactical_encounter: nil, free_flight: false,
        logout_paused: false}), do: true
  def local_contact_available?(_, _), do: false

  def offer_text do
    "You finished the run. Good. I checked the record from Corsair. " <>
      "They didn't guess where you'd be. Someone had your filed course before you left Earth. " <>
      "Dispatch, the freight exchange, and this station all handle parts of the same flight plan. " <>
      "That's three places to look, not three guilty parties. Eno can compare our communications record. " <>
      "Tarek knows how the commercial copies are distributed. Speak to both and bring me their references. " <>
      "Two hundred credits for the investigation. Don't pick a fight just because somebody looks guilty."
  end

  def offer_topics, do: [
    %{id: @accept, label: "Accept investigation — 200 credits"},
    %{id: @decline, label: "Not now"}
  ]

  def offer_topics(@follow_offer), do: [
    %{id: "leaked_routes.accept_follow_copy", label: "Accept assignment — 400 credits"},
    %{id: "leaked_routes.decline_follow_copy", label: "Not now"}
  ]
  def offer_topics(@offer), do: offer_topics()

  def dialogue(progress, contact, topic) do
    if Enum.any?(topics(progress, contact), &(&1.id == topic)) do
      case topic do
        @offer -> {:ok, offer_text(), nil}
        @follow_offer ->
          {:ok, "First, go to Earth and ask Ross for the original flight plan. He'll know which record you mean. " <>
            "Then take the distribution reference to Nadia Pell at the Venus freight exchange. She's a careful auditor. " <>
            "Use local ship communications at each destination, not a public channel. Four hundred credits when Nadia verifies the audit. You won't need cargo space.", nil}
        @dispatch ->
          {:ok, "Your original is still on file. Earth to Mars, three medical crates. Same route record Juno described. " <>
            "Our authorized distribution went to Green Starbase and the commercial exchange. I can confirm that, " <>
            "but I can't tell you what anybody did with a copy after it left our desk. I've released the filed record to your case.", :dispatch_original}
        @audit ->
          {:ok, "AX-41. Yes, I have the distribution entry. Your original matches. There is one separate " <>
            "access-processing charge under VX-204. I can't establish a recipient from that record. " <>
            "It was passed through a clearing account. A charge isn't proof of who received the leaked route. " <>
            "But it is a place to start looking. I'll certify the extract and confirm your assignment with Juno.", :clearing_audit}
        @eno ->
          {:ok, "Here's our station copy. It came through the usual dispatch distribution before your departure. " <>
            "No unusual source on the receipt itself. That's not enough to tell me whether somebody copied it afterward. " <>
            "I've marked the distribution record for Juno.", :station_distribution}
        @tarek ->
          {:ok, "Flight plans aren't only navigation. Cargo contracts, berth estimates and insurance depend on them. " <>
            "The commercial copy went through a licensed exchange under batch AX-41. Plenty of organizations use " <>
            "that service, including the Merchant League. Follow the batch, not the logo on the invoice.",
            :exchange_reference}
        @report ->
          {:ok, "Two legitimate copies, and neither tells us who passed the record to Corsair. Good. " <>
            "We know where to look without making accusations. Your two hundred credits are settled. " <>
            "Now we need the original from Ross and an independent audit of AX-41.", :report_distribution}
      end
    else
      :error
    end
  end

  def apply(%{skipped: true} = p, :resume), do: {:ok, %{p | skipped: false}, []}
  def apply(%{skipped: true}, _), do: :ignore
  def apply(%{step: step} = p, :skip) when step in 2..3,
    do: {:ok, %{p | skipped: true}, []}
  def apply(%{step: 1} = p, :accept_station_records),
    do: {:ok, %{p | step: 2, flags: Map.put(p.flags, "station_records_accepted", true)}, []}
  def apply(%{step: 2, flags: flags} = p, event)
      when event in [:station_distribution, :exchange_reference] do
    key = Atom.to_string(event)
    if flags[key] do
      :ignore
    else
      flags = Map.put(flags, key, true)
      step = if flags["station_distribution"] && flags["exchange_reference"], do: 3, else: 2
      {:ok, %{p | step: step, flags: flags}, []}
    end
  end
  def apply(%{step: 3, flags: %{"station_distribution" => true, "exchange_reference" => true}} = p,
            :report_distribution) do
    {:ok, %{p | step: 4, flags: Map.put(p.flags, "station_records_complete", true)},
      [{:story_credits, @reward, 200}]}
  end
  def apply(%{step: 4, flags: %{"station_records_complete" => true,
        "station_distribution" => true, "exchange_reference" => true}} = p, :accept_follow_copy),
    do: {:ok, %{p | step: 5, flags: Map.put(p.flags, "follow_copy_accepted", true)}, []}
  def apply(%{step: 5, flags: %{"follow_copy_accepted" => true}} = p, :dispatch_original),
    do: {:ok, %{p | step: 6, flags: Map.put(p.flags, "dispatch_original", true)}, []}
  def apply(%{step: 6, flags: %{"follow_copy_accepted" => true, "dispatch_original" => true}} = p,
            :clearing_audit) do
    flags = p.flags |> Map.put("clearing_audit", true) |> Map.put("follow_copy_complete", true)
    {:ok, %{p | step: 7, flags: flags}, [{:story_credits, @follow_reward, 400}]}
  end
  def apply(_, _), do: :ignore

  def public(%{step: step, skipped: skipped} = p) do
    %{chapter: @chapter, step: step, total_steps: 9, complete: false,
      skipped: skipped, can_skip: step in 2..3, license: true, reward: nil,
      prompt: if(skipped, do: nil, else: prompt(p))}
  end

  def prompt(%{step: 2, flags: flags}) do
    %{speaker: "Juno Rook", station: "Green Starbase Mission Office",
      text: "Eno has our station copy. Tarek knows the commercial exchange. Speak to both.",
      objective: "Speak to Eno Kade and Tarek Sol at Green Starbase",
      checks: [%{label: "Station distribution", done: flags["station_distribution"] == true},
               %{label: "Exchange reference", done: flags["exchange_reference"] == true}], action: nil}
  end
  def prompt(%{step: 3}) do
    %{speaker: "Juno Rook", station: "Green Starbase Mission Office",
      text: "Bring those two references back to me.",
      objective: "Report the distribution list to Juno Rook", checks: [], action: nil}
  end
  def prompt(%{step: 4}) do
    %{speaker: "Juno Rook", station: "Green Starbase Mission Office",
      text: "Distribution list recorded. Your payment is confirmed. We'll need the original dispatch record next.",
      objective: "Distribution List complete. Ask Juno about Follow the Copy", checks: [], action: nil}
  end
  def prompt(%{step: 5}) do
    %{speaker: "Juno Rook", station: "Green Starbase Mission Office",
      text: "Ross has the filed original. Contact him over local communications at Earth.",
      objective: "Travel to Earth and request the original flight plan",
      checks: [], action: %{id: "contact_story", label: "Contact Dispatcher Ross"}}
  end
  def prompt(%{step: 6}) do
    %{speaker: "Dispatcher Halden Ross", station: "Helios dispatch · Earth orbit",
      text: "The original is in your case. Nadia Pell can audit batch AX-41 at Venus.",
      objective: "Travel to Venus and contact the freight exchange auditor",
      checks: [], action: %{id: "contact_story", label: "Contact Nadia Pell"}}
  end
  def prompt(%{step: 7}) do
    %{speaker: "Nadia Pell", station: "Venus orbital freight exchange",
      text: "Audit verified. Four hundred credits settled. The clearing account is our next lead.",
      objective: "Follow the Copy complete. Await Secure the Record", checks: [], action: nil}
  end
  def prompt(_) do
    %{speaker: "Juno Rook", station: "Green Starbase Mission Office",
      text: "We need to talk about the leaked route.", objective: "Speak to Juno Rook",
      checks: [], action: nil}
  end

  def scene(%{step: 3}, %{step: 4}) do
    %{id: "leaked_routes:distribution_complete", lines: [
      %{speaker: "Juno Rook", channel: "Green Starbase Mission Office",
        text: "Distribution list recorded. Your payment is confirmed. We'll follow the copy next."}
    ]}
  end
  def scene(%{step: 6}, %{step: 7}) do
    %{id: "leaked_routes:follow_copy_complete", lines: [
      %{speaker: "Nadia Pell", channel: "Venus orbital freight exchange",
        text: "Audit verified. Four hundred credits settled. The certified record is yours."}
    ]}
  end
  def scene(_, _), do: nil
end
