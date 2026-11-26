import {createSunracerModel} from "./sunracer_model.mjs"
import {createScowModel} from "./scow_model.mjs"
import {createDartModel} from "./dart_model.mjs"

export const WAYPOINT_COLOR = "#ffdb57"

export function markerModelClass(kind, shipClass) {
  if(kind==="ship")return "sunracer"
  if(kind==="waypoint")return "peg"
  if(kind==="contact"&&["scow","dart"].includes(shipClass))return shipClass
  return null
}

// Route-derived display bearing, not a claim about tactical attitude.
export function markerHeading(modelClass, from, to) {
  if(!from||!to)return null
  const dx=to.x-from.x,dz=to.z-from.z
  if(!Number.isFinite(dx)||!Number.isFinite(dz)||Math.hypot(dx,dz)<1e-8)return null
  const angle=Math.atan2(dz,dx)
  return modelClass==="sunracer"?-angle:-angle-Math.PI/2
}

export function markerScale(distance, height, fov, length, pixels) {
  return Math.max(.015, Math.min(4, 2*distance*Math.tan(fov*Math.PI/360)*pixels/Math.max(1,height)/length))
}

export function createOrreryMarker(T, modelClass, color) {
  if(modelClass==="peg"){
    const group=new T.Group()
    const mat=new T.MeshBasicMaterial({color:WAYPOINT_COLOR})
    const stem=new T.Mesh(new T.CylinderGeometry(.25,.25,3.6,10),mat)
    stem.position.y=1.8
    const head=new T.Mesh(new T.SphereGeometry(.85,12,8),mat)
    head.position.y=3.7
    const base=new T.Mesh(new T.ConeGeometry(.65,1.1,12),mat)
    base.rotation.z=Math.PI;base.position.y=.55
    group.add(stem,head,base)
    return group
  }
  const group=modelClass==="sunracer"?createSunracerModel(T):
    modelClass==="scow"?createScowModel(T):createDartModel(T)
  // Remove tactical selection rings, which have no meaning in the Atlas.
  const ring=group.userData.ring
  if(ring){group.remove(ring);ring.geometry.dispose();ring.material.dispose();delete group.userData.ring}
  // Separate materials from the cockpit. Retain light/dark geometry contrast
  // while applying the map's cyan, neutral silver or hostile red identity.
  const tint=new T.Color(color)
  const seen=new Set()
  group.traverse(obj=>{
    if(!obj.isMesh)return
    for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){
      if(seen.has(mat))continue
      seen.add(mat)
      if(mat.color){
        const brightness=.45+.55*Math.max(mat.color.r,mat.color.g,mat.color.b)
        mat.color.copy(tint).multiplyScalar(brightness)
      }
      if(mat.emissive){mat.emissive.copy(tint);mat.emissiveIntensity=.38}
      if("metalness" in mat)mat.metalness=.15
    }
  })
  return group
}
