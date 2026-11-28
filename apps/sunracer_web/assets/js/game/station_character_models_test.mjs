import test from "node:test"
import assert from "node:assert/strict"
import * as THREE from "three"
import {GreenStarbaseInterior} from "./green_starbase_interior.js"
import {
  STATION_CHARACTER_ASSETS, positionStationCharacter, disposeStationCharacter,
  pickIdleClip, createCharacterAnimator, characterPhase, armSwingAxis, trackMoves,
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
  const eno = {...mara, id: "comms", x: 16, z: -211, name: "Eno Kade"}
  room.update({x: 0, z: 43}, 100, [mara, eno])
  await Promise.resolve() // Request starts on a microtask, never per frame.
  assert.equal(requested, STATION_CHARACTER_ASSETS.repair)
  resolveModel(meshGltf())
  await new Promise(resolve => setImmediate(resolve))
  const imported = room.node.children.find(o => o.name === "station-character:repair")
  assert.ok(imported, "Mara's Blender model is attached to the shared scene")
  assert.ok(room.node.children.filter(o =>
    o.name?.startsWith("attendant:repair:")).every(o => o.visible === false))
  assert.ok(room.node.children.filter(o =>
    o.name?.startsWith("attendant:comms:")).every(o => o.visible !== false))
  const count = room.node.children.length
  room.update({x: 0, z: 43}, 200, [mara, eno])
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

test("every listed attendant gets its own model; others keep their figures", async () => {
  const scene = new THREE.Scene()
  const requested = []
  const room = new GreenStarbaseInterior(THREE, scene, {
    lowPower: true,
    loadGltf(url) {
      requested.push(url)
      return Promise.resolve(meshGltf())
    },
  })
  const ilya = {...mara, id: "outfitting", x: -49, z: -181, name: "Ilya Quill"}
  const tarek = {...mara, id: "trade", x: 49, name: "Tarek Sol"}
  const supply = {...mara, id: "resupply", x: 49, z: -181, name: "Sera Vale"}
  const juno = {...mara, id: "missions", x: -16, z: -211, name: "Juno Rook"}
  const eno = {...mara, id: "comms", x: 16, z: -211, name: "Eno Kade"}
  room.update({x: 0, z: 43}, 100, [mara, ilya, tarek, supply, juno, eno])
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requested.sort(), [STATION_CHARACTER_ASSETS.outfitting,
    STATION_CHARACTER_ASSETS.repair, "/images/game/station/tarek_sol.glb",
    "/images/game/station/sera_vale.glb", "/images/game/station/juno_rook.glb"].sort())
  for (const id of ["repair", "outfitting", "trade", "resupply", "missions"]) {
    assert.ok(room.node.children.some(o => o.name === `station-character:${id}`))
    assert.ok(room.node.children.filter(o => o.name?.startsWith(`attendant:${id}:`))
      .every(o => o.visible === false))
  }
  assert.ok(room.node.children.filter(o => o.name?.startsWith("attendant:comms:"))
    .every(o => o.visible !== false), "Eno Kade keeps his procedural figure")
  room.update({x: 0, z: 43}, 200, [mara, ilya, tarek, supply, juno, eno])
  assert.equal(requested.length, 5, "no repeated requests")
  room.dispose()
})

// A rig shaped like ai3d's real export: Mixamo-named arm chains hanging down
// the -Y axis, and an idle that drives only the spine, exactly as the
// generated clip does. withArmTracks adds the constant arm rotation tracks
// the real GLBs carry, so both application paths can be exercised.
// prefix "mixamorig" is what GLTFLoader yields after sanitizing; "mixamorig:"
// is what Blender writes. Both must resolve to the same bones.
const armRig = (withArmTracks = true, prefix = "mixamorig") => {
  const scene = new THREE.Group()
  const root = new THREE.Bone()
  root.name = `${prefix}Hips`
  const made = {}
  for (const [side, x] of [["Left", 0.2], ["Right", -0.2]]) {
    const upper = new THREE.Bone()
    upper.name = `${prefix}${side}Arm`
    upper.position.set(x, 1.4, 0)
    const lower = new THREE.Bone()
    lower.name = `${prefix}${side}ForeArm`
    lower.position.set(0, -0.3, 0) // the limb points down, as a hanging arm does
    upper.add(lower)
    root.add(upper)
    made[side] = upper
  }
  scene.add(root)
  scene.updateMatrixWorld(true)
  // THREE strips ":" when binding, so tracks always use the sanitized spelling.
  const tracks = [new THREE.QuaternionKeyframeTrack(
    "mixamorigHips.quaternion", [0, 4], [0, 0, 0, 1, 0, 0, 0, 1])]
  if (withArmTracks) {
    for (const side of ["Left", "Right"]) {
      tracks.push(new THREE.QuaternionKeyframeTrack(
        `mixamorig${side}Arm.quaternion`, [0, 4], [0, 0, 0, 1, 0, 0, 0, 1]))
    }
  }
  return {scene, animations: [new THREE.AnimationClip("idle", 8, tracks)], ...made}
}

test("each attendant gets a stable, distinct idle phase", () => {
  const ids = ["repair", "trade", "resupply", "outfitting", "missions"]
  const phases = ids.map(characterPhase)
  for (const value of phases) {
    assert.ok(value >= 0 && value < 1, `phase ${value} out of range`)
  }
  assert.equal(new Set(phases).size, ids.length, "attendants must not share a phase")
  assert.equal(characterPhase("missions"), characterPhase("missions"), "stable across visits")
  assert.equal(characterPhase(""), characterPhase(""))
})

