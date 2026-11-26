import test from "node:test"
import assert from "node:assert/strict"
import {validSystems,canEnterSystem,drawGalaxy,GALAXY_ART_PATH,campaignEdges,drawCampaignRoad} from "./galaxy_atlas.mjs"
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

test("campaign road is consecutive, starts at SOL and never skips a missing phase",()=>{
  const sol={id:"sol",campaign_phase:1},alpha={id:"alpha_centauri",campaign_phase:2},
    barnard={id:"barnard",campaign_phase:3},sirius={id:"sirius",campaign_phase:4}
  assert.deepEqual(campaignEdges([sirius,alpha,sol,barnard]),
    [{from:sol,to:alpha},{from:alpha,to:barnard},{from:barnard,to:sirius}])
  assert.deepEqual(campaignEdges([sol,alpha,sirius]),[{from:sol,to:alpha}])
  assert.deepEqual(campaignEdges([alpha,barnard]),[])
  assert.deepEqual(campaignEdges([sol,alpha,{id:"duplicate",campaign_phase:2},barnard]),[])
})

test("route is noninteractive and first leg is gold but still dashed",()=>{
  const doc={createElementNS(_ns,tag){return {tag,attrs:{},children:[],ownerDocument:doc,
    setAttribute(k,v){this.attrs[k]=String(v)},appendChild(n){this.children.push(n)}}}}
  const layer=doc.createElementNS("","g")
  drawCampaignRoad(layer,[{id:"sol",campaign_phase:1,atlas_x:100,atlas_y:100},
    {id:"alpha_centauri",campaign_phase:2,atlas_x:200,atlas_y:200},
    {id:"barnard",campaign_phase:3,atlas_x:300,atlas_y:200}])
  const road=layer.children[0]
  assert.equal(road.attrs["pointer-events"],"none")
  const links=road.children.filter(n=>n.attrs["data-route-from"])
  assert.equal(links.length,2)
  assert.equal(links[0].attrs.stroke,"#ffd06b")
  assert.equal(links[0].attrs["stroke-dasharray"],"7 4")
  assert.equal(links[1].attrs["data-route-to"],"barnard")
})
