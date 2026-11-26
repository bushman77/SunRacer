// Shared current player exterior geometry: bow +X, dorsal +Y.
export function createSunracerModel(THREE) {
  const material = hex => new THREE.MeshStandardMaterial({
    color: hex, metalness: 0.45, roughness: 0.48, emissive: hex, emissiveIntensity: 0.17,
  })
  const root = new THREE.Group()
  root.userData.modelId = "sunracer"
  const hull = new THREE.Mesh(new THREE.ConeGeometry(1.65, 4.8, 4), material(0x95c8ef))
  hull.rotation.z = -Math.PI / 2
  root.add(hull)
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 5.5), material(0x4a718a))
  wing.position.x = -0.7
  root.add(wing)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.08, 5, 48), new THREE.MeshBasicMaterial({color: 0xffa765}))
  ring.position.y = -1.25
  ring.rotation.x = -Math.PI / 2
  ring.visible = false
  root.add(ring)
  root.userData.ring = ring
  return root
}
