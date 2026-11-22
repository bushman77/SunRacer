// Local visual-only twin-wing shot. Trace no targets and assign no damage.
// Geometry mirrors Core.Combat.LineOfFire and StereoSpaceView.setCamera.
import {normalizeOrientation, rotateVector} from "./orientation_interpolation.mjs"

export const LOCAL_LASER_PREVIEW_MS = 115
export const LOCAL_LASER_MATCH_MS = 1500
export const REMOTE_LASER_DISPLAY_MS = 550
export const LASER_SCENE_SCALE = 0.06
const valid = p => Boolean(p && ["x","y","z"].every(k =>
  Number.isFinite(p[k]) && Math.abs(p[k]) < 1e12))
const toWorld = (position,q,offset) => {
  const rotated=rotateVector(q,offset)
  return {x:position.x+rotated.x/LASER_SCENE_SCALE,
    y:position.y+rotated.z/LASER_SCENE_SCALE,
    z:position.z+rotated.y/LASER_SCENE_SCALE}
}

export function instantLaserPreview(ship, now) {
  const pos=ship?.render
  const pose=ship?.renderOrientation || ship?.orientation
  if (!valid(pos) || !pose || !Number.isFinite(now) ||
      !["x","y","z","w"].every(k=>Number.isFinite(pose[k]))) return []
  const q=normalizeOrientation(pose)
  const distance=Number.isFinite(ship.attackRange) && ship.attackRange>0
    ? Math.min(ship.attackRange,10000) : 540
  // Pilot eye is (0,2.75,0) in ship-local scene units.
  const target=toWorld(pos,q,{x:0,y:2.75,z:-distance*LASER_SCENE_SCALE})
  return [-1,1].map((sign,i)=>({
    from:toWorld(pos,q,{x:sign*1.75,y:1.3,z:-3.2}),
    to:{...target}, side:i===0?"left":"right",
    hit:false,preview:true,startedAt:now,expiresAt:now+LOCAL_LASER_PREVIEW_MS,
  }))
}

export function takePreviewForConfirmedShot(queue,at) {
  while (queue.length && at-queue[0].at>LOCAL_LASER_MATCH_MS) queue.shift()
  return queue.shift() || null
}
