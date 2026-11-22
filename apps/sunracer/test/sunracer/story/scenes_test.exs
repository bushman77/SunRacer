defmodule Sunracer.Story.ScenesTest do
  use ExUnit.Case, async: true

  alias Sunracer.Story.Scenes

  defp progress(step, flags \\ %{}, skipped \\ false),
    do: %{step: step, flags: flags, skipped: skipped}

  test "the nine verified First Run advances emit complete scripted comms" do
    ids = [
      "systems_green", "consignment_loaded", "outbound_lane",
      "vesper_distress", "corsair_challenge", "vesper_rescued",
      "station_debrief", "return_to_route", "first_run_complete"
    ]

    for {id, step} <- Enum.with_index(ids, 1) do
      assert %{id: scene_id, lines: lines} =
               Scenes.on_transition(progress(step), progress(step + 1))
      assert scene_id == "first_run:" <> id
      assert length(lines) in 1..3
      for %{speaker: speaker, channel: channel, text: words} <- lines do
        assert String.length(speaker) > 2
        assert String.length(channel) > 2
        assert String.length(words) > 30
      end
    end
  end

  test "repeated and skipped updates cannot emit fresh transmissions" do
    assert nil == Scenes.on_transition(progress(5), progress(5))
    assert nil == Scenes.on_transition(progress(2), progress(3, %{}, true))
    assert nil == Scenes.on_transition(progress(8), progress(8, %{"talked_mara" => true}))
    assert nil == Scenes.on_transition(progress(10), progress(10))
  end

  test "failed rescue supplies a distinct retry transmission" do
    assert %{id: "first_run:rescue_retry", lines: [line]} =
             Scenes.on_transition(progress(6),
               progress(5, %{"rescue_failed" => "retreat"}))
    assert line.speaker == "Eno Kade"
    assert line.text =~ "retreat"
  end
end
