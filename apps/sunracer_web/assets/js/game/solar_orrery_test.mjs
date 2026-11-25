import test from "node:test"
import assert from "node:assert/strict"
import {solarLayout, solarChartToPosition} from "./solar_system.mjs"
import {chartToOrrery, worldToOrrery, orreryToWorld, orbitCamera, ORRERY_COLORS} from "./solar_orrery.mjs"

test("orrery preserves the existing schematic positions",()=>{
  for(const focus of ["system","inner"])for(const body of solarLayout(focus)){
    const p=chartToOrrery(body)
    assert.equal(p.x,body.x-500)
    assert.equal(p.z,body.y-300)
    assert.equal(p.y,0)
  }
})
test("picking on the 3D plane recovers the same authoritative coordinate as the flat chart",()=>{
  for(const focus of ["system","inner"])for(const [x,y] of [[650,430],[225,300],[780,290]]){
    const expected=solarChartToPosition(x,y,focus,721)
    const p=chartToOrrery({x,y})
    const actual=orreryToWorld(p,focus,721)
    assert.deepEqual(actual,expected)
    const roundtrip=worldToOrrery(actual,focus)
    assert.ok(Math.abs(roundtrip.x-p.x)<1e-6)
    assert.ok(Math.abs(roundtrip.z-p.z)<1e-6)
  }
  assert.equal(orreryToWorld(null),null)
})
test("camera orbit is bounded and does not mutate game positions",()=>{
  const p=orbitCamera({azimuth:1,elevation:-10,distance:99999})
  assert.ok(p.y>0)
  assert.ok(Math.abs(Math.hypot(p.x,p.y,p.z)-1800)<1e-8)
  assert.equal(ORRERY_COLORS.active,"#23dfff")
  assert.equal(ORRERY_COLORS.background,"#030914")
})

import {NavigationComputer} from "./navigation_computer.mjs"

function fixture(renderer) {
  const nodes=new Map(["#nav-orrery-mode","#nav-flat-mode","#nav-orrery-reset",
    "#nav-orrery-hint","#nav-orrery-status"].map(id=>[id,{
      hidden:true,setAttribute(){},classList:{toggle(){}}
    }]))
  const nav=new NavigationComputer({root:{querySelector:id=>nodes.get(id)},
    createOrrery:()=>renderer})
  nav.orreryHost={hidden:true}
  nav.solarSvg={hidden:false}
  nav.isOpen=true
  nav.renderSolarView=()=>{}
  return {nav,nodes}
}

test("overhead stays available when 3D cannot produce a frame",()=>{
  const {nav,nodes}=fixture({ready:false,update(){},setActive(){}})
  nav.setSolarPresentation("orrery")
  assert.equal(nav.solarPresentation,"flat")
  assert.equal(nav.solarSvg.hidden,false)
  assert.equal(nav.orreryHost.hidden,true)
  assert.match(nodes.get("#nav-orrery-status").textContent,/3D unavailable/)
})

test("overhead hides only after a successful initial frame",()=>{
  const renderer={ready:false,update(){assert.equal(nav.solarSvg.hidden,false)},
    setActive(active){if(active)this.ready=true}}
  const {nav}=fixture(renderer)
  nav.setSolarPresentation("orrery")
  assert.equal(nav.solarPresentation,"orrery")
  assert.equal(nav.solarSvg.hidden,true)
  nav.orreryUnavailable("context lost")
  assert.equal(nav.solarPresentation,"flat")
  assert.equal(nav.solarSvg.hidden,false)
})
