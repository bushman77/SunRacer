import test from "node:test"
import assert from "node:assert/strict"
import {stationPilotRows,blendStationPilot,StationPilotModels} from "./station_pilot_models.mjs"

const row={player_id:2,pilot_name:"Morte",room_id:"main_hangar",x:0,z:43,yaw:0}
test("station roster excludes self, duplicate and malformed avatars",()=>{
  assert.deepEqual(stationPilotRows([row,row,{...row,player_id:1},{...row,player_id:3,x:NaN}],1),[row])
})
test("poses interpolate along shortest yaw and snap across room boundaries",()=>{
  const from={...row,yaw:Math.PI-.1}
  const target={...row,x:3,yaw:-Math.PI+.1}
  const moved=blendStationPilot(from,target,.1)
  assert.ok(moved.x>0&&moved.x<3)
  assert.ok(moved.yaw>from.yaw)
  assert.deepEqual(blendStationPilot(from,{...target,room_id:"concourse"},.1),{...target,room_id:"concourse"})
})
test("avatar lifecycle removes departed pilots without recreating surviving models",()=>{
  const parent={},models=new StationPilotModels({},parent)
  let creates=0,removes=0
  models.create=r=>{creates++;return {name:r.pilot_name,pose:r,phase:0,limbs:[],root:{position:{set(){}},rotation:{}}}}
  models.remove=id=>{removes++;models.models.delete(id)}
  models.update([row],1,.1)
  models.update([{...row,x:1}],1,.1)
  assert.equal(creates,1)
  models.update([],1,.1)
  assert.equal(removes,1)
  assert.equal(models.models.size,0)
})
