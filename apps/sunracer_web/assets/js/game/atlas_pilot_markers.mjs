// Strategic position is an anchor, not a tactical cockpit coordinate.
// Display offsets only separate overlapping labels/miniatures.
export const PILOT_COLORS=Object.freeze({party:"#6ef5a4",guild:"#c4a0ff",neutral:"#e2e8f0"})

export function atlasPilotMarkers(pilots, project){
  const stacks=new Map(),markers=[]
  for(const pilot of Array.isArray(pilots)?pilots:[]){
    if(!pilot||!Number.isInteger(pilot.pilot_id)||typeof pilot.pilot_name!=="string"||
       !Object.hasOwn(PILOT_COLORS,pilot.relation)||!pilot.position_km)continue
    const point=project(pilot.position_km)
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))continue
    const key=point.x.toFixed(2)+":"+point.y.toFixed(2)+":"+(point.z||0).toFixed(2)
    const stack=stacks.get(key)||0
    stacks.set(key,stack+1)
    markers.push({pilot,point,stack,color:PILOT_COLORS[pilot.relation]})
  }
  return markers
}

// Player exterior geometry is +X forward, but server attitude is -Z.
// Apply the basis correction in model-local space AFTER authoritative rotation.
export const PLAYER_MODEL_FORWARD_CORRECTION=Math.PI/2
export function alignRemotePlayerModel(node){
  node.rotateY(PLAYER_MODEL_FORWARD_CORRECTION)
}
