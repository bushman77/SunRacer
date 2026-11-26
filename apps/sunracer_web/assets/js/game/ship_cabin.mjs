// Cabin pose is presentation-only. It never changes the strategic or tactical ship.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const axis = v => Number.isFinite(v) ? clamp(v, -1, 1) : 0
export const EMPTY_WALK = Object.freeze({forward: 0, strafe: 0, turn: 0})
export const CABIN_START = Object.freeze({x: 0, z: -8, yaw: Math.PI})
export function canWalkInTransit({flightState, displayMode, pendingEncounter, headsetActive}) {
  return flightState === "cruise" && displayMode === "3d" && !pendingEncounter && !headsetActive
}
export function advanceCabinPose(pose, axes, seconds) {
  const dt = Number.isFinite(seconds) ? clamp(seconds, 0, .1) : 0
  const yaw = pose.yaw + axis(axes.turn) * 1.9 * dt
  const f = axis(axes.forward), s = axis(axes.strafe)
  const scale = 3.8 * dt / Math.max(1, Math.hypot(f, s))
  return {
    yaw,
    x: clamp(pose.x + (Math.sin(yaw) * f + Math.cos(yaw) * s) * scale, -2.5, 2.5),
    z: clamp(pose.z + (-Math.cos(yaw) * f + Math.sin(yaw) * s) * scale, -12.3, 12.3),
  }
}
export function cabinRoom(z) {
  return z < -5 ? "Bridge" : z > 5 ? "Engineering" : "Crew quarters"
}

// Lightweight procedural interior for the starting Sunracer. The walking
// corridor is deliberately clear; furniture sits outside its bounded path.
export function createCabinScene(T) {
  const scene = new T.Scene()
  scene.background = new T.Color(0x061019)
  const metal = new T.MeshStandardMaterial({color:0x263746,roughness:.76,metalness:.32})
  const deck = new T.MeshStandardMaterial({color:0x172831,roughness:.88})
  const trim = new T.MeshStandardMaterial({color:0x40576a,roughness:.6})
  const glow = new T.MeshBasicMaterial({color:0x65e7dc})
  const amber = new T.MeshBasicMaterial({color:0xffbd66})
  const dark = new T.MeshStandardMaterial({color:0x091625,roughness:.7})
  const box = (w,h,d,x,y,z,mat) => {
    const node = new T.Mesh(new T.BoxGeometry(w,h,d),mat)
    node.position.set(x,y,z)
    scene.add(node)
    return node
  }
  box(9,.3,27,0,-.15,0,deck)
  box(9,.3,27,0,4.3,0,metal)
  for (const side of [-1,1]) {
    box(.3,4.3,27,side*4.5,2.15,0,metal)
    box(.12,.12,26,side*4.28,3.55,0,glow)
    box(.08,.03,26,side*2.72,.02,0,glow)
    for (let z=-11;z<=11;z+=4) {
      box(.36,4.2,.32,side*4.18,2.1,z,trim)
      box(.65,.12,.42,side*3.7,4.05,z,glow)
    }
    // Bridge consoles, sleeping berths and engineering racks.
    box(1.45,1.15,4,side*3.58,.58,-9,trim)
    box(1.05,.08,3.5,side*3.58,1.2,-9,glow)
    box(1.6,.65,3.3,side*3.54,.33,-.8,dark)
    box(1.45,.18,3.15,side*3.54,.75,-.8,trim)
    box(1.35,2.9,4.8,side*3.58,1.45,9,trim)
    for (let z=7;z<=11;z+=1) box(.1,.22,.45,side*2.86,2.1,z,amber)
  }
  for (const z of [-13.5,13.5]) box(9,4.3,.3,0,2.15,z,metal)
  for (const z of [-5,5]) {
    for (const side of [-1,1]) box(1.55,4.2,.26,side*3.68,2.1,z,trim)
    box(5.8,.55,.32,0,3.95,z,trim)
    box(5.7,.09,.35,0,3.61,z,glow)
  }
  for (let z=-12;z<=12;z+=2) box(5.3,.018,.035,0,.01,z,trim)
  // Forward viewport-like instrument bank and aft reactor indicator.
  box(5,1.8,.14,0,2.65,-13.28,dark)
  box(4.6,.08,.15,0,3.3,-13.17,glow)
  box(3.6,1.8,.14,0,2.6,13.28,dark)
  box(3.2,.12,.16,0,2.6,13.17,amber)
  scene.add(new T.HemisphereLight(0xc9e5f7,0x304655,2.4))
  for (const z of [-9,0,9]) {
    const light = new T.PointLight(0xbcefff,23,12,1.4)
    light.position.set(0,3.8,z)
    scene.add(light)
  }
  return scene
}
