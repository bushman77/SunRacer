// Presentation only. Weapon boresight and headset interaction have separate
// reference frames and geometry. No change to server aim or dwell semantics.
export const CROSSHAIR_INNER = 0.085
export const CROSSHAIR_OUTER = 0.135
export const CROSSHAIR_HALF_WIDTH = 0.006
export const GAZE_BASE_DISTANCE = 1.65

export function createLaserCrosshairGeometry(THREE) {
  const inner = CROSSHAIR_INNER, outer = CROSSHAIR_OUTER, w = CROSSHAIR_HALF_WIDTH
  const vertices = []
  // Counterclockwise triangles: visible from the cockpit looking down -Z.
  for (const [x0,y0,x1,y1] of [
    [-outer,-w,-inner,w], [inner,-w,outer,w],
    [-w,-outer,w,-inner], [-w,inner,w,outer],
  ]) {
    vertices.push(x0,y0,0, x1,y0,0, x1,y1,0,
      x0,y0,0, x1,y1,0, x0,y1,0)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
  return geometry
}

export function placeGazeCursor(ring, arc, hitDistance, farDistance) {
  const distance = Number.isFinite(hitDistance) && hitDistance > 0.5
    ? hitDistance : farDistance
  for (const mesh of [ring, arc]) {
    if (!mesh) continue
    mesh.position.z = -distance
    mesh.scale.setScalar(distance / GAZE_BASE_DISTANCE)
  }
}
