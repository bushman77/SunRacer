import test from "node:test"
import assert from "node:assert/strict"
import {validSystems,canEnterSystem} from "./galaxy_atlas.mjs"
test("galactic catalogue rejects invalid and duplicate marker coordinates",()=>{
  const sol={id:"sol",name:"SOL",atlas_x:425,atlas_y:412,"provisional?":false}
  const alpha={id:"alpha_centauri",name:"Alpha Centauri",atlas_x:610,atlas_y:475,"provisional?":true}
  assert.deepEqual(validSystems([sol,alpha,sol,{...alpha,id:"bad",atlas_x:Infinity}]),[sol,alpha])
  assert.equal(canEnterSystem(sol),true)
  assert.equal(canEnterSystem(alpha),false)
  assert.deepEqual(validSystems(null),[])
})
