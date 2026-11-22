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

test("mouse neutral immediately stops yaw without an overshooting tail", () => {
  const camera=new ClientLedMouseCamera()
  camera.begin(identity)
  for(let i=0;i<20;i++)camera.advance({yaw:1},1/60)
  const before=yaw(camera.orientation)
  camera.advance({yaw:0},1/60)
  approx(yaw(camera.orientation),before)
  camera.advance({yaw:0},1/60)
  approx(yaw(camera.orientation),before)
  assert.equal(camera.rates.yaw,0)
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
