import test from "node:test"
import assert from "node:assert/strict"
import {tunnelMeshData,exteriorFor,arrivalFade} from "./wormhole_lab.mjs"

test("plasma geometry follows authoritative section radius and closes UV seam",()=>{
  const sections=[{x:0,y:0,radius:100,distance:0},{x:50,y:20,radius:60,distance:100}]
  const data=tunnelMeshData(sections,8)
  assert.equal(data.positions.length,2*9*3)
  assert.equal(data.uvs.length,2*9*2)
  assert.equal(data.indices.length,8*6)
  assert.deepEqual(data.positions.slice(27,30),[110,20,-100])
  assert.equal(data.uvs[0],0)
  assert.equal(data.uvs[16],1)
  assert.ok(data.indices.every(i=>i<18))
})

test("destination visuals require the server's terminal location and status",()=>{
  assert.equal(exteriorFor({status:"in_transit",location:"tunnel",progress:1}),null)
  assert.equal(exteriorFor({status:"in_transit",location:"alpha_centauri_exit"}),null)
  assert.equal(exteriorFor({status:"arrived",location:"alpha_centauri_exit"}),"alpha")
  assert.equal(exteriorFor({status:"ejected",location:"sol_entrance"}),"sol")
  assert.equal(exteriorFor({status:"destroyed",location:"tunnel"}),null)
  assert.equal(arrivalFade(0),.92)
  assert.ok(arrivalFade(800)>0&&arrivalFade(800)<.92)
  assert.equal(arrivalFade(1600),0)
})
