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

// Plays the character's idle loop. Presentation only: nothing is networked.
// Returns null when the GLB has no usable animation.
export function createCharacterAnimator(THREE, gltf) {
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
  mixer.update(0) // first rendered frame already shows the idle, not the T-pose
  return {
    clip: clip.name,
    mixer,
    update(delta) {
      if (Number.isFinite(delta) && delta > 0) mixer.update(delta)
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
