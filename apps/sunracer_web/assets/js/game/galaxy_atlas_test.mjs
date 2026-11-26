import test from "node:test"
import assert from "node:assert/strict"
import {validSystems,canEnterSystem,drawGalaxy,GALAXY_ART_PATH} from "./galaxy_atlas.mjs"
test("galactic catalogue rejects invalid and duplicate marker coordinates",()=>{
  const sol={id:"sol",name:"SOL",atlas_x:425,atlas_y:412,"provisional?":false}
  const alpha={id:"alpha_centauri",name:"Alpha Centauri",atlas_x:610,atlas_y:475,"provisional?":true}
  assert.deepEqual(validSystems([sol,alpha,sol,{...alpha,id:"bad",atlas_x:Infinity}]),[sol,alpha])
  assert.equal(canEnterSystem(sol),true)
  assert.equal(canEnterSystem(alpha),false)
  assert.deepEqual(validSystems(null),[])
})

test("approved artwork is inside the SVG and behind noninteractive guides",()=>{
  const doc={createElementNS(_ns,tag){
    return {tag,attrs:{},children:[],ownerDocument:doc,setAttribute(k,v){this.attrs[k]=String(v)},
      appendChild(n){this.children.push(n);n.parent=this},replaceChildren(){this.children=[]},
      addEventListener(name,fn){this[name]=fn},remove(){this.parent.children=this.parent.children.filter(n=>n!==this)}}
  }}
  const layer=doc.createElementNS("","g")
  drawGalaxy(layer)
  assert.equal(GALAXY_ART_PATH,"/images/game/galaxy/milky-way.webp")
  assert.equal(layer.children[1].tag,"image")
  assert.equal(layer.children[1].attrs.href,GALAXY_ART_PATH)
  assert.equal(layer.children[1].attrs["pointer-events"],"none")
  assert.equal(layer.children[2].tag,"g")
  layer.children[1].error()
  assert.equal(layer.children.some(n=>n.tag==="image"),false)
  assert.match(layer.children.at(-1).textContent,/GALAXY ART MISSING/)
})
