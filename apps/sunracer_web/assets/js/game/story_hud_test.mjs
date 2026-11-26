import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {StoryHud, storyHudModel} from "./story_hud.mjs"

const read = name => readFileSync(new URL(name, import.meta.url), "utf8")

const story = (attrs = {}) => ({
  chapter: "prologue", step: 2, total_steps: 9, complete: false, skipped: false,
  license: false, reward: null,
  prompt: {
    speaker: "Dispatcher Halden Ross", station: "Helios dispatch, Earth orbit",
    text: "Systems look clean.", objective: "Contact Dispatcher Ross to receive your first mission",
    checks: [{label: "Throttle", done: true}, {label: "Steering", done: false}],
    action: {id: "contact_dispatch", label: "Contact Dispatcher Ross"},
  },
  ...attrs,
})

test("the model renders one prompt with its step, checks and offered action", () => {
  const model = storyHudModel(story())
  assert.equal(model.visible, true)
  assert.equal(model.stepLabel, "FIRST RUN · 2 / 9")
  assert.equal(model.speaker, "Dispatcher Halden Ross")
  assert.deepEqual(model.checks, [{label: "Throttle", done: true}, {label: "Steering", done: false}])
  assert.deepEqual(model.action, {id: "contact_dispatch", label: "Contact Dispatcher Ross"})
  assert.equal(model.stereoLine, "OBJ · CONTACT DISPATCHER ROSS TO RECEIVE YOUR FIRST MISSION")
  assert.equal(model.canSkip, true)
})

test("unknown server actions are never offered as buttons", () => {
  const model = storyHudModel(story({prompt: {...story().prompt, action: {id: "pay_me", label: "Pay"}}}))
  assert.equal(model.action, null)
})

test("skipped and missing stories hide the card; skipped offers resume", () => {
  assert.deepEqual(storyHudModel(null), {visible: false, resumeVisible: false, stereoLine: null})
  const skipped = storyHudModel(story({skipped: true, prompt: null}))
  assert.equal(skipped.visible, false)
  assert.equal(skipped.resumeVisible, true)
  assert.equal(skipped.stereoLine, null)
})

test("completion shows the reward and no skip", () => {
  const model = storyHudModel(story({
    step: 9, complete: true, license: true, reward: {credits: 500},
    prompt: {speaker: "Juno Rook", text: "First run done.", objective: "Prologue complete"},
  }))
  assert.equal(model.stepLabel, "FIRST RUN · COMPLETE")
  assert.equal(model.reward, "+500 credits · Helios courier license")
  assert.equal(model.canSkip, false)
  assert.equal(model.stereoLine, "STORY · PROLOGUE COMPLETE")
})

test("choices go to the server once at a time and adopt its reply", () => {
  const sent = []
  let handlers = {}
  const push = {receive(kind, fn) { handlers[kind] = fn; return push }}
  const hud = new StoryHud(null, action => { sent.push(action); return push })
  hud.apply(story())
  hud.choose("contact_dispatch")
  hud.choose("contact_dispatch")
  assert.deepEqual(sent, ["contact_dispatch"])
  handlers.ok({story: story({step: 3, prompt: {...story().prompt, action: null,
    objective: "Plot a course to Mars"}})})
  assert.equal(hud.model.stepLabel, "FIRST RUN · 3 / 9")
  assert.equal(hud.model.action, null)
  hud.choose("launch_missiles")
  assert.deepEqual(sent, ["contact_dispatch"])
})

test("cockpit markup, client wiring and the stereo HUD line are present", () => {
  const markup = read("../../../lib/sunracer_web/controllers/game_html/show.html.heex")
  const client = read("./client.js")
  const stereo = read("./stereo_view.js")
  for (const id of ["story-comms", "story-comms-text", "story-comms-objective",
                    "story-comms-action", "story-comms-skip", "story-comms-resume"]) {
    assert.match(markup, new RegExp(`id="${id}"`))
  }
  assert.match(client, /channel\.on\("story_updated"/)
  assert.match(client, /this\.channel\.push\("story_action", \{action\}/)
  assert.match(client, /this\.channel\.push\("story_dispatch_offer", \{\}/)
  assert.match(client, /this\.channel\.push\("story_dispatch_accept", \{\}/)
  assert.match(client, /this\.channel\.push\("story_dispatch_decline", \{\}/)
  assert.match(markup, /id="story-dispatch-dialogue"/)
  assert.match(markup, /id="story-dispatch-accept"/)
  assert.match(markup, /id="story-dispatch-decline"/)
  assert.match(stereo, /dashboardModel\(client,/)
  assert.match(read("./cockpit_dashboard.mjs"), /client\?\.storyHud\?\.stereoLine/)
  const helmet = read("./helmet_client.mjs")
  assert.match(helmet, /channel\.on\("helmet_story"/)
  assert.doesNotMatch(helmet, /story_action/)
})

test("the headset payload (prompt without action) still yields the HUD line", () => {
  const model = storyHudModel({step: 4, complete: false,
    prompt: {speaker: "Ross", text: "Heads up", objective: "Hail Vesper-02, then resume cruise",
             checks: []}})
  assert.equal(model.stereoLine, "OBJ · HAIL VESPER-02, THEN RESUME CRUISE")
})
