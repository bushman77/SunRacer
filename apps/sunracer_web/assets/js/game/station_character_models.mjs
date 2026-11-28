// Visual-only character assets. Identity, proximity, dialogue and location
// always come from Core.World.StationAttendants via MapServer snapshots.
// Keys are Core.World.StationAttendants ids. Make a model with ai3d:
//   bash make_character.sh --name NAME --image|--prompt-file ... --install-as FILE
export const STATION_CHARACTER_ASSETS = Object.freeze({
  repair: "/images/game/station/mara_venn.glb",       // Mara Venn
  trade: "/images/game/station/tarek_sol.glb",           // Tarek Sol
  resupply: "/images/game/station/sera_vale.glb",     // Sera Vale
  outfitting: "/images/game/station/ilya_quill.glb",  // Ilya Quill
  missions: "/images/game/station/juno_rook.glb",     // Juno Rook
})

// Blender exports metres; the station's procedural characters are ~9 local
// units high. Fit from the exported bounds instead of assuming Blender scale
// or origin. Mara's current Blender export already faces the repair kiosk
// visitors without an additional 180-degree yaw.
export function positionStationCharacter(THREE, gltf, npc, {
  floorY = -4.65, height = 8.5,
} = {}) {
  if (!gltf?.scene || !Number.isFinite(npc?.x) || !Number.isFinite(npc?.z)) {
    throw new Error("Invalid station character or GLB scene")
  }
  const root = gltf.scene
  root.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(root)
  const sizeY = bounds.max.y - bounds.min.y
  if (!Number.isFinite(sizeY) || sizeY <= 0 ||
      !Number.isFinite(bounds.min.x) || !Number.isFinite(bounds.max.x) ||
      !Number.isFinite(bounds.min.z) || !Number.isFinite(bounds.max.z)) {
    throw new Error("Station GLB has empty or invalid geometry")
  }
  const scale = height / sizeY
  const xMiddle = (bounds.min.x + bounds.max.x) / 2
  const zMiddle = (bounds.min.z + bounds.max.z) / 2
  const anchor = new THREE.Group()
  anchor.name = "station-character:" + npc.id
  anchor.userData.nonInteractive = true
  anchor.position.set(npc.x, floorY, npc.z)
  anchor.rotation.y = 0

  const fitted = new THREE.Group()
  fitted.scale.setScalar(scale)
  fitted.position.set(-xMiddle * scale, -bounds.min.y * scale, -zMiddle * scale)
  fitted.add(root)
  anchor.add(fitted)
  return anchor
}

// ai3d exports "idle" (looping) plus "ai3d_pose_test" (a deformation check
// for its report, never for gameplay). Prefer idle; otherwise any clip that
// is not the test; otherwise none (the character simply stands still).
export function pickIdleClip(clips = []) {
  const usable = clips.filter(clip => clip && !/pose_test/i.test(clip.name || ""))
  return usable.find(clip => clip.name === "idle") ||
    usable.find(clip => /idle/i.test(clip.name || "")) || usable[0] || null
}

// A stable 0..1 number per attendant id. Used to offset each character's idle
// so two of them never start on the same frame, and to vary playback slightly
// so they never drift back into lockstep. Deterministic on purpose: the same
// pilot sees the same station on every visit, and tests stay reproducible.
export function characterPhase(id = "") {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 9973) / 9973
}

// ai3d's generated idle rotates only Hips, Spine1, Spine2, Neck and Head; the
// arms carry two STEP keyframes and never move, which is what reads as stiff.
// These add a shallow pendulum on top. The mixer rewrites every bone it has a
// track for on each update, so this is applied after it and cannot accumulate.
const ARM_SWAY_RADIANS = 0.045 // ~2.6 degrees
const ARM_BONES = [
  {bone: "mixamorigLeftArm", child: "mixamorigLeftForeArm", side: 1},
  {bone: "mixamorigRightArm", child: "mixamorigRightForeArm", side: -1},
]

