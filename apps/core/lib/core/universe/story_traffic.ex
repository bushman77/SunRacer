defmodule Core.Universe.StoryTraffic do
  @moduledoc """
  Private story vessels for the "First Run" prologue (docs/story-first-run.md).

  A story vessel is staged by the server for exactly one pilot. It never
  enters the shared `Core.Universe.Traffic` map, so other pilots cannot see,
  hail, attack or seize it, and the live game's procedural raider settings
  are untouched. Navigation keeps these vessels in a per-pilot overlay and
  merges them into that pilot's sensor, hail and tactical views only.

  Story vessels hold position at the point where they were staged. They are
  short-lived scene props for one encounter hold, not scheduled traffic.

  Clients never name, position or choose a script. The story layer in the
  `darkorbit` app asks Navigation to stage one after a server-confirmed step.
  """

  alias Core.Factions
  alias Core.NPC.Catalog, as: NPCCatalog
  alias Core.Universe.GreenStarbase

  @scripts [:vesper_pass, :corsair_raid]

  @type script :: :vesper_pass | :corsair_raid

  @spec scripts() :: [script()]
  def scripts, do: @scripts

  @doc "The private contact ID of a script for one pilot."
  @spec contact_id(pos_integer(), script()) :: String.t()
  def contact_id(player_id, :vesper_pass),
    do: "traffic:sol:story:#{player_id}:vesper-02"

  def contact_id(player_id, :corsair_raid),
    do: "traffic:sol:story:#{player_id}:corsair-17"

  @doc "Which script a contact or encounter ID belongs to, if any."
  @spec script_of(term()) :: script() | nil
  def script_of(id) when is_binary(id) do
    cond do
      not String.contains?(id, "traffic:sol:story:") -> nil
      String.contains?(id, ":vesper-02") -> :vesper_pass
      String.contains?(id, ":corsair-17") -> :corsair_raid
      true -> nil
    end
  end

  def script_of(_id), do: nil

  @doc "True for any private story contact or encounter ID."
  @spec story_id?(term()) :: boolean()
  def story_id?(id), do: script_of(id) != nil

  @doc """
  Build the private vessel for `script`, offset from the pilot's current SOL
  position so it lies inside the close-pass radius. `voyage_number` is the
  pilot's voyage number, so a redo on a later voyage is a new encounter.
  """
  @spec build(pos_integer(), script(), map(), pos_integer()) :: map()
  def build(player_id, script, position_km, voyage_number)
      when script in @scripts and is_map(position_km) and
             is_integer(voyage_number) and voyage_number > 0 do
    spec = spec(script)
    ship_class = spec.ship_class

    %{
      id: contact_id(player_id, script),
      story_script: script,
      story_player_id: player_id,
      call_sign: spec.call_sign,
      kind: spec.kind,
      ship_class: ship_class,
      faction_id: spec.faction_id,
      disposition: spec.disposition,
      purpose: spec.purpose,
      state: :in_transit,
      origin_id: spec.origin_id,
      destination_id: spec.destination_id,
      location_id: nil,
      cargo: spec.cargo,
      combat: initial_condition(ship_class),
      settled_encounters: MapSet.new(),
      voyage_number: voyage_number,
      # A raider pinning Vesper-02 is attackable; Varga's courier is not.
      protected?: spec.protected?,
      surrender_at: spec.surrender_at,
      message: spec.message,
      position_km: %{
        x: position_km.x + spec.offset_km.x,
        y: position_km.y + spec.offset_km.y,
        z: position_km.z + spec.offset_km.z
      }
    }
  end

  @doc "Comms reply for a story vessel; replaces the generic traffic hail."
  @spec hail_response(map()) :: map()
  def hail_response(vessel) do
    %{
      id: vessel.id,
      call_sign: vessel.call_sign,
      ship_class: vessel.ship_class,
      faction_id: vessel.faction_id,
      faction_name: Factions.name(vessel.faction_id) || "Unregistered Organization",
      disposition: vessel.disposition,
      origin_id: vessel.origin_id,
      destination_id: vessel.destination_id,
      purpose: vessel.purpose,
      state: vessel.state,
      cargo: vessel.cargo,
      message: vessel.message
    }
  end

  @doc "Distance from a SOL position to the Green Starbase, in game km."
  @spec starbase_distance_km(map()) :: float()
  def starbase_distance_km(position) when is_map(position) do
    center = GreenStarbase.position_km()

    :math.sqrt(
      :math.pow(position.x - center.x, 2) +
        :math.pow(position.y - center.y, 2) +
        :math.pow(position.z - center.z, 2)
    )
  end

  defp spec(:vesper_pass) do
    %{
      call_sign: "Vesper-02",
      kind: :courier,
      ship_class: "scow",
      faction_id: "helios_couriers",
      disposition: :neutral,
      purpose: :express_delivery,
      origin_id: "earth",
      destination_id: "mars",
      cargo: %{"medical_supplies" => 48, "civilian_mail" => 120},
      protected?: true,
      surrender_at: nil,
      offset_km: %{x: 180_000.0, y: -120_000.0, z: 25_000.0},
      message:
        "Vesper-02, Captain Ines Varga, Helios Couriers. Welcome to the lane, " <>
          "rookie. Same run as you, Earth to Mars. Keep your eyes open past the " <>
          "starbase; somebody has been picking at our couriers out there."
    }
  end

  defp spec(:corsair_raid) do
    %{
      call_sign: "Corsair-17",
      kind: :raider,
      ship_class: "dart",
      faction_id: "independent_raiders",
      disposition: :hostile,
      purpose: :intercept_traffic,
      origin_id: "deep_space",
      destination_id: "mars",
      # Stolen from Vesper-02; seized as real cargo on surrender.
      cargo: %{"civilian_mail" => 40},
      protected?: false,
      # Tuned to be beatable: it gives up at half hull.
      surrender_at: 0.5,
      offset_km: %{x: -140_000.0, y: 160_000.0, z: -20_000.0},
      message:
        "Corsair-17. This isn't your fight, courier. Turn around and keep " <>
          "your little Sunracer in one piece."
    }
  end

  defp initial_condition(ship_class) do
    definition = NPCCatalog.fetch!(ship_class)

    %{
      hull: definition.max_hull,
      max_hull: definition.max_hull,
      shields: definition.max_shields,
      max_shields: definition.max_shields,
      status: :alive
    }
  end
end
