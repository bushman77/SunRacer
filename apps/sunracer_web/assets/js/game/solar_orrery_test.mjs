import test from "node:test"
import assert from "node:assert/strict"
import {solarLayout, solarChartToPosition} from "./solar_system.mjs"
import {chartToOrrery, worldToOrrery, orreryToWorld, orbitCamera, zoomAround, ORRERY_COLORS} from "./solar_orrery.mjs"

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
  // Model SVG DOM semantics: visibility is an attribute, not an HTML property.
  const attributes=new Set()
  nav.solarSvg=Object.freeze({
    toggleAttribute(name,force){if(force)attributes.add(name);else attributes.delete(name)},
    hasAttribute(name){return attributes.has(name)},
  })
  nav.isOpen=true
  nav.renderSolarView=()=>{}
  return {nav,nodes}
}

test("overhead stays available when 3D cannot produce a frame",()=>{
  const {nav,nodes}=fixture({ready:false,update(){},setActive(){}})
  nav.setSolarPresentation("orrery")
  assert.equal(nav.solarPresentation,"flat")
  assert.equal(nav.solarSvg.hasAttribute("hidden"),false)
  assert.equal(nav.orreryHost.hidden,true)
  assert.match(nodes.get("#nav-orrery-status").textContent,/3D unavailable/)
})

test("overhead hides only after a successful initial frame",()=>{
  const renderer={ready:false,update(){assert.equal(nav.solarSvg.hasAttribute("hidden"),false)},
    setActive(active){if(active)this.ready=true}}
  const {nav}=fixture(renderer)
  nav.setSolarPresentation("orrery")
  assert.equal(nav.solarPresentation,"orrery")
  assert.equal(nav.solarSvg.hasAttribute("hidden"),true)
  nav.orreryUnavailable("context lost")
  assert.equal(nav.solarPresentation,"flat")
  assert.equal(nav.solarSvg.hasAttribute("hidden"),false)
})

test("cursor anchored dolly retains the same perspective ray for zoom in and out",()=>{
  const target={x:0,y:4,z:10}, anchor={x:110,y:8,z:-85}
  const camera=orbitCamera({azimuth:.45,elevation:.66,distance:730})
  for(const requested of [365,1460,1,99999]){
    const next=zoomAround(target,anchor,730,requested)
    const offset=orbitCamera({azimuth:.45,elevation:.66,distance:next.distance})
    const ratio=next.distance/730
    for(const axis of ["x","y","z"]){
      // Camera-to-anchor vector scales without changing its direction.
      const before=target[axis]+camera[axis]-anchor[axis]
      const after=next.target[axis]+offset[axis]-anchor[axis]
      assert.ok(Math.abs(after-before*ratio)<1e-9)
    }
  }
  assert.deepEqual(target,{x:0,y:4,z:10})
  assert.deepEqual(zoomAround(target,anchor,45,1).target,target)
  assert.deepEqual(zoomAround(target,null,730,365).target,target)
})
test("zoom in and out about the same cursor point reverses the camera translation",()=>{
  const target={x:12,y:5,z:-20},anchor={x:84,y:12,z:30}
  const near=zoomAround(target,anchor,730,365)
  const far=zoomAround(near.target,anchor,near.distance,730)
  for(const axis of ["x","y","z"])assert.ok(Math.abs(far.target[axis]-target[axis])<1e-9)
})

import {WAYPOINT_COLOR, markerModelClass, markerHeading, markerScale} from "./orrery_markers.mjs"
test("Orrery uses known ship classes instead of painting all traffic as traders",()=>{
  assert.equal(markerModelClass("ship"),"sunracer")
  assert.equal(markerModelClass("contact","scow"),"scow")
  assert.equal(markerModelClass("contact","dart"),"dart")
  assert.equal(markerModelClass("contact","unknown"),null)
  assert.equal(markerModelClass("waypoint"),"peg")
  assert.equal(WAYPOINT_COLOR,"#ffdb57")
})
test("marker heading follows projected route with correct bow axes",()=>{
  const p={x:0,z:0}
  assert.equal(markerHeading("sunracer",p,{x:1,z:0}),-0)
  assert.equal(markerHeading("scow",p,{x:0,z:-1}),0)
  assert.equal(markerHeading("dart",p,p),null)
  assert.equal(markerHeading("scow",p,null),null)
})
test("marker scale remains readable without growing excessively",()=>{
  const near=markerScale(100,800,48,5.5,32)
  const far=markerScale(200,800,48,5.5,32)
  assert.ok(Math.abs(far-2*near)<1e-10)
  assert.equal(markerScale(1e8,800,48,5.5,32),4)
})