test("the idle starts at the character's own offset instead of frame zero", () => {
  const atZero = createCharacterAnimator(THREE, armRig())
  const offset = createCharacterAnimator(THREE, armRig(), {phase: 0.5})
  assert.equal(atZero.mixer.clipAction(atZero.mixer._actions[0]._clip).time, 0)
  assert.ok(Math.abs(offset.mixer._actions[0].time - 4) < 1e-6,
    "half a phase into an 8 s clip is 4 s")
  assert.ok(Math.abs(offset.mixer._actions[0].getEffectiveTimeScale() - 1) < 1e-6)
  const slower = createCharacterAnimator(THREE, armRig(), {rate: 0.92})
  assert.ok(Math.abs(slower.mixer._actions[0].getEffectiveTimeScale() - 0.92) < 1e-6)
  atZero.dispose(); offset.dispose(); slower.dispose()
})

test("the swing axis is derived from where the limb points, not assumed", () => {
  const rig = armRig()
  const axis = armSwingAxis(THREE, rig.Left, rig.Left.children[0])
  // A limb hanging along -Y swung forward and back turns about X.
  assert.ok(Math.abs(Math.abs(axis.x) - 1) < 1e-6, `axis was ${axis.toArray()}`)
  assert.ok(Math.abs(axis.y) < 1e-6 && Math.abs(axis.z) < 1e-6)
  const degenerate = new THREE.Bone()
  assert.equal(armSwingAxis(THREE, rig.Left, rig.Left), null, "zero-length limb")
  assert.equal(armSwingAxis(THREE, null, degenerate), null)
})

test("ai3d's motionless arms are given a shallow swing within its amplitude", () => {
  const rig = armRig()
  const animator = createCharacterAnimator(THREE, rig)
  assert.equal(animator.arms, 2, "both arms found by their Mixamo names")
  // The same rig written the way Blender names it must resolve identically.
  const blenderNamed = createCharacterAnimator(THREE, armRig(true, "mixamorig:"))
  assert.equal(blenderNamed.arms, 2, "colon-separated Mixamo names must also match")
  blenderNamed.dispose()
  const rest = new THREE.Quaternion()
  let peak = 0
  let moved = false
  for (let step = 0; step < 60; step++) {
    animator.update(0.25)
    const angle = rig.Left.quaternion.angleTo(rest)
    peak = Math.max(peak, angle)
    if (angle > 1e-4) moved = true
  }
  assert.ok(moved, "the arm must actually move")
  assert.ok(peak <= 0.045 + 1e-6, `swing reached ${peak}, beyond its amplitude`)
  // Opposite sides must not march in step.
  assert.ok(rig.Left.quaternion.angleTo(rig.Right.quaternion) > 1e-5)
  animator.dispose()
})

test("a constant track is not movement; a varying one is", () => {
  const flat = new THREE.QuaternionKeyframeTrack(
    "mixamorigLeftArm.quaternion", [0, 4], [0, 0, 0, 1, 0, 0, 0, 1])
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5)
  const moving = new THREE.QuaternionKeyframeTrack(
    "mixamorigLeftArm.quaternion", [0, 4], [0, 0, 0, 1, ...turn.toArray()])
  assert.equal(trackMoves(flat), false, "ai3d's repeated arm keyframes are not motion")
  assert.equal(trackMoves(moving), true)
  assert.equal(trackMoves(undefined), false)
})

test("an arm the clip genuinely animates is left to the clip", () => {
  const rig = armRig(false)
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5)
  rig.animations[0].tracks.push(new THREE.QuaternionKeyframeTrack(
    "mixamorigLeftArm.quaternion", [0, 4], [0, 0, 0, 1, ...turn.toArray()]))
  const animator = createCharacterAnimator(THREE, rig)
  assert.equal(animator.arms, 1, "only the untouched right arm is swung")
  animator.dispose()
})

test("the swing cannot wind up when the clip has no arm tracks", () => {
  const rig = armRig(false)
  const animator = createCharacterAnimator(THREE, rig)
  assert.equal(animator.arms, 2)
  const rest = new THREE.Quaternion()
  let peak = 0
  for (let step = 0; step < 400; step++) {
    animator.update(0.1)
    peak = Math.max(peak, rig.Left.quaternion.angleTo(rest))
  }
  assert.ok(peak <= 0.045 + 1e-6, `arm wound up to ${peak} without a mixer reset`)
  animator.dispose()
})

test("two attendants on the same clip do not breathe in unison", () => {
  const left = armRig()
  const right = armRig()
  const a = createCharacterAnimator(THREE, left, {phase: characterPhase("repair"), rate: 0.95})
  const b = createCharacterAnimator(THREE, right, {phase: characterPhase("missions"), rate: 1.05})
  for (let step = 0; step < 40; step++) {
    a.update(0.1)
    b.update(0.1)
  }
  assert.ok(left.Left.quaternion.angleTo(right.Left.quaternion) > 1e-4,
    "identical rigs must not hold identical poses")
  a.dispose(); b.dispose()
})

test("sway can be switched off without disturbing the idle", () => {
  const rig = armRig()
  const animator = createCharacterAnimator(THREE, rig, {sway: 0})
  assert.equal(animator.arms, 0)
  animator.update(1)
  assert.ok(rig.Left.quaternion.angleTo(new THREE.Quaternion()) < 1e-9)
  animator.dispose()
})
