import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {fromAngles} from "./own_ship_prediction.mjs"
import {instantLaserPreview,takePreviewForConfirmedShot,
  LOCAL_LASER_PREVIEW_MS,REMOTE_LASER_DISPLAY_MS,LASER_SCENE_SCALE}
  from "./instant_laser_preview.mjs"

const ship=(renderOrientation=fromAngles({}))=>({
  render:{x:1000,y:1000,z:10},renderOrientation,attackRange:540,
})
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8")

test("wing rays originate at rotating muzzles and converge on sight",()=>{
  const rays=instantLaserPreview(ship(),1000)
  assert.deepEqual(rays.map(r=>r.side),["left","right"])
  assert.ok(rays.every(r=>r.preview && r.hit===false))
  assert.ok(rays[0].from.x<1000 && rays[1].from.x>1000)
  assert.equal(rays[0].from.y,rays[1].from.y)
  assert.ok(Math.abs(rays[0].to.x-1000)<1e-8)
  assert.ok(Math.abs(rays[0].to.y-460)<1e-8)
  assert.ok(Math.abs(rays[0].to.z-(10+2.75/LASER_SCENE_SCALE))<1e-8)
  assert.equal(rays[0].expiresAt,1000+LOCAL_LASER_PREVIEW_MS)
  assert.ok(LOCAL_LASER_PREVIEW_MS<REMOTE_LASER_DISPLAY_MS)
})

test("local sight, not delayed server orientation, determines instant beam",()=>{
  const own=ship(fromAngles({yaw:Math.PI/2}))
  own.orientation=fromAngles({yaw:0})
  const rays=instantLaserPreview(own,1000)
  assert.ok(rays.every(r=>r.to.x>1000))
  assert.ok(rays.every(r=>Math.abs(r.to.y-1000)<1e-8))
})

test("pitch and roll rotate muzzles; nothing locally claims a hit",()=>{
  const rays=instantLaserPreview(ship(fromAngles({
    pitch:Math.PI/6,roll:Math.PI/2})),200)
  assert.ok(rays.every(r=>r.to.z>10))
  assert.ok(Math.abs(rays[0].from.z-rays[1].from.z)>10)
  assert.ok(rays.every(r=>r.hit===false))
})

test("ignore stale manual previews and only consume one confirmed shot",()=>{
  const queue=[{at:100,id:1},{at:1600,id:2}]
  assert.deepEqual(takePreviewForConfirmedShot(queue,1700),{at:1600,id:2})
  assert.deepEqual(queue,[])
  assert.equal(takePreviewForConfirmedShot([],1900),null)
})

test("server owns weapon, damage and hit confirmation",()=>{
  const source=read("./client.js")
  assert.match(source,/\.push\("fire_ready_weapon", \{\}, 3000\)/)
  assert.match(source,/instantLaserPreview\(own, startedAt\)/)
  assert.match(source,/this\.pendingLocalLaserPreviews\.push\(/)
  assert.match(source,/takePreviewForConfirmedShot\(this\.pendingLocalLaserPreviews,\s*startedAt\)/)
  assert.match(source,/applyLaserBurstDamage\(this\.entities, attack\)/)
  assert.match(source,/this\.lastLaserFeedback = laserFeedback\(attack, this\.entities, startedAt\)/)
  assert.match(source,/this\.beams = this\.beams\.filter\(/)
})
