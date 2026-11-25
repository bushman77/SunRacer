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
