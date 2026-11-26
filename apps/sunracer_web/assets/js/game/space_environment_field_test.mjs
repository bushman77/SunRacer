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
  assert.ok(sparse.length<dense.length/4)
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

test("open space has sparse small debris compared with peak Earth orbit",()=>{
  const earth={region_id:"sol:orbital_debris:earth",kind:"orbital_debris",
    intensity:0.55,visual_only:true}
  const map="sol:free_3"
  let sparseCount=0,denseCount=0
  for(let i=0;i<20;i++){
    const p={x:camera.x+i*480,y:camera.y,z:camera.z-i*720}
    const sparse=environmentFieldObjects(open,p,map)
    const dense=environmentFieldObjects(earth,p,map)
    sparseCount+=sparse.length
    denseCount+=dense.length
    assert.ok(sparse.every(o=>o.size>=1.5&&o.size<=7))
    assert.ok(sparse.every(o=>Math.hypot(o.x-p.x,o.y-p.y,o.z-p.z)>=32))
  }
  assert.ok(sparseCount>=160)
  assert.ok(sparseCount<denseCount/3)
})

test("open-space fragments stay fixed across spatial cell boundaries",()=>{
  const map="sol:free_3"
  const before=environmentFieldObjects(open,camera,map)
  assert.deepEqual(environmentFieldObjects(open,camera,map),before)
  const after=environmentFieldObjects(open,{...camera,x:camera.x+260},map)
  const byId=new Map(after.map(o=>[o.id,o]))
  const common=before.filter(o=>byId.has(o.id))
  assert.ok(common.length>0)
  for(const obj of common)assert.deepEqual(obj,byId.get(obj.id))
})

test("open-space density is capped and zero intensity is respected",()=>{
  const map="sol:free_3"
  const zero={...open,intensity:0}
  const high={...open,intensity:1}
  assert.deepEqual(environmentFieldObjects(zero,camera,map),[])
  assert.notEqual(environmentFieldKey(zero,camera,map),environmentFieldKey(open,camera,map))
  assert.equal(environmentFieldKey(high,camera,map),environmentFieldKey(open,camera,map))
  assert.deepEqual(environmentFieldObjects(high,camera,map),environmentFieldObjects(open,camera,map))
})
