import test from "node:test"
import assert from "node:assert/strict"
import {advanceCabinPose, canWalkInTransit, CABIN_START, cabinRoom} from "./ship_cabin.mjs"
const cruise = {flightState:"cruise",displayMode:"3d"}
test("only uninterrupted desktop cruise permits leaving the helm",()=>{
  assert.equal(canWalkInTransit(cruise),true)
  for(const state of ["ready","atlas","docked","encounter","disconnected","destroyed"])
    assert.equal(canWalkInTransit({...cruise,flightState:state}),false)
  assert.equal(canWalkInTransit({...cruise,pendingEncounter:true}),false)
  assert.equal(canWalkInTransit({...cruise,headsetActive:true}),false)
  assert.equal(canWalkInTransit({...cruise,displayMode:"sbs"}),false)
})
test("walking uses local orientation, normalized diagonal speed and bounded cabin",()=>{
  const p={x:0,z:0,yaw:0}
  const next=advanceCabinPose(p,{forward:1,strafe:1},.1)
  assert.ok(Math.abs(Math.hypot(next.x,next.z)-.38)<1e-8)
  assert.ok(next.x>0 && next.z<0)
  let pose={...CABIN_START}
  for(let i=0;i<200;i++)pose=advanceCabinPose(pose,{forward:1,strafe:1},.1)
  assert.ok(Math.abs(pose.x)<=2.5 && Math.abs(pose.z)<=12.3)
  assert.deepEqual(advanceCabinPose(p,{},1),p)
  assert.equal(cabinRoom(-8),"Bridge")
  assert.equal(cabinRoom(0),"Crew quarters")
  assert.equal(cabinRoom(8),"Engineering")
})
