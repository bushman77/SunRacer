import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {ClientLedMouseCamera, LOCAL_CAMERA_SNAP_DEGREES,
  LOCAL_CAMERA_MAX_STEP_SECONDS, preferClientLedCamera} from "./client_led_mouse_camera.mjs"
import {fromAngles} from "./own_ship_prediction.mjs"
import {orientationTelemetry} from "./orientation_interpolation.mjs"

const identity={x:0,y:0,z:0,w:1}
const yaw = q => orientationTelemetry(q).yaw
const read = p => readFileSync(new URL(p,import.meta.url),"utf8")
const approx=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} vs ${b}`)

test("client camera advances steadily across server tick boundaries WITHOUT a rebase", () => {
  const camera=new ClientLedMouseCamera()
  assert.equal(camera.begin(identity,{yaw:0,pitch:0,roll:0}),true)
  const values=[]
  for(let frame=0;frame<70;frame++) {
    camera.advance({yaw:0.5,pitch:0,roll:0},1/60)
    values.push(yaw(camera.orientation))
    if(frame % 6 === 0) {
      // Delayed authoritative pose may be behind; observing it does not
      // alter our visual camera baseline while the mouse is captured.
      assert.equal(camera.shouldSnap(fromAngles({yaw:values.at(-1)-0.025})),false)
    }
  }
  for(let i=1;i<values.length;i++)assert.ok(values[i]>values[i-1],
    "same-direction turning must never back-step on a tick")
})

test("neutral brakes locally without resetting accumulated turn rate", () => {
  const camera=new ClientLedMouseCamera()
  camera.begin(identity)
  for(let i=0;i<20;i++)camera.advance({yaw:1},1/60)
  const priorRate=camera.rates.yaw
  const priorYaw=yaw(camera.orientation)
  camera.advance({yaw:0},1/60)
  assert.ok(yaw(camera.orientation)>priorYaw)
  assert.ok(camera.rates.yaw>0)
  assert.ok(camera.rates.yaw<priorRate)
  camera.advance({yaw:1},1/60)
  assert.ok(camera.rates.yaw>0,"same-tick movement resumes from existing rate")
  for(let i=0;i<25;i++)camera.advance({yaw:0},1/60)
  assert.equal(camera.rates.yaw,0)
  camera.reset()
  assert.equal(camera.active,false)
})

test("reversal changes angular velocity and does not teleport orientation", () => {
  const camera=new ClientLedMouseCamera()
  camera.begin(identity)
  for(let i=0;i<30;i++)camera.advance({yaw:1},1/60)
  const before=yaw(camera.orientation)
  camera.advance({yaw:-1},1/60)
  const after=yaw(camera.orientation)
  assert.ok(Math.abs(after-before)<0.1)
  for(let i=0;i<40;i++)camera.advance({yaw:-1},1/60)
  assert.ok(yaw(camera.orientation)<after)
})

test("large divergence is detectable; explicit transition resets still take effect", () => {
  const camera=new ClientLedMouseCamera()
  camera.begin(identity)
  camera.advance({yaw:1},1/60)
  assert.ok(LOCAL_CAMERA_SNAP_DEGREES<90)
  assert.equal(camera.shouldSnap(fromAngles({yaw:Math.PI})),true)
  assert.equal(camera.shouldSnap(camera.orientation),false)
  camera.reset()
  assert.equal(camera.active,false)
  camera.begin(fromAngles({yaw:Math.PI/4}))
  approx(yaw(camera.orientation),Math.PI/4)
  assert.equal(LOCAL_CAMERA_MAX_STEP_SECONDS,0.05)
})

test("native visual steering defaults to client-led, and explicit opt-out persists", () => {
  assert.equal(preferClientLedCamera(null,true),true)
  assert.equal(preferClientLedCamera(null,false),false)
  assert.equal(preferClientLedCamera("0",true),false)
  assert.equal(preferClientLedCamera("1",false),true)
  assert.equal(preferClientLedCamera("1",true),true)
  const client=read("./client.js")
  assert.match(client,/this\.clientLedCameraEnabled = preferClientLedCamera\(/)
  assert.match(client,/root\.dataset\.nativeClient === "true"/)
})

test("ordinary server ticks cannot forcibly rewind active client-led camera", () => {
  const client=read("./client.js")
  const tick=client.slice(client.indexOf("if (fromWorldTick && this.clientLedCameraActiveForTick()"),
    client.indexOf("if (snap || entity.status === \"destroyed\")"))
  assert.match(tick,/this\.clientLedCameraDelta = this\.clientLedCamera\.divergenceDegrees\(orientation\)/)
  assert.match(tick,/this\.clientLedCameraServerAlert = this\.clientLedCamera\.shouldSnap\(orientation\)/)
  assert.doesNotMatch(tick,/this\.clientLedCamera\.reset\(\)/)
  assert.doesNotMatch(tick,/existing\.renderOrientation =/)
  assert.match(client,/\(entity\.destination && !this\.clientLedCameraActiveForTick\(\)\)/)
  assert.match(client,/if \(snap \|\| entity\.status === "destroyed"\)/)
})

test("client-led desktop mode never changes Phoenix controls, SBS relay or authoritative updates", () => {
  const client=read("./client.js")
  const view=read("../../../lib/sunracer_web/controllers/game_html/show.html.heex")
  assert.match(view,/id="cockpit-client-led-mouse-camera"/)
  assert.match(client,/this\.clientLedCamera = new ClientLedMouseCamera\(\)/)
  assert.match(client,/this\.clientLedCameraEnabled = preferClientLedCamera\(/)
  assert.match(client,/this\.clientLedMouseCameraActive\(\)/)
  assert.match(client,/this\.clientLedCamera\.advance\(this\.flightControls\.axes\(\), deltaSeconds/)
  assert.match(client,/entity\.renderOrientation = \{\.\.\.this\.clientLedCamera\.orientation\}/)
  assert.match(client,/!this\.clientLedCameraActiveForTick\(\)/)
  assert.match(client,/this\.clientLedCamera\.shouldSnap\(orientation\)/)
  assert.match(client,/this\.channel\.push\("flight_controls", input, 3000\)/)
  assert.match(client,/this\.sbsRelayWorld\.publish\(this\.worldStream\.map, false, visual\)/)
})

test("local camera drift from the server is bounded, and corrected invisibly", async () => {
  const {LOCAL_CAMERA_CORRECTION_SECONDS} = await import("./client_led_mouse_camera.mjs")
  assert.equal(LOCAL_CAMERA_CORRECTION_SECONDS, 1.5)
  const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(
    a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w))) * 180 / Math.PI
  // Simulate a small, persistent integration mismatch: each frame the local
  // camera gains 0.02 deg of yaw the server never makes (different timing).
  const run = correct => {
    const camera = new ClientLedMouseCamera()
    camera.begin(identity)
    let worstStep = 0
    for (let frame = 0; frame < 60 * 30; frame++) {
      const before = {...camera.orientation}
      camera.orientation = normalizeQ(multiplyQ(camera.orientation, fromAngles(
        {yaw: 0.02 * Math.PI / 180, pitch: 0, roll: 0})))
      if (correct) camera.correctToward(identity, 1 / 60)
      worstStep = Math.max(worstStep, angle(before, camera.orientation))
    }
    return {drift: angle(identity, camera.orientation), worstStep}
  }
  const without = run(false)
  const withCorrection = run(true)
  // Uncorrected drift keeps growing: 30 s -> ~36 degrees.
  assert.ok(without.drift > 30, `uncorrected ${without.drift}`)
  // Corrected drift settles near 0.02 * 60 * 1.5 = ~1.8 degrees and the
  // correction never moves the view more than the mismatch itself per frame.
  assert.ok(withCorrection.drift < 2, `corrected ${withCorrection.drift}`)
  assert.ok(withCorrection.worstStep <= 0.021, `step ${withCorrection.worstStep}`)
  // Inactive camera ignores corrections.
  assert.equal(new ClientLedMouseCamera().correctToward(identity, 1 / 60), null)
})

test("client feeds the server-replayed reference into the local camera", () => {
  const client = read("./client.js")
  assert.match(client, /this\.clientLedCamera\.correctToward\(reference, deltaSeconds\)/)
  assert.match(client, /const reference = predictOrientation\(own\.orientation, own\.angularVelocity,/)
})

const multiplyQ = (a, b) => ({
  x: a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
  y: a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
  z: a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
  w: a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
})
const normalizeQ = q => {
  const n = Math.hypot(q.x, q.y, q.z, q.w)
  return {x: q.x/n, y: q.y/n, z: q.z/n, w: q.w/n}
}
