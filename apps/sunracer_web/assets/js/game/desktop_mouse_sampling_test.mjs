import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {DesktopMouseFrameSampler, DesktopMouseTimingProbe}
  from "./desktop_mouse_sampling.mjs"
import {MouseSteering} from "./mouse_steering.mjs"
const read = path => readFileSync(new URL(path, import.meta.url), "utf8")

test("coalesce high-frequency mouse events once per draw, no timer", () => {
  const sampler=new DesktopMouseFrameSampler()
  assert.equal(sampler.drain(), null)
  sampler.push(1,0)
  sampler.push(2,-3)
  sampler.push(0,0)
  sampler.push(-0.5,1)
  assert.deepEqual(sampler.drain(),{dx:2.5,dy:-2,events:3})
  assert.equal(sampler.drain(),null)
  sampler.push(NaN,4)
  assert.equal(sampler.drain(),null)
  sampler.push(3,4)
  sampler.clear()
  assert.equal(sampler.drain(),null)
})

test("240 Hz mouse packets can drive steady 60 Hz input frames", () => {
  const sampler=new DesktopMouseFrameSampler()
  let at=1000
  const mouse=new MouseSteering({now:()=>at,sensitivity:1.5})
  const values=[]
  for(let frame=0;frame<20;frame++) {
    for(let k=0;k<4;k++) sampler.push(1,0)
    at+=16
    const packet=sampler.drain()
    assert.equal(packet.events,4)
    values.push(mouse.move(packet.dx,packet.dy).yaw)
  }
  assert.ok(values.every(x=>Math.abs(x-0.6)<1e-9))
  assert.equal(sampler.drain(),null)
})

test("reversal and explicit release are not delayed or filtered", () => {
  const sampler=new DesktopMouseFrameSampler()
  let now=1000
  const mouse=new MouseSteering({now:()=>now})
  sampler.push(4,0)
  let p=sampler.drain()
  assert.ok(mouse.move(p.dx,p.dy).yaw>0)
  sampler.push(-4,0)
  now+=16
  p=sampler.drain()
  assert.ok(mouse.move(p.dx,p.dy).yaw<0)
  assert.deepEqual(mouse.release(),{yaw:0,pitch:0})
})
test("timing diagnosis distinguishes event gaps, dropped frames and server rebases", () => {
  const p=new DesktopMouseTimingProbe()
  for(let i=0;i<20;i++){p.mouse(1000+i*8);p.frame(1000+i*16)}
  p.correction()
  p.correction()
  assert.deepEqual(p.summary(),{mouseP95Ms:8,frameP95Ms:16,serverCorrections:2})
  assert.equal(p.summary().serverCorrections,0)
})

test("experiment is desktop-only, opt-in, and shares the same flight authority", () => {
  const client=read("./client.js")
  const template=read("../../../lib/sunracer_web/controllers/game_html/show.html.heex")
  assert.match(template,/id="cockpit-mouse-frame-sampling"/)
  assert.match(template,/id="cockpit-mouse-jitter-metrics"/)
  assert.match(client,/this\.mouseFrameSampler = new DesktopMouseFrameSampler\(\)/)
  assert.match(client,/this\.mouseFrameSamplingEnabled = localStorage\.getItem/)
  assert.match(client,/this\.mouseFrameSampler\.push\(dx, dy\)/)
  assert.match(client,/this\.mouseFrameSampler\.drain\(\)/)
  assert.match(client,/this\.applyDesktopMouseDelta\(packet\.dx, packet\.dy, time\)/)
  assert.match(client,/this\.mouseTimingProbe\.frame\(time\)/)
  assert.match(client,/this\.mouseTimingProbe\.mouse\(receivedAt\)/)
  assert.match(client,/this\.mouseTimingProbe\.correction\(\)/)
  assert.match(client,/this\.mouseFrameSampler\.clear\(\)/)
  assert.match(client,/this\.channel\.push\("flight_controls", input, 3000\)/)
})
