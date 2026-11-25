import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import * as THREE from "three"
import {createLaserCrosshairGeometry, placeGazeCursor,
  CROSSHAIR_INNER, CROSSHAIR_OUTER, GAZE_BASE_DISTANCE} from "./cockpit_reticles.mjs"

test("weapon crosshair consists of four symmetric open-center bars", () => {
  const g = createLaserCrosshairGeometry(THREE)
  const p = g.getAttribute("position")
  assert.equal(p.count, 24)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i)
    assert.ok(Math.max(Math.abs(x), Math.abs(y)) >= CROSSHAIR_INNER - 1e-6)
    assert.ok(Math.max(Math.abs(x), Math.abs(y)) <= CROSSHAIR_OUTER + 1e-6)
    assert.equal(p.getZ(i), 0)
    assert.ok(Math.min(Math.abs(x), Math.abs(y)) < 0.007)
  }
  g.computeBoundingBox()
  assert.ok(Math.abs(g.boundingBox.min.x + g.boundingBox.max.x) < 1e-8)
  assert.ok(Math.abs(g.boundingBox.min.y + g.boundingBox.max.y) < 1e-8)
  g.dispose()
})

test("gaze ring and progress arc converge together without changing angular size", () => {
  const ring = new THREE.Object3D(), arc = new THREE.Object3D()
  for (const [hit, expected] of [[null,60],[2.4,2.4],[0.1,60],[NaN,60]]) {
    placeGazeCursor(ring, arc, hit, 60)
    for (const mesh of [ring,arc]) {
      assert.equal(mesh.position.z, -expected)
      assert.ok(Math.abs(mesh.scale.x / expected - 1 / GAZE_BASE_DISTANCE) < 1e-10)
    }
  }
})

test("head rotation moves only the circular gaze cursor, not the weapon sight", () => {
  const scene = new THREE.Scene()
  const ship = new THREE.Group(), head = new THREE.PerspectiveCamera()
  scene.add(ship,head)
  const sight = new THREE.Mesh(createLaserCrosshairGeometry(THREE))
  const gaze = new THREE.Mesh(new THREE.RingGeometry(0.019,0.026,48))
  ship.add(sight)
  head.add(gaze)
  sight.position.z = -60
  placeGazeCursor(gaze,null,null,60)
  const world = node => node.getWorldPosition(new THREE.Vector3())
  assert.ok(world(sight).distanceTo(world(gaze)) < 1e-8)
  head.rotateY(Math.PI/4)
  assert.ok(world(sight).distanceTo(new THREE.Vector3(0,0,-60)) < 1e-8)
  assert.ok(world(gaze).distanceTo(world(sight)) > 10)
  ship.rotateY(Math.PI/6)
  assert.ok(world(sight).distanceTo(new THREE.Vector3(0,0,-60)) > 10)
  sight.geometry.dispose()
  gaze.geometry.dispose()
})

test("shared renderer assigns the two reticles to independent reference frames", () => {
  const view = readFileSync(new URL("./stereo_view.js",import.meta.url),"utf8")
  assert.match(view,/createLaserCrosshairGeometry\(THREE\)/)
  assert.match(view,/framing\.add\(sight\)/)
  assert.doesNotMatch(view,/this\.camera\.add\(sight\)/)
  assert.match(view,/this\.gazeReticle = new THREE\.Mesh\(\s*new THREE\.RingGeometry/)
  assert.match(view,/this\.camera\.add\(this\.gazeReticle\)/)
  assert.match(view,/this\.camera\.add\(this\.gazeArc\)/)
  assert.match(view,/this\.placeGazeReticle\(this\.gazeHitDistance\)/)
  assert.ok(view.indexOf("this.cockpitFraming.quaternion.copy(this.camera.quaternion)") <
    view.indexOf("this.camera.quaternion.multiply(this.helmetHeadRotation)"))
})
