defmodule Sunracer.Story.Scenes do
  @moduledoc """
  Original, read-only First Run radio drama.

  The story store emits one scene only for a committed change of step.
  Neither a browser command nor a repeated tick may manufacture a scene.
  This module does not award credits, stage enemies or alter mission progress.
  """

  @spec on_transition(map(), map()) :: map() | nil
  def on_transition(%{step: old}, %{step: new, skipped: false} = progress)
      when old != new do
    case {old, new} do
      {1, 2} ->
        scene("systems_green", [
          line("Dispatcher Halden Ross", "Helios dispatch",
            "Controls confirmed. That ship answers its pilot. Come onto my " <>
              "channel; I've got your first paid assignment.")
        ])

      {2, 3} ->
        scene("consignment_loaded", [
          line("Dispatcher Halden Ross", "Helios dispatch",
            "Three sealed medical crates are aboard. Mars refinery is waiting. " <>
              "The whole consignment has to make it there for you to get paid. " <>
              "Plot Mars on your Atlas and take your time.")
        ])

      {3, 4} ->
        scene("outbound_lane", [
          line("Dispatcher Halden Ross", "Helios dispatch",
            "Mars course registered. Vesper-02 is working your lane. " <>
              "Captain Ines Varga knows this route better than I do. " <>
              "Hail her when she comes into range.")
        ])

      {4, 5} ->
        scene("vesper_distress", [
          line("Captain Ines Varga", "Vesper-02 · emergency channel",
            "Mayday, Green Starbase! Vesper-02 taking fire. They've hit our " <>
              "drives, and they're coming back for the cargo. Request assistance!"),
          line("Eno Kade", "Green Starbase communications",
            "Vesper-02's signal is breaking up. A raider called Corsair-17 " <>
              "is on her tail. You're our nearest hull, courier. " <>
              "I'll vector you in as you close with the starbase.")
        ])

      {5, 6} ->
        scene("corsair_challenge", [
          line("Corsair-17", "Unregistered raider · open channel",
            "You've wandered into the wrong fight, courier. That vessel owes " <>
              "us something. Turn your Sunracer around before you're wreckage too."),
          line("Eno Kade", "Green Starbase tactical",
            "That's Corsair-17. Your beam outranges the Dart. Stay beyond " <>
              "its guns, watch your hull, and listen for a surrender signal.")
        ])

      {6, 7} ->
        scene("vesper_rescued", [
          line("Corsair-17", "Raider surrender signal",
            "Enough! We're standing down. Keep the cargo if you want it. " <>
              "Just don't finish us off."),
          line("Captain Ines Varga", "Vesper-02 · secure channel",
            "That was some flying, rookie. You bought us a way out. " <>
              "I'll limp to Mars. Get that Sunracer to Green Starbase and " <>
              "let Mara inspect whatever those raiders were shooting.")
        ])

      {7, 8} ->
        scene("station_debrief", [
          line("Eno Kade", "Green Starbase internal communications",
            "Welcome aboard. Mara's in the repair bay. Have her check those " <>
              "burns first. Then take the Corsair report to Juno Rook.")
        ])

      {8, 9} ->
        scene("return_to_route", [
          line("Juno Rook", "Green Starbase Mission Office",
            "The route evidence from Corsair matches your filed flight plan. " <>
              "They knew where you would be before you left Earth. " <>
              "I'll look into it. Finish your Mars consignment and say nothing.")
        ])

      {9, 10} ->
        scene("first_run_complete", [
          line("Dispatcher Halden Ross", "Helios dispatch · Mars refinery",
            "Consignment received. Three medical crates verified. " <>
              "Five hundred credits paid and your Helios courier license filed. " <>
              "Welcome aboard, pilot."),
          line("Juno Rook", "Green Starbase · encrypted channel",
            "When you're ready, come back. We need to find out " <>
              "who gave Corsair your route.")
        ])

      {6, 5} ->
        reason = Map.get(progress.flags, "rescue_failed", "unresolved")
        scene("rescue_retry", [
          line("Eno Kade", "Green Starbase communications",
            "Vesper's rescue is unresolved (" <> to_string(reason) <> "). " <>
              "The raider has withdrawn for now. Regroup; we'll try " <>
              "another intercept on a later voyage past the station.")
        ])

      _ ->
        nil
    end
  end

  def on_transition(_, _), do: nil

  defp scene(id, lines), do: %{id: "first_run:" <> id, lines: lines}
  defp line(speaker, channel, text),
    do: %{speaker: speaker, channel: channel, text: text}
end
