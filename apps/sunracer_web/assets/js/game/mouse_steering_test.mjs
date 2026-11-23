import test from "node:test"
import assert from "node:assert/strict"
import {
  MouseSteering, mouseSteeringAxes, MOUSE_STEERING_IDLE_MS,
  MOUSE_STEERING_FAST_STOP_MS, MOUSE_STEERING_MIN_STOP_MS,
  MOUSE_STEERING_SAMPLE_MS, MOUSE_STEERING_INTENT_MS,
  MOUSE_STEERING_DEFAULT_SENSITIVITY, MOUSE_STEERING_PIXELS_PER_AXIS,
  validMouseSensitivity, enabledMouseSteering, calibratedMouseSensitivity,
  MOUSE_STEERING_JITTER_BAND, MOUSE_STEERING_JITTER_FILTER,
  MOUSE_STEERING_AXIS_GAP_MS,
} from "./mouse_steering.mjs"
import {FlightControls} from "./flight_controls.mjs"

test("native default and saved opt-out are preserved", () => {
  assert.equal(enabledMouseSteering(null, true), true)
  assert.equal(enabledMouseSteering(null, false), false)
  assert.equal(enabledMouseSteering("0", true), false)
  assert.equal(enabledMouseSteering("1", false), true)
})

test("mouse mapping remains proportional, bounded, and sensitivity-adjustable", () => {
  assert.equal(MOUSE_STEERING_DEFAULT_SENSITIVITY, 1.5)
  assert.equal(MOUSE_STEERING_PIXELS_PER_AXIS, 10)
  assert.equal(mouseSteeringAxes(2,-2).yaw,0.2)
  assert.deepEqual(mouseSteeringAxes(10,-10),{yaw:1,pitch:1})
  assert.deepEqual(mouseSteeringAxes(-10,10),{yaw:-1,pitch:-1})
  assert.deepEqual(mouseSteeringAxes(0,0),{yaw:0,pitch:0})
  assert.deepEqual(mouseSteeringAxes(2000,-2000),{yaw:1,pitch:1})
  assert.equal(mouseSteeringAxes(7,0,2).yaw,1)
  assert.ok(Math.abs(mouseSteeringAxes(5.5,0,0.4).yaw-0.22)<1e-10)
  assert.ok(mouseSteeringAxes(2,0,10).yaw>0.7)
  assert.ok(mouseSteeringAxes(2,0,10).yaw<1)
  assert.equal(mouseSteeringAxes(5.5,0,Infinity).yaw,0.55)
  assert.equal(validMouseSensitivity(10),true)
  assert.equal(validMouseSensitivity(10.1),false)
  assert.equal(validMouseSensitivity(0.39),false)
  assert.ok(calibratedMouseSensitivity(10)<4)
  assert.equal(calibratedMouseSensitivity(1.5),1.5)
  assert.ok(calibratedMouseSensitivity(10)>calibratedMouseSensitivity(5))
  assert.equal(mouseSteeringAxes(1,0,0.4).yaw,0.04)
})

test("held mouse intention is stable between input windows, like a held key", () => {
  let time=1000
  const mouse=new MouseSteering({now:()=>time})
  const start=mouse.move(4,0)
  assert.equal(start.yaw,0.6)
  assert.equal(MOUSE_STEERING_INTENT_MS,40)
  for(const step of [8,16,24,32]) {
    time=1000+step
    assert.deepEqual(mouse.move(1,0),start,
      "individual pointer packets must NOT change the commanded yaw")
  }
  time=1040
  const sampled=mouse.move(1,0)
  assert.ok(sampled.yaw>0)
  assert.notEqual(sampled.yaw,start.yaw,
    "a completed input window updates the held command")
  time=1048
  assert.deepEqual(mouse.move(1,0),sampled)
})

test("equal physical movement speed yields the same steady intent at 30/60/120Hz", () => {
  assert.equal(MOUSE_STEERING_SAMPLE_MS,16)
  for(const [interval,delta] of [[8,2],[16,4],[32,8]]) {
    let time=1000
    const mouse=new MouseSteering({now:()=>time,sensitivity:1.5})
    mouse.move(delta,0)
    for(let i=0;i<24;i++) {
      time+=interval
      mouse.move(delta,0)
    }
    assert.ok(Math.abs(mouse.axes().yaw-0.6)<0.09,
      `rate ${interval}ms emitted ${mouse.axes().yaw}, expected about 0.6`)
  }
})

