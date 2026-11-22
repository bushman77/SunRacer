import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {StoryRadio, validScene} from "./story_radio.mjs"

const scene = id => ({
  id: "first_run:" + id,
  lines: [
    {speaker: "Corsair-17", channel: "Raider open channel", text: "Leave Vesper alone."},
    {speaker: "Eno Kade", channel: "Green Starbase tactical", text: "Stay outside its guns."},
  ],
})

test("only structured story transmissions can be queued", () => {
  assert.equal(validScene(scene("corsair")), true)
  assert.equal(validScene(null), false)
  assert.equal(validScene({...scene("corsair"), id: "other"}), false)
  assert.equal(validScene({...scene("corsair"), lines: []}), false)
  assert.equal(validScene({...scene("corsair"), lines: [{speaker: "", text: "bad"}]}), false)
})

test("nonblocking dialogue advances one line and one scene at a time", () => {
  const radio = new StoryRadio(null)
  radio.receive(scene("corsair"))
  radio.receive(scene("vesper"))
  assert.equal(radio.current.id, "first_run:corsair")
  assert.equal(radio.queue.length, 1)
  radio.next()
  assert.equal(radio.lineIndex, 1)
  radio.next()
  assert.equal(radio.current.id, "first_run:vesper")
  radio.dismiss()
  assert.equal(radio.current, null)
  radio.receive({id: "nope", lines: []})
  assert.equal(radio.current, null)
})

test("server story transitions control the radio, not the client mission HUD", () => {
  const client = readFileSync(new URL("./client.js", import.meta.url), "utf8")
  const markup = readFileSync(new URL(
    "../../../lib/sunracer_web/controllers/game_html/show.html.heex", import.meta.url),
  "utf8")
  assert.match(client, /channel\.on\("story_updated", story =>/)
  assert.match(client, /this\.storyRadio\?\.receive\(story\?\.scene\)/)
  assert.match(client, /surrendered && this\.storyStep === 6/)
  assert.match(markup, /id="story-radio"/)
  assert.match(markup, /id="story-radio-next"/)
  assert.match(markup, /id="story-radio-dismiss"/)
})
