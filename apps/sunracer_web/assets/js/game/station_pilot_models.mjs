// Display-only avatars. Server owns pose, room topology and docking.
export function stationPilotRows(rows, selfId) {
  const seen = new Set()
  return (Array.isArray(rows) ? rows : []).filter(row => {
    if (!row || !Number.isInteger(row.player_id) || String(row.player_id) === String(selfId) ||
        seen.has(row.player_id) || typeof row.pilot_name !== "string" ||
        typeof row.room_id !== "string" ||
        ![row.x, row.z, row.yaw].every(Number.isFinite)) return false
    seen.add(row.player_id)
    return true
  })
}

export function blendStationPilot(from, target, seconds) {
  const dt = Math.max(0, Math.min(.1, Number(seconds) || 0))
  const distance = Math.hypot(target.x-from.x, target.z-from.z)
  // Snap room transitions/large corrections instead of walking through walls.
  if (from.room_id !== target.room_id || distance > 12) return {...target}
  const blend = 1-Math.exp(-dt/.14)
  const angle = Math.atan2(Math.sin(target.yaw-from.yaw), Math.cos(target.yaw-from.yaw))
  return {...target, x:from.x+(target.x-from.x)*blend,
    z:from.z+(target.z-from.z)*blend, yaw:from.yaw+angle*blend}
}

function nameplate(T, name) {
  if (typeof document === "undefined" || !T.CanvasTexture || !T.Sprite) return null
  const canvas=document.createElement("canvas")
  canvas.width=512;canvas.height=96
  const ctx=canvas.getContext("2d")
  if(!ctx)return null
  ctx.fillStyle="rgba(4,17,30,.85)";ctx.fillRect(0,0,512,96)
  ctx.strokeStyle="#67e8f9";ctx.lineWidth=4;ctx.strokeRect(2,2,508,92)
  ctx.font="bold 38px monospace";ctx.textAlign="center";ctx.textBaseline="middle"
  ctx.fillStyle="#e2f9ff";ctx.fillText(name,256,48,480)
  const texture=new T.CanvasTexture(canvas)
  const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false}))
  sprite.position.set(0,5.8,0);sprite.scale.set(12,2.25,1)
  return sprite
}

export class StationPilotModels {
  constructor(T, parent) {this.T=T;this.parent=parent;this.models=new Map()}

  create(row) {
    const T=this.T,root=new T.Group()
    root.name="station-pilot:"+row.player_id
    root.userData.nonInteractive=true
    const suit=new T.MeshStandardMaterial({color:0x477b9b,roughness:.65,metalness:.2})
    const dark=new T.MeshStandardMaterial({color:0x192b3a,roughness:.8})
    const helmet=new T.MeshStandardMaterial({color:0xc1d5e5,roughness:.45,metalness:.3})
    const visor=new T.MeshBasicMaterial({color:0x56d7e5})
    const materials=[suit,dark,helmet,visor],geometries=[]
    const mesh=(parent,g,m,x,y,z)=>{
      const node=new T.Mesh(g,m);node.position.set(x,y,z);parent.add(node);geometries.push(g);return node
    }
    mesh(root,new T.CylinderGeometry(1.08,.78,3.3,10),suit,0,.05,0)
    mesh(root,new T.BoxGeometry(1.75,.35,1.45),dark,0,-1.55,0)
    mesh(root,new T.SphereGeometry(.96,14,10),helmet,0,2.75,0)
    // Neutral yaw faces -Z, matching the station camera.
    mesh(root,new T.BoxGeometry(1.45,.65,.3),visor,0,2.86,-.77)
    mesh(root,new T.BoxGeometry(1.25,1.9,.65),dark,0,.4,.92)
    const limbs=[]
    for(const side of [-1,1]){
      const leg=new T.Group();leg.position.set(side*.55,-1.45,0);root.add(leg)
      mesh(leg,new T.CylinderGeometry(.37,.30,2.6,8),dark,0,-1.3,0)
      mesh(leg,new T.BoxGeometry(.8,.48,1.15),dark,0,-3.03,-.16)
      const arm=new T.Group();arm.position.set(side*1.23,1.1,0);root.add(arm)
      mesh(arm,new T.CylinderGeometry(.34,.27,2.7,8),suit,0,-1.35,0)
      mesh(arm,new T.SphereGeometry(.32,8,6),dark,0,-2.77,0)
      limbs.push({leg,arm,side})
    }
    const label=nameplate(T,row.pilot_name)
    if(label)root.add(label)
    this.parent.add(root)
    return {root,materials,geometries,label,limbs,pose:{...row},name:row.pilot_name,phase:0}
  }

  remove(id) {
    const model=this.models.get(id)
    if(!model)return
    this.parent.remove(model.root)
    model.geometries.forEach(g=>g.dispose())
    model.materials.forEach(m=>m.dispose())
    if(model.label){model.label.material.map?.dispose();model.label.material.dispose()}
    this.models.delete(id)
  }

  update(rows,selfId,dt) {
    const active=new Set()
    for(const row of stationPilotRows(rows,selfId)){
      const id=row.player_id;active.add(id)
      let model=this.models.get(id)
      if(model&&model.name!==row.pilot_name){this.remove(id);model=null}
      if(!model){model=this.create(row);this.models.set(id,model)}
      const prior=model.pose
      model.pose=blendStationPilot(prior,row,dt)
      const moved=Math.hypot(model.pose.x-prior.x,model.pose.z-prior.z)
      const walking=prior.room_id===row.room_id&&moved>.005&&moved<8
      if(walking)model.phase+=dt*9
      for(const {leg,arm,side} of model.limbs){
        const swing=walking?Math.sin(model.phase)*side*.5:0
        leg.rotation.x=swing;arm.rotation.x=-swing*.7
      }
      model.root.position.set(model.pose.x,0,model.pose.z)
      model.root.rotation.y=-model.pose.yaw
    }
    for(const id of this.models.keys())if(!active.has(id))this.remove(id)
  }

  dispose(){for(const id of this.models.keys())this.remove(id)}
}
