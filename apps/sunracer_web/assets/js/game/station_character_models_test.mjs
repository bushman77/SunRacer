import test from "node:test"
import assert from "node:assert/strict"
import * as THREE from "three"
import {GreenStarbaseInterior} from "./green_starbase_interior.js"
import {
  STATION_CHARACTER_ASSETS, positionStationCharacter, disposeStationCharacter,
  pickIdleClip, createCharacterAnimator,
} from "./station_character_models.mjs"

const mara = {
  id: "repair", x: -49, z: -143, name: "Mara Venn",
  role: "Repair Engineer", color: 0x68b98a,
}

const meshGltf = () => {
  const scene = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 1.75, 0.45),
    new THREE.MeshStandardMaterial({color: 0x438863}),
  )
  body.position.y = 0.875
  scene.add(body)
  return {scene}
}

test("Blender metre-scale GLB is centered, feet-grounded, and faces the repair counter", () => {
  const gltf = meshGltf()
  const model = positionStationCharacter(THREE, gltf, mara)
  const bounds = new THREE.Box3().setFromObject(model)
  assert.equal(model.name, "station-character:repair")
  assert.equal(model.userData.nonInteractive, true)
  assert.equal(model.position.x, mara.x)
  assert.equal(model.position.z, mara.z)
  assert.ok(Math.abs(bounds.min.y - (-4.65)) < 0.001)
  assert.ok(Math.abs((bounds.max.y - bounds.min.y) - 8.5) < 0.001)
  assert.equal(model.rotation.y, 0)
  disposeStationCharacter(model)
})

test("Green Starbase swaps Mara's visual and keeps all attendant interactions", async () => {
  const scene = new THREE.Scene()
  let requested = null
  let resolveModel
  const room = new GreenStarbaseInterior(THREE, scene, {
    lowPower: true,
    loadGltf(url) {
      requested = url
      return new Promise(resolve => {resolveModel = resolve})
    },
  })
  const trader = {...mara, id: "trade", x: 49, name: "Tarek Sol"}
  room.update({x: 0, z: 43}, 100, [mara, trader])
  await Promise.resolve() // Request starts on a microtask, never per frame.
  assert.equal(requested, STATION_CHARACTER_ASSETS.repair)
  resolveModel(meshGltf())
  await new Promise(resolve => setImmediate(resolve))
  const imported = room.node.children.find(o => o.name === "station-character:repair")
  assert.ok(imported, "Mara's Blender model is attached to the shared scene")
  assert.ok(room.node.children.filter(o =>
    o.name?.startsWith("attendant:repair:")).every(o => o.visible === false))
  assert.ok(room.node.children.filter(o =>
    o.name?.startsWith("attendant:trade:")).every(o => o.visible !== false))
  const count = room.node.children.length
  room.update({x: 0, z: 43}, 200, [mara, trader])
  assert.equal(room.node.children.length, count, "no per-frame model rebuilding")
  room.dispose()
  assert.equal(scene.children.includes(room.node), false)
})

test("a missing Blender model retains the procedural repair engineer", async () => {
  const scene = new THREE.Scene()
  let calls = 0
  const originalInfo = console.info
  console.info = () => {}
  try {
    const room = new GreenStarbaseInterior(THREE, scene, {
      lowPower: true,
      loadGltf() {
        calls++
        return Promise.reject(new Error("GLB not yet exported"))
      },
    })
    room.update({x: 0, z: 43}, 100, [mara])
    await new Promise(resolve => setImmediate(resolve))
    room.update({x: 0, z: 43}, 200, [mara])
    assert.equal(calls, 1, "a missing asset must not be fetched every frame")
    assert.ok(room.node.children.some(o =>
      o.name === "attendant:repair:torso" && o.visible !== false))
    room.dispose()
  } finally {
    console.info = originalInfo
  }
})

// A minimal skinned GLB like ai3d's: one bone, an "idle" clip that turns the
// bone, and the report-only "ai3d_pose_test" clip.
const riggedGltf = () => {
  const scene = new THREE.Group()
  const bone = new THREE.Bone()
  bone.name = "mixamorigHips"
  const geometry = new THREE.BoxGeometry(0.65, 1.75, 0.45)
  const count = geometry.attributes.position.count
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(new Array(count * 4).fill(0), 4))
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(
    Array.from({length: count * 4}, (_, i) => (i % 4 === 0 ? 1 : 0)), 4))
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial())
  mesh.add(bone)
  mesh.bind(new THREE.Skeleton([bone]))
  scene.add(mesh)
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
  const idle = new THREE.AnimationClip("idle", 2, [
    new THREE.QuaternionKeyframeTrack("mixamorigHips.quaternion", [0, 1, 2],
      [0, 0, 0, 1, ...turn.toArray(), 0, 0, 0, 1]),
  ])
  const test = new THREE.AnimationClip("ai3d_pose_test", 4, [
    new THREE.QuaternionKeyframeTrack("mixamorigHips.quaternion", [0, 4], [0, 0, 0, 1, 1, 0, 0, 0]),
  ])
  return {scene, animations: [test, idle], bone, mesh}
}

test("the idle clip is chosen; the report's pose test never plays in game", () => {
  const clip = name => new THREE.AnimationClip(name, 1, [])
  assert.equal(pickIdleClip([clip("ai3d_pose_test"), clip("idle")]).name, "idle")
  assert.equal(pickIdleClip([clip("ai3d_pose_test"), clip("Breathing Idle")]).name, "Breathing Idle")
  assert.equal(pickIdleClip([clip("ai3d_pose_test"), clip("wave")]).name, "wave")
  assert.equal(pickIdleClip([clip("ai3d_pose_test")]), null)
  assert.equal(pickIdleClip(undefined), null)
})

test("the animator loops idle and keeps skinned meshes from being culled", () => {
  const gltf = riggedGltf()
  const animator = createCharacterAnimator(THREE, gltf)
  assert.equal(animator.clip, "idle")
  assert.equal(gltf.mesh.frustumCulled, false)
  animator.update(1) // halfway through the 2 s loop: quarter turn
  const angle = 2 * Math.acos(Math.min(1, Math.abs(gltf.bone.quaternion.w)))
  assert.ok(Math.abs(angle - Math.PI / 2) < 1e-3, `bone turned ${angle}`)
  animator.update(1) // loops back to the start
  assert.ok(Math.abs(gltf.bone.quaternion.w) > 0.999)
  animator.update(Number.NaN) // bad frame deltas are ignored
  animator.dispose()
  assert.equal(createCharacterAnimator(THREE, {scene: new THREE.Group(), animations: []}), null)
})

test("Green Starbase plays Mara's idle every frame and stops it on dispose", async () => {
  const scene = new THREE.Scene()
  const gltf = riggedGltf()
  const room = new GreenStarbaseInterior(THREE, scene, {
    lowPower: true, loadGltf: () => Promise.resolve(gltf),
  })
  room.update({x: 0, z: 43}, 1000, [mara])
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(room.characterAnimators.length, 1)
  const before = gltf.bone.quaternion.clone()
  room.update({x: 0, z: 43}, 1050, [mara])
  room.update({x: 0, z: 43}, 1100, [mara])
  assert.ok(gltf.bone.quaternion.angleTo(before) > 1e-3, "idle advances with frame time")
  room.dispose()
  assert.equal(room.characterAnimators.length, 0)
})