test("alternating single-axis packets preserve continuous diagonal yaw and pitch", () => {
  let time=1000
  const mouse=new MouseSteering({now:()=>time,sensitivity:1.5})
  mouse.move(2,-2)
  const yaw=[]
  const pitch=[]
  for(let n=0;n<50;n++) {
    time+=8
    const axes=mouse.move(n%2===0?0:2,n%2===0?-2:0)
    yaw.push(axes.yaw)
    pitch.push(axes.pitch)
  }
  assert.ok(yaw.every(v=>v>0),"diagonal yaw must never pulse to zero")
  assert.ok(pitch.every(v=>v>0),"diagonal pitch must never pulse to zero")
  assert.ok(Math.max(...yaw)-Math.min(...yaw)<0.16)
})

test("true pitch-only motion releases stale yaw after the bounded axis gap", () => {
  let time=1000
  const mouse=new MouseSteering({now:()=>time,sensitivity:8})
  const start=mouse.move(2,-2)
  for(let i=0;i<5;i++) {
    time+=8
    mouse.move(0,-2)
  }
  assert.equal(MOUSE_STEERING_AXIS_GAP_MS,36)
  assert.equal(mouse.axes().yaw,0)
  assert.ok(mouse.axes().pitch>0)
  assert.ok(start.yaw>0)
})

test("one-frame and one-packet jitter do not modify the latest steering command", () => {
  let time=1000
  const mouse=new MouseSteering({now:()=>time,sensitivity:10})
  mouse.move(2,0)
  const held=mouse.axes()
  for(const dx of [1,2,1,2]) {
    time+=8
    assert.deepEqual(mouse.move(dx,0),held)
  }
  assert.ok(MOUSE_STEERING_JITTER_BAND>=0.5)
  assert.ok(MOUSE_STEERING_JITTER_FILTER<0.5)
  time+=8
  assert.ok(mouse.move(1,0).yaw>0)
  const observations=[]
  for(let i=0;i<40;i++) {
    time+=16
    observations.push(mouse.move(i%2?2:1,0).yaw)
  }
  const stable=observations.slice(10)
  assert.ok(Math.max(...stable)-Math.min(...stable)<0.22,
    "aggregation and cross-window filtering must bound 1px/2px sawtooth")
})

test("substantial mouse reversal immediately replaces old held intention", () => {
  let time=1000
  const mouse=new MouseSteering({now:()=>time,sensitivity:1.5})
  assert.ok(mouse.move(5,0).yaw>0)
  time+=8
  assert.ok(mouse.move(-5,0).yaw<0)
  time+=8
  assert.ok(mouse.move(5,0).yaw>0)
})

test("slowdown is sampled without a stale high rate persisting indefinitely", () => {
  let time=1000
  const mouse=new MouseSteering({now:()=>time,sensitivity:1.5})
  const fast=mouse.move(5,0).yaw
  for(let n=0;n<3;n++) {
    time+=16
    mouse.move(1,0)
  }
  assert.ok(mouse.axes().yaw>0)
  assert.ok(mouse.axes().yaw<fast/2,
    "40ms sample should recognize a deliberate large slowdown")
})

test("gaps between 30Hz/20Hz packets preserve the latest turn intention", () => {
  for(const gap of [33,50]) {
    let time=1000
    const mouse=new MouseSteering({now:()=>time})
    mouse.move(3,0)
    time+=gap
    mouse.move(3,0)
    for(let i=0;i<6;i++) {
      time+=gap
      assert.equal(mouse.expire(time),null)
      assert.ok(mouse.move(3,0).yaw>0)
      assert.ok(mouse.stopDelayMs()>gap)
    }
    time+=mouse.stopDelayMs()
    assert.deepEqual(mouse.expire(time),{yaw:0,pitch:0})
  }
})

test("short lost-packet gaps do not invent a neutral command", () => {
  let time=1000
  const mouse=new MouseSteering({now:()=>time})
  mouse.move(4,0)
  time+=16
  mouse.move(4,0)
  time+=48
  assert.equal(mouse.expire(time),null)
  assert.ok(mouse.axes().yaw>0)
  mouse.move(12,0)
  assert.ok(mouse.axes().yaw>0)
})

