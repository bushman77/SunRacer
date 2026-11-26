import test from "node:test"
import assert from "node:assert/strict"
import {atlasPilotMarkers, alignRemotePlayerModel, PLAYER_MODEL_FORWARD_CORRECTION} from "./atlas_pilot_markers.mjs"
import {markerModelClass} from "./orrery_markers.mjs"

test("strategic pilot markers preserve anchors, colors and distinguish coincident pilots",()=>{
  const p={x:100,y:200,z:0}
  const rows=[{pilot_id:2,pilot_name:"Morte",position_km:p,relation:"party"},
    {pilot_id:3,pilot_name:"Other",position_km:p,relation:"guild"},
    {pilot_id:4,pilot_name:"Bad",position_km:p,relation:"unknown"}]
  const markers=atlasPilotMarkers(rows,q=>q)
  assert.equal(markers.length,2)
  assert.deepEqual(markers.map(m=>[m.point,m.stack,m.color]),[[p,0,"#6ef5a4"],[p,1,"#c4a0ff"]])
  assert.equal(markerModelClass("pilot"),"sunracer")
  assert.equal(atlasPilotMarkers(rows,()=>null).length,0)
})
test("local model +X rotates onto authoritative -Z without changing flight data",()=>{
  let rotation
  alignRemotePlayerModel({rotateY:y=>rotation=y})
  assert.equal(rotation,PLAYER_MODEL_FORWARD_CORRECTION)
  assert.ok(Math.abs(Math.cos(rotation))<1e-12)
  assert.equal(-Math.sin(rotation),-1)
})
