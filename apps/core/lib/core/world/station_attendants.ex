defmodule Core.World.StationAttendants do
  @moduledoc """
  Scripted, stationary station personnel. These are conversational service
  contacts, NOT tactical NPC ships. All interaction eligibility is checked
  against a MapServer-owned pilot position and authenticated docked ship.

  Dialogue is read-only. Repair is a separate authenticated service action.
  """

  @interaction_radius 12.0
  @contacts [
    %{
      id: "repair", room_id: "repair_bay", name: "Mara Venn",
      role: "Repair Engineer", x: -49.0, z: -143.0, color: 0x68b98a,
      greeting: "Welcome to Repairs. I inspect hull integrity and shield condition before authorizing any work.",
      topics: [
        %{id: "condition", label: "Inspect my ship's condition"},
        %{id: "repair", label: "Restore hull and shields (complimentary)"},
        %{id: "work", label: "How will repairs work?"}
      ],
      responses: %{
        "work" => "During station commissioning, hull and shield repairs are complimentary. I can restore your docked ship here; no credits are deducted.",
        "repair" => "Mara can restore your docked hull and shields. No credits are charged."
      }
    },
    %{
      id: "trade", room_id: "trade_exchange", name: "Tarek Sol",
      role: "Trade Broker", x: 49.0, z: -143.0, color: 0x56bbcb,
      greeting: "This is the Trade Exchange. Cargo comes and goes with our visiting traders.",
      topics: [
        %{id: "console", label: "Open trade console"},
        %{id: "market", label: "What goods do you trade?"},
        %{id: "prices", label: "Can I see live prices?"}
      ],
      responses: %{
        "console" => "Opening the trading desk. I buy any legal cargo in your hold, and sell common goods from our own stock. Every trade is settled against your verified credits.",
        "market" => "I'll take anything you bring in: ore, mail, salvage, research data. I only stock common goods myself: methane, hydrogen cells, titanium, parts, brandy, refined minerals and dilithium.",
        "prices" => "Prices are fixed by the exchange and posted on the trading desk. What I sell always costs more than what I pay, so the profit is in what you bring me."
      }
    },
    %{
      id: "outfitting", room_id: "outfitting", name: "Ilya Quill",
      role: "Ship Outfitter", x: -49.0, z: -181.0, color: 0xb7c86b,
      greeting: "Outfitting counter. Weapons, shields, generators, and equipment belong on the right mounting points.",
      topics: [
        %{id: "console", label: "Open outfitting console"},
        %{id: "equipment", label: "What equipment can I install?"},
        %{id: "fitting", label: "How do fittings work?"}
      ],
      responses: %{
        "console" => "Opening the authenticated outfitting console. Bring owned lasers, speed generators, or shield generators; purchases are made at the outfitting counter using verified credits.",
        "equipment" => "I can fit gear you already own: lasers, shield generators, and speed generators. Your ship's hardpoints determine how many are available.",
        "fitting" => "Both configurations are saved separately. I check berth, station position, inventory ownership, and each hull's hardpoint capacity before installing or removing gear."
      }
    },
    %{
      id: "resupply", room_id: "resupply", name: "Sera Vale",
      role: "Supply Officer", x: 49.0, z: -181.0, color: 0x86c775,
      greeting: "Supply depot. We provision spacecraft for the next run.",
      topics: [
        %{id: "stock", label: "What supplies are available?"},
        %{id: "replenish", label: "Can you replenish my ship?"}
      ],
      responses: %{
        "stock" => "This depot will distribute consumables, ammunition, and other stocked provisions as each system becomes available.",
        "replenish" => "Automatic replenishment is not commissioned yet. Nothing will be deducted from your account or applied to your ship."
      }
    },
    %{
      id: "missions", room_id: "mission_office", name: "Juno Rook",
      role: "Mission Liaison", x: -16.0, z: -211.0, color: 0x8ca8dd,
      greeting: "Mission Office. Juno Rook here. Finish your current story assignment before we discuss any further contracts.",
      topics: [
        %{id: "contracts", label: "Do you have any assignments?"},
        %{id: "rewards", label: "How are rewards handled?"}
      ],
      responses: %{
        "contracts" => "We'll finish the First Run and subsequent storyline one assignment at a time. Extra contracts are not live yet. All future missions must be issued through NPC dialogue here; a station approach doesn't authorize them.",
        "rewards" => "Bounties and mission rewards must be credited by the server after the objectives are verified. No reward can be claimed through dialogue alone."
      }
    },
    %{
      id: "comms", room_id: "communications", name: "Eno Kade",
      role: "Communications Officer", x: 16.0, z: -211.0, color: 0x69c9c5,
      greeting: "Communications desk. I handle station notices, contacts, and operational information.",
      topics: [
        %{id: "contacts", label: "How do I contact other ships?"},
        %{id: "station", label: "Tell me about this starbase"}
      ],
      responses: %{
        "contacts" => "Use your ship's communication systems when you launch. A station contact directory will appear here after its network integration is complete.",
        "station" => "You're inside Green Starbase in the SOL system. The main hangar connects through an airlock to the concourse, trading offices, maintenance, and ship services."
      }
    }
  ]

  @doc "Stable lightweight roster replicated once with the world snapshot."
  def public do
    Enum.map(@contacts, fn entry ->
      Map.take(entry, [:id, :room_id, :name, :role, :x, :z, :color])
    end)
  end

  @doc "Validate room, distance and topic, then return scripted dialogue."
  def talk(pose, ship, attendant_id, topic)
      when is_binary(attendant_id) and is_binary(topic) do
    case Enum.find(@contacts, &(&1.id == attendant_id)) do
      nil -> {:error, :unknown_station_attendant}
      attendant -> talk_to(attendant, pose, ship, topic)
    end
  end
  def talk(_pose, _ship, _attendant_id, _topic),
    do: {:error, :invalid_station_dialogue}

  defp talk_to(attendant, %{room_id: room_id, x: x, z: z}, ship, topic)
       when is_number(x) and is_number(z) do
    dist2 = :math.pow(x - attendant.x, 2) + :math.pow(z - attendant.z, 2)
    cond do
      room_id != attendant.room_id or dist2 > @interaction_radius * @interaction_radius ->
        {:error, :station_attendant_out_of_range}

      topic != "greeting" and not Enum.any?(attendant.topics, &(&1.id == topic)) ->
        {:error, :invalid_station_topic}

      true ->
        message =
          case {attendant.id, topic} do
            {_, "greeting"} -> attendant.greeting
            {"repair", "condition"} ->
              "Your docked ship reports hull #{ship.hull}/#{ship.max_hull} and shields #{ship.shields}/#{ship.max_shields}. This is a live inspection; no repairs have been performed."
            _ -> Map.fetch!(attendant.responses, topic)
          end

        {:ok, %{
          attendant_id: attendant.id,
          name: attendant.name,
          role: attendant.role,
          room_id: attendant.room_id,
          message: message,
          topics: attendant.topics
        }}
    end
  end
  defp talk_to(_attendant, _pose, _ship, _topic),
    do: {:error, :station_attendant_out_of_range}
end