// Blender exports the joints as "mixamorig:LeftArm", but THREE's
// PropertyBinding strips ":" from node names and GLTFLoader sanitizes on the
// way in, so the loaded bone is "mixamorigLeftArm". Match on a form that
// ignores the difference rather than on either spelling.
const boneKey = name => String(name ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase()

// True when a track's values actually change over its keyframes. ai3d writes
// a rotation track for all 25 joints, but the arm ones hold a single repeated
// value. THREE's PropertyMixer skips writing a value that has not changed, so
// a constant track means nothing touches that bone after the first frame.
export function trackMoves(track, epsilon = 1e-6) {
  const values = track?.values
  const stride = track?.getValueSize?.()
  if (!values || !stride || values.length <= stride) return false
  for (let i = stride; i < values.length; i++) {
    if (Math.abs(values[i] - values[i % stride]) > epsilon) return true
  }
  return false
}

// The swing axis is derived from where the limb actually points in the rest
// pose rather than assumed, so it stays correct whatever axis convention the
// exporter used, then converted into the bone's own space because that is
// what the mixer writes.
export function armSwingAxis(THREE, bone, child) {
  if (!bone || !child) return null
  const head = new THREE.Vector3()
  const tail = new THREE.Vector3()
  bone.getWorldPosition(head)
  child.getWorldPosition(tail)
  const direction = tail.sub(head)
  if (!(direction.lengthSq() > 1e-10)) return null
  direction.normalize()
  const axis = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 0, 1))
  if (!(axis.lengthSq() > 1e-8)) return null // limb already points along +Z
  axis.normalize()
  const inverse = new THREE.Quaternion()
  bone.getWorldQuaternion(inverse).invert()
  return axis.applyQuaternion(inverse).normalize()
}

// Plays the character's idle loop. Presentation only: nothing is networked.
// Returns null when the GLB has no usable animation.
export function createCharacterAnimator(THREE, gltf, {
  phase = 0, rate = 1, sway = ARM_SWAY_RADIANS,
} = {}) {
  const clip = pickIdleClip(gltf?.animations)
  if (!clip || !gltf?.scene || typeof THREE.AnimationMixer !== "function") return null
  // Bounds are computed from the rest pose; an animated skinned mesh can
  // move outside them, so never let the camera frustum cull it mid-pose.
  gltf.scene.traverse?.(node => {
    if (node.isSkinnedMesh) node.frustumCulled = false
  })
  const mixer = new THREE.AnimationMixer(gltf.scene)
  const action = mixer.clipAction(clip)
  action.setLoop(THREE.LoopRepeat, Infinity)
  action.play()
  // Start somewhere else in the loop and run fractionally off nominal speed,
  // so a room full of attendants does not breathe in unison.
  action.setEffectiveTimeScale(rate)
  action.time = (Number.isFinite(phase) ? phase : 0) * clip.duration
  mixer.update(0) // first rendered frame already shows the idle, not the T-pose

  const bones = new Map()
  gltf.scene.traverse?.(node => {
    const key = boneKey(node?.name)
    if (key && !bones.has(key)) bones.set(key, node)
  })
  const arms = []
  if (sway > 0 && typeof THREE.Quaternion === "function") {
    // Only arms the clip leaves motionless are swung. If a future clip really
    // animates them, it owns the bone and the swing stays out of its way.
    const animated = new Set((clip.tracks || [])
      .filter(track => /\.quaternion$/.test(track.name || "") && trackMoves(track))
      .map(track => boneKey((track.name || "").replace(/\.quaternion$/, ""))))
    for (const spec of ARM_BONES) {
      if (animated.has(boneKey(spec.bone))) continue
      const bone = bones.get(boneKey(spec.bone))
      const axis = armSwingAxis(THREE, bone, bones.get(boneKey(spec.child)))
      if (!axis) continue
      // Composed from the pose the clip settled on, never from last frame's
      // result, so the swing can never accumulate.
      arms.push({bone, axis, side: spec.side, base: bone.quaternion.clone()})
    }
  }
  const swingQuat = arms.length ? new THREE.Quaternion() : null
  let elapsed = action.time

  return {
    clip: clip.name,
    mixer,
    arms: arms.length,
    update(delta) {
      if (!Number.isFinite(delta) || delta <= 0) return
      mixer.update(delta)
      elapsed += delta * rate
      // Slower than the idle's own 8 s cycle and offset per side, so the two
      // never line up into a march.
      for (const arm of arms) {
        const angle = Math.sin(elapsed * 0.55 + arm.side * 0.9) * sway * arm.side
        arm.bone.quaternion.copy(arm.base)
          .multiply(swingQuat.setFromAxisAngle(arm.axis, angle))
      }
    },
    dispose() {
      mixer.stopAllAction()
      mixer.uncacheRoot(gltf.scene)
    },
  }
}

// Release only imported GLB resources; the procedural station's shared
// materials and geometry belong to GreenStarbaseInterior.dispose().
export function disposeStationCharacter(root) {
  if (!root) return
  const geometries = new Set()
  const materials = new Set()
  const textures = new Set()
  root.traverse?.(node => {
    if (node.geometry) geometries.add(node.geometry)
    for (const material of (Array.isArray(node.material) ?
      node.material : node.material ? [node.material] : [])) {
      materials.add(material)
    }
  })
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value && value.isTexture) textures.add(value)
    }
  }
  for (const geometry of geometries) geometry.dispose?.()
  for (const texture of textures) texture.dispose?.()
  for (const material of materials) material.dispose?.()
}
