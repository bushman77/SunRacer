import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {cockpitDestinationCamera} from "./cockpit_camera_source.mjs"
const read = p => readFileSync(new URL(p, import.meta.url), "utf8")

test("active mouse-led camera always wins over a stale navigation destination", () => {
  const ship={destination:{x:100,y:200,z:0},renderOrientation:{x:0,y:0,z:0,w:1}}
  assert.equal(cockpitDestinationCamera(ship,true),false)
  assert.equal(cockpitDestinationCamera(ship,false),true)
  assert.equal(cockpitDestinationCamera({...ship,destination:null},true),false)
  assert.equal(cockpitDestinationCamera({...ship,destination:null},false),false)
  assert.equal(cockpitDestinationCamera(null,true),false)
})

test("all cockpit eye, attitude, and lookAt branches share the same source decision", () => {
  const view=read("./stereo_view.js")
  assert.match(view,/setCamera\(ownShip, \{clientLedActive = false\} = \{\}\)/)
  assert.match(view,/const useDestinationView = cockpitDestinationCamera\(ownShip, clientLedActive\)/)
  assert.match(view,/const pose = !useDestinationView &&/)
  assert.match(view,/if \(!useDestinationView\) \{/)
  assert.match(view,/this\.setCamera\(ownShip, \{\s*clientLedActive:/)
  assert.match(view,/client\.clientLedCameraActiveForTick\?\.\(\)/)
  assert.doesNotMatch(view,/const pose = !ownShip\.destination &&/)
})

test("client-led quaternion is final render orientation even when normal prediction cannot run", () => {
  const client=read("./client.js")
  const segment=client.slice(client.indexOf("  interpolate(deltaSeconds) {"),
    client.indexOf("  // Manual flight only: run the server's own turn rules"))
  assert.match(segment,/const localCameraActive = this\.clientLedMouseCameraActive\(\)/)
  assert.match(segment,/this\.clientLedCamera\.advance\(this\.flightControls\.axes\(\), deltaSeconds/)
  assert.match(segment,/if \(localCameraActive && own && this\.clientLedCamera\.active\) \{/)
  assert.match(segment,/own\.renderOrientation = \{\.\.\.this\.clientLedCamera\.orientation\}/)
})