test("real mouse silence stops exactly once, including pending incomplete samples", () => {
  let time=1000
  const mouse=new MouseSteering({now:()=>time})
  mouse.move(4,0)
  time+=16
  mouse.move(4,0)
  assert.ok(mouse.pendingDx!==0)
  assert.ok(mouse.stopDelayMs()>=MOUSE_STEERING_MIN_STOP_MS)
  assert.ok(mouse.stopDelayMs()<=MOUSE_STEERING_IDLE_MS)
  time+=mouse.stopDelayMs()-1
  assert.equal(mouse.expire(time),null)
  time+=1
  assert.deepEqual(mouse.expire(time),{yaw:0,pitch:0})
  assert.equal(mouse.pendingDx,0)
  assert.equal(mouse.expire(time+150),null)
  time+=151
  assert.ok(mouse.move(2,0).yaw>0)
  assert.equal(mouse.pendingDx,0)
})

test("zero delta events cannot extend a turn or change its command", () => {
  let time=1000
  const mouse=new MouseSteering({now:()=>time})
  const start=mouse.move(5,0)
  time+=MOUSE_STEERING_FAST_STOP_MS-1
  assert.deepEqual(mouse.move(0,0),start)
  assert.equal(mouse.expire(time),null)
  time+=1
  assert.deepEqual(mouse.expire(time),{yaw:0,pitch:0})
})

test("explicit pointer release clears the command and cadence immediately", () => {
  let time=1000
  const mouse=new MouseSteering({now:()=>time,sensitivity:1.5})
  mouse.move(5,0)
  time+=8
  mouse.move(5,0)
  assert.ok(mouse.pendingDx>0)
  assert.ok(mouse.packetGapMs!==null)
  assert.deepEqual(mouse.release(),{yaw:0,pitch:0})
  assert.equal(mouse.packetGapMs,null)
  assert.equal(mouse.pendingDx,0)
  assert.equal(mouse.expire(time+200),null)
  time+=8
  assert.equal(mouse.move(0,-2).yaw,0)
  assert.ok(mouse.axes().pitch>0)
})

test("long event gap starts a fresh intent rather than replaying stale pixels", () => {
  let time=1000
  const mouse=new MouseSteering({now:()=>time,sensitivity:1.5})
  mouse.move(5,0)
  time+=8
  mouse.move(5,0)
  time+=MOUSE_STEERING_IDLE_MS+1
  assert.deepEqual(mouse.move(2,0),{yaw:0.3,pitch:0})
  assert.equal(mouse.pendingDx,0)
})

test("stable mouse intent goes through keyboard's existing FlightControls channel", () => {
  let time=1000
  const sent=[]
  const mouse=new MouseSteering({now:()=>time,sensitivity:1.5})
  const flight=new FlightControls({send:command=>sent.push(command),now:()=>time})
  flight.setMouseMode(true)
  for(let n=0;n<30;n++) {
    const axes=mouse.move(2,0)
    flight.setMouseSteering(axes)
    time+=8
    flight.heartbeat(time)
  }
  const active=sent.filter(p=>p.yaw!==0)
  assert.ok(active.length>=2)
  assert.ok(active.length<12,"input packet count must not equal network send count")
  assert.ok(active.every(p=>p.yaw>0 && p.pitch===0))
  assert.equal(flight.payload().mouse_steering,true)
  assert.ok(flight.axes().yaw>0)
  time+=mouse.stopDelayMs()
  const stopped=mouse.expire(time)
  flight.setMouseSteering(stopped)
  assert.equal(sent.at(-1).yaw,0,"real idle sends exactly one neutral")
  assert.equal(flight.axes().yaw,0)
})

test("keyboard held yaw remains unchanged by the mouse intent sampler", () => {
  let time=1000
  const sent=[]
  const mouse=new MouseSteering({now:()=>time})
  const flight=new FlightControls({send:p=>sent.push(p),now:()=>time})
  const key=code=>({code,defaultPrevented:false,preventDefault(){}})
  flight.keyDown(key("KeyD"))
  for(let n=0;n<20;n++) {
    time+=16
    flight.setMouseSteering(mouse.move(n%2?2:0,n%2?0:-2))
    flight.heartbeat(time)
    assert.equal(flight.axes().yaw,1)
  }
  flight.keyUp(key("KeyD"))
  assert.ok(flight.axes().yaw>=0)
  assert.equal(sent[0].yaw,1)
})
