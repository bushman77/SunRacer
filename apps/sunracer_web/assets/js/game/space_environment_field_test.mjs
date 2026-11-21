import assert from "node:assert/strict"
import test from "node:test"
import {environmentFieldKey,environmentFieldObjects} from "./space_environment_field.mjs"

const belt={region_id:"sol:asteroid_belt",kind:"asteroid_belt",
  intensity:0.8,visual_only:true}
const open={region_id:"sol:open_space",kind:"open_space",
  intensity:0.025,visual_only:true}
const camera={x:12_000,y:500,z:-8_000}

test("dense belt has far more objects than open space",()=>{
  const dense=environmentFieldObjects(belt,camera,"sol:free_3")
  const sparse=environmentFieldObjects(open,camera,"sol:free_3")
  assert.ok(dense.length>100)
  assert.ok(sparse.length<dense.length/10)
  assert.ok(dense.every(obj=>Math.hypot(obj.x-camera.x,
    obj.y-camera.y,obj.z-camera.z)>=32))
})

test("repeated rendering, including Atlas toggles, retains object positions",()=>{
  const a=environmentFieldObjects(belt,camera,"sol:free_3")
  assert.deepEqual(environmentFieldObjects(belt,camera,"sol:free_3"),a)
  const slightlyMoved={...camera,x:camera.x+2}
  assert.equal(environmentFieldKey(belt,camera,"sol:free_3"),
    environmentFieldKey(belt,slightlyMoved,"sol:free_3"))
  const b=environmentFieldObjects(belt,slightlyMoved,"sol:free_3")
  const shared=new Set(b.map(o=>o.id))
  assert.ok(a.filter(o=>shared.has(o.id)).length>a.length-3)
})

test("adjacent spatial cells share fixed positions without reshuffling",()=>{
  const before=environmentFieldObjects(belt,camera,"sol:free_3")
  const moved=environmentFieldObjects(belt,{...camera,x:camera.x+260},"sol:free_3")
  const byId=new Map(moved.map(o=>[o.id,o]))
  const common=before.filter(o=>byId.has(o.id))
  assert.ok(common.length>25)
  for(const obj of common)assert.deepEqual(obj,byId.get(obj.id))
})

test("invalid or forged scenic modes create no objects",()=>{
  assert.deepEqual(environmentFieldObjects({...belt,visual_only:false},camera),[])
  assert.deepEqual(environmentFieldObjects({...belt,kind:"collision_hazard"},camera),[])
  assert.deepEqual(environmentFieldObjects(belt,{x:Infinity,y:0,z:0}),[])
  assert.deepEqual(environmentFieldObjects(null,camera),[])
})

test("region and local map salt the visual field",()=>{
  assert.notDeepEqual(environmentFieldObjects(belt,camera,"sol:free_3"),
    environmentFieldObjects(belt,camera,"sol:free_4"))
  assert.notDeepEqual(environmentFieldObjects(belt,camera,"sol:free_3"),
    environmentFieldObjects({...belt,region_id:"sol:other"},camera,"sol:free_3"))
})
