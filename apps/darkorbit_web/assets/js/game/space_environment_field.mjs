// Deterministic visual-only scenery in LOCAL tactical coordinates. No damage,
// targeting, navigation or collision authority is defined in this module.
export const ENVIRONMENT_CELL_SIZE = 240
const KINDS=new Set(["open_space","asteroid_belt","orbital_debris","ion_storm"])

function hash(input) {
  let seed=2166136261
  for(let i=0;i<input.length;i++){
    seed^=input.charCodeAt(i)
    seed=Math.imul(seed,16777619)
  }
  return seed>>>0
}
function rng(seed){
  let s=seed>>>0
  return ()=>{
    s=(Math.imul(s,1664525)+1013904223)>>>0
    return s/4294967296
  }
}

export function environmentFieldKey(profile,position,mapId=""){
  if(!KINDS.has(profile?.kind)||profile?.visual_only!==true||
    typeof profile.region_id!=="string"||
    ![position?.x,position?.y,position?.z,profile?.intensity].every(Number.isFinite)||
    [position.x,position.y,position.z].some(n=>Math.abs(n)>1e8))return null
  const xyz=[position.x,position.y,position.z].map(n=>
    Math.floor(n/ENVIRONMENT_CELL_SIZE))
  const bucket=Math.floor(Math.max(0,Math.min(1,profile.intensity))*12)
  return [String(mapId),profile.region_id,profile.kind,bucket,...xyz].join(":")
}

export function environmentFieldObjects(profile,position,mapId=""){
  if(!environmentFieldKey(profile,position,mapId))return []
  const cell=ENVIRONMENT_CELL_SIZE
  const [cx,cy,cz]=[position.x,position.y,position.z].map(n=>Math.floor(n/cell))
  const intensity=Math.max(0,Math.min(1,profile.intensity))
  const density=intensity*(profile.kind==="ion_storm"?2.8:
    profile.kind==="asteroid_belt"?2.5:
    profile.kind==="orbital_debris"?2.0:1.8)
  const result=[]
  // All overlapping cells retain their exact object IDs and coordinates.
  for(let ix=cx-2;ix<=cx+2;ix++){
    for(let iy=cy-1;iy<=cy+1;iy++){
      for(let iz=cz-2;iz<=cz+2;iz++){
        const salt=String(mapId)+"/"+profile.region_id+"/"+ix+"/"+iy+"/"+iz
        const random=rng(hash(salt))
        const whole=Math.floor(density)
        const count=whole+(random()<density-whole?1:0)
        for(let i=0;i<count;i++){
          const x=(ix+random())*cell
          const y=(iy+random())*cell
          const z=(iz+random())*cell
          const size=profile.kind==="ion_storm"?
            1+random()*4:1.5+Math.pow(random(),2)*20
          const rx=random()*Math.PI*2
          const ry=random()*Math.PI*2
          const rz=random()*Math.PI*2
          if(Math.hypot(x-position.x,y-position.y,z-position.z)<32)continue
          result.push({id:salt+"/"+i,x,y,z,size,rx,ry,rz})
        }
      }
    }
  }
  return result
}
