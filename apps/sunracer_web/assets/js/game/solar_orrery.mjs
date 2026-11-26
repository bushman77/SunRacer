// Presentation-only 3D Solar Atlas. Three is injected by the shared client,
// so pure projection tests do not require a browser or WebGL.
import {solarLayout, solarPositionToChart, solarChartToPosition} from "./solar_system.mjs"
import {WAYPOINT_COLOR, markerModelClass, markerHeading, markerScale, createOrreryMarker} from "./orrery_markers.mjs"

export const ORRERY_COLORS = Object.freeze({
  background:"#030914", orbit:"#347d9d", active:"#23dfff", silver:"#d9e5f2",
  violet:"#7928ca", magenta:"#e82ac6", amber:"#ffad45", friendly:"#6ef5a4",
  hostile:"#fb7185",
})
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n))

// Diagram coordinates, not physics coordinates. The orbital plane is y=0.
export function chartToOrrery(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y)
    ? {x:point.x-500,y:0,z:point.y-300} : null
}
export function worldToOrrery(position,focus="system") {
  return chartToOrrery(solarPositionToChart(position,focus))
}
export function orreryToWorld(point,focus="system",altitude=0) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.z)
    ? solarChartToPosition(point.x+500,point.z+300,focus,altitude) : null
}
export function orbitCamera({azimuth=0,elevation=.64,distance=670}={}) {
  const angle=clamp(elevation,.18,1.51)
  const radius=clamp(distance,45,1800)
  return {x:radius*Math.cos(angle)*Math.sin(azimuth),
    y:radius*Math.sin(angle),z:radius*Math.cos(angle)*Math.cos(azimuth)}
}

// Pan parallel to the orbital plane, using the perspective scale at the
// orbit target. Compensate for elevation so vertical dragging feels natural
// at any orbit angle while preserving camera height and zoom.
export function panOrrery(target,{azimuth=0,elevation=.64,distance=670},dx,dy,height,fov=48) {
  if(!Number.isFinite(height)||height<=0||!Number.isFinite(dx)||!Number.isFinite(dy))return {...target}
  const units=2*clamp(distance,45,1800)*Math.tan(fov*Math.PI/360)/height
  const along=dy*units/Math.sin(clamp(elevation,.18,1.51))
  const across=-dx*units
  return {x:target.x+across*Math.cos(azimuth)-along*Math.sin(azimuth),
    y:target.y,z:target.z-across*Math.sin(azimuth)-along*Math.cos(azimuth)}
}

// Translate the orbit target as the camera dollies. Both camera and target
// scale about the same world point, keeping its screen projection invariant.
export function zoomAround(target, anchor, distance, requestedDistance) {
  const nextDistance=clamp(requestedDistance,45,1800)
  const ratio=nextDistance/distance
  const point=anchor||target
  return {distance:nextDistance,target:{
    x:point.x+(target.x-point.x)*ratio,
    y:point.y+(target.y-point.y)*ratio,
    z:point.z+(target.z-point.z)*ratio,
  }}
}

export class SolarOrrery {
  constructor(THREE,host,actions={}, {native=false}={}) {
    this.T=THREE
    this.host=host
    this.actions=actions
    this.cameraState={azimuth:.45,elevation:.66,distance:730}
    this.target=new THREE.Vector3()
    this.scene=new THREE.Scene()
    this.camera=new THREE.PerspectiveCamera(48,1,.1,6000)
    // WebKitGTK can composite a second, idle WebGL canvas incorrectly.
    // In the packaged client present the rendered image through a regular
    // canvas, with an explicit retained drawing buffer and a single GPU preference.
    this.native=native
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,
      preserveDrawingBuffer:true,powerPreference:"high-performance"})
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,native?1:1.5))
    this.renderer.setClearColor(0x000000,0)
    this.glCanvas=this.renderer.domElement
    this.canvas=native?document.createElement("canvas"):this.glCanvas
    this.presentation=native?this.canvas.getContext("2d",{willReadFrequently:true}):null
    if(native&&!this.presentation){this.renderer.dispose();throw Error("2D presentation unavailable")}
    this.ready=false
    this.failed=false
    this.canvas.className="orrery-canvas"
    this.canvas.setAttribute("aria-label","3D Solar System orrery. Left drag to pan, middle drag to rotate, wheel to zoom. Select bodies using labeled buttons.")
    this.canvas.tabIndex=0
    this.labels=document.createElement("div")
    this.labels.className="orrery-labels"
    host.replaceChildren(this.canvas,this.labels)
    this.staticGroup=new THREE.Group()
    this.liveGroup=new THREE.Group()
    this.modelGroup=new THREE.Group()
    this.models=new Map()
    this.scene.add(this.staticGroup,this.liveGroup,this.modelGroup)
    this.scene.add(new THREE.AmbientLight(0xaecbff,1.0))
    const light=new THREE.PointLight(0xffe3b0,160000,0,2)
    light.position.set(0,28,0)
    this.scene.add(light)
    const fill=new THREE.DirectionalLight(0xa9ceff,1.1)
    fill.position.set(-100,180,140)
    this.scene.add(fill)
    this.ray=new THREE.Raycaster()
    this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),0)
    this.bodies=[]
    this.liveMarkers=[]
    this.active=false
    this.bind()
    if(typeof ResizeObserver==="function"){
      this.resizeObserver=new ResizeObserver(()=>{if(this.active)this.render()})
      this.resizeObserver.observe(host)
    }
  }

  clear(group) {
    group.traverse(object=>{
      object.geometry?.dispose()
      if(object.material){
        const materials=Array.isArray(object.material)?object.material:[object.material]
        for(const material of materials){material.map?.dispose();material.dispose()}
      }
    })
    group.clear()
  }

  line(group,points,color,opacity=1,loop=false) {
    const T=this.T
    const geometry=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(p.x,p.y,p.z)))
    const material=new T.LineBasicMaterial({color,transparent:opacity<1,opacity})
    const line=loop?new T.LineLoop(geometry,material):new T.Line(geometry,material)
    group.add(line)
    return line
  }

  ring(group,center,radius,color,opacity=.6) {
    const points=Array.from({length:128},(_,i)=>{
      const a=i*Math.PI*2/128
      return {x:center.x+radius*Math.cos(a),y:center.y+.08,z:center.z+radius*Math.sin(a)}
    })
    return this.line(group,points,color,opacity,true)
  }

  // Locally generated, schematic planetary markings, not astronomical imagery.
  texture(body) {
    if(!["earth","jupiter","saturn","mars","neptune","uranus"].includes(body.id))return null
    const canvas=document.createElement("canvas")
    canvas.width=256;canvas.height=128
    const ctx=canvas.getContext("2d")
    if(!ctx)return null
    ctx.fillStyle=body.color;ctx.fillRect(0,0,256,128)
    if(body.id==="earth"){
      ctx.fillStyle="#64866c"
      for(let i=0;i<15;i++){
        const x=(i*71+13)%256,y=18+(i*37)%93
        ctx.beginPath();ctx.ellipse(x,y,9+i%4*4,4+i%5*3,i*.7,0,Math.PI*2);ctx.fill()
      }
      ctx.fillStyle="rgba(225,244,255,.46)"
      for(let i=0;i<14;i++)ctx.fillRect((i*61)%256,(i*29)%128,22+i%3*12,2+i%4)
    }else{
      for(let i=0;i<24;i++){
        ctx.fillStyle=i%2?"rgba(255,240,215,.16)":"rgba(50,25,45,.18)"
        ctx.fillRect(0,i*5.4,256,2+i%4)
      }
    }
    const texture=new this.T.CanvasTexture(canvas)
    texture.colorSpace=this.T.SRGBColorSpace
    return texture
  }

  buildBodies(focus) {
    const T=this.T
    this.clear(this.staticGroup)
    this.bodies=[]
    for(const body of solarLayout(focus)){
      const point=chartToOrrery(body)
      if(body.orbitRadius)this.ring(this.staticGroup,{x:0,y:0,z:0},body.orbitRadius,ORRERY_COLORS.orbit,body.id==="earth"?.8:.43)
      const radius=Math.max(3,body.size*.78)
      const map=this.texture(body)
      const material=body.kind==="star"
        ? new T.MeshBasicMaterial({color:0xffe4a3})
        : new T.MeshStandardMaterial({color:map?0xffffff:body.color,map,roughness:1})
      const mesh=new T.Mesh(new T.SphereGeometry(radius,32,20),material)
      mesh.position.set(point.x,radius,point.z)
      this.staticGroup.add(mesh)
      if(body.kind==="star"){
        for(const [factor,opacity] of [[1.35,.14],[1.8,.07],[2.4,.025]]){
          const halo=new T.Mesh(new T.SphereGeometry(radius*factor,24,16),
            new T.MeshBasicMaterial({color:ORRERY_COLORS.amber,transparent:true,opacity,depthWrite:false}))
          halo.position.copy(mesh.position);this.staticGroup.add(halo)
        }
      }
      if(body.id==="saturn"){
        const rings=new T.Mesh(new T.RingGeometry(radius*1.4,radius*2.35,96),
          new T.MeshBasicMaterial({color:0xcab58f,side:T.DoubleSide,transparent:true,opacity:.7}))
        rings.rotation.x=-Math.PI/2+.23;rings.position.copy(mesh.position);this.staticGroup.add(rings)
        this.ring(this.staticGroup,{x:point.x,y:radius,z:point.z},radius*2.55,0xa49a89,.45)
      }
      this.bodies.push({key:body.id,id:body.id,kind:"body",name:body.name,mesh,point,radius})
    }
  }

  marker(point,key,name,kind,color,radius=5,shipClass=null,destination=null) {
    if(!point)return null
    const T=this.T
    const modelClass=markerModelClass(kind,shipClass)
    let mesh
    if(modelClass){
      const signature=modelClass+":"+color
      let record=this.models.get(key)
      if(record&&record.signature!==signature){this.removeModel(key);record=null}
      if(!record){
        mesh=createOrreryMarker(T,modelClass,color)
        record={mesh,signature}
        this.models.set(key,record)
        this.modelGroup.add(mesh)
      }
      mesh=record.mesh
      const heading=markerHeading(modelClass,point,destination)
      if(heading!==null)mesh.rotation.y=heading
      mesh.position.set(point.x,kind==="waypoint"?.2:1.3,point.z)
    }else{
      mesh=new T.Mesh(new T.OctahedronGeometry(radius),new T.MeshBasicMaterial({color}))
      mesh.position.set(point.x,radius+1,point.z)
      this.liveGroup.add(mesh)
    }
    this.liveMarkers.push({key,id:key,name,kind,mesh,point,radius,color,modelClass})
    return mesh
  }

  removeModel(key) {
    const record=this.models.get(key)
    if(!record)return
    this.modelGroup.remove(record.mesh)
    this.clear(record.mesh)
    this.models.delete(key)
  }

  update(state) {
    this.state=state
    if(this.focus!==state.focus){this.focus=state.focus;this.buildBodies(state.focus)}
    this.clear(this.liveGroup);this.liveMarkers=[]
    const nav=state.navigation
    const locate=id=>this.bodies.find(b=>b.id===id)?.point
    const project=p=>worldToOrrery(p,state.focus)
    const current=project(nav?.position_km)||locate(nav?.location_id)
    const course=nav?.status==="traveling"?(project(nav.destination_position_km)||locate(nav.destination_id)):null
    if(current)this.marker(current,"own-ship","YOUR SHIP","ship",ORRERY_COLORS.active,4,null,course)
    if(nav?.status==="traveling"){
      const a=project(nav.origin_position_km)||locate(nav.origin_id||nav.location_id)
      const b=project(nav.destination_position_km)||locate(nav.destination_id)
      if(a&&b){
        // A schematic course indicator, not a predicted obstacle-avoidance path.
        this.line(this.liveGroup,[{...a,y:1},{...b,y:1}],ORRERY_COLORS.active,.72)
        if(current)this.line(this.liveGroup,[{...current,y:2},{...b,y:2}],0xb5faff,.95)
      }
    }
    for(const base of nav?.starbases||[]){
      if(base.id!=="sol:starbase:green")continue
      this.marker(project(base.position_km),base.id,base.name,"starbase",ORRERY_COLORS.friendly,7)
    }
    for(const contact of nav?.contacts||[]){
      // Never infer a position from a call sign, origin or destination.
      const p=project(contact.position_km)
      if(p)this.marker(p,contact.id,contact.call_sign||"Sensor contact","contact",
        contact.disposition==="hostile"?ORRERY_COLORS.hostile:ORRERY_COLORS.silver,3,
        contact.ship_class,contact.state==="in_transit"?locate(contact.destination_id):null)
    }
    if(state.waypoint&&!state.selectedStarbaseId)
      this.marker(project(state.waypoint),"waypoint","FREE WAYPOINT","waypoint",WAYPOINT_COLOR,5)
    for(const region of nav?.environment_regions||[]){
      if(region.visual_only!==true)continue
      if(region.kind==="asteroid_belt"&&state.focus==="system"){
        const a=project({x:region.inner_radius_km,y:0,z:0})
        const b=project({x:region.outer_radius_km,y:0,z:0})
        if(a&&b&&b.x>a.x)for(let i=0;i<5;i++)
          this.ring(this.liveGroup,{x:0,y:0,z:0},a.x+(b.x-a.x)*i/4,ORRERY_COLORS.amber,.12)
      }else if(["ion_storm","orbital_debris"].includes(region.kind)){
        const p=project(region.center_km)
        if(p)this.marker(p,region.id,region.kind==="ion_storm"?"ION STORM":"ORBITAL DEBRIS",
          "environment",region.kind==="ion_storm"?ORRERY_COLORS.magenta:ORRERY_COLORS.silver,4)
      }
    }
    const selected=state.selectedStarbaseId
      ? this.liveMarkers.find(b=>b.id===state.selectedStarbaseId)
      : state.waypoint?this.liveMarkers.find(b=>b.kind==="waypoint"):this.bodies.find(b=>b.id===state.selectedId)
    if(selected)this.ring(this.liveGroup,selected.point,selected.radius+5,selected.kind==="waypoint"?WAYPOINT_COLOR:ORRERY_COLORS.active,.95)
    const activeModels=new Set(this.liveMarkers.filter(entry=>entry.modelClass).map(entry=>entry.key))
    for(const key of this.models.keys())if(!activeModels.has(key))this.removeModel(key)
    this.syncLabels()
    if(this.active)this.render()
  }

  syncLabels() {
    const entries=[...this.bodies,...this.liveMarkers]
    const keys=new Set(entries.map(e=>e.key))
    for(const node of [...this.labels.children])if(!keys.has(node.dataset.key))node.remove()
    const existing=new Map([...this.labels.children].map(n=>[n.dataset.key,n]))
    for(const entry of entries){
      let label=existing.get(entry.key)
      const interactive=["body","starbase","contact"].includes(entry.kind)
      if(!label){
        label=document.createElement(interactive?"button":"span")
        if(interactive)label.type="button"
        label.className="orrery-label"
        label.dataset.key=entry.key
        this.labels.append(label)
      }
      label.textContent=entry.name
      label.dataset.kind=entry.kind
      label.dataset.hostile=String(entry.color===ORRERY_COLORS.hostile)
      label.dataset.selected=String(entry.kind==="body"?(!this.state.waypoint&&entry.id===this.state.selectedId):
        entry.kind==="starbase"&&entry.id===this.state.selectedStarbaseId)
      if(interactive)label.setAttribute("aria-pressed",label.dataset.selected)
    }
  }

  render() {
    if(!this.active||this.failed||!this.state||!this.bodies.length)return false
    const rect=this.host.getBoundingClientRect()
    const width=Math.round(rect.width),height=Math.round(rect.height)
    if(!width||!height)return false
    try {return this.renderFrame(width,height)}
    catch(error){this.fail(error);return false}
  }

  renderFrame(width,height) {
    if(this.width!==width||this.height!==height){
      this.width=width;this.height=height
      this.renderer.setSize(width,height,false)
      if(this.native){
        this.canvas.width=this.glCanvas.width
        this.canvas.height=this.glCanvas.height
      }
      this.camera.aspect=width/height;this.camera.updateProjectionMatrix()
    }
    const offset=orbitCamera(this.cameraState)
    this.camera.position.set(offset.x+this.target.x,offset.y+this.target.y,offset.z+this.target.z)
    this.camera.lookAt(this.target)
    this.camera.updateMatrixWorld()
    for(const entry of this.liveMarkers){
      if(!entry.modelClass)continue
      const distance=entry.mesh.position.distanceTo(this.camera.position)
      const length=entry.modelClass==="scow"?7:entry.modelClass==="sunracer"?5.5:entry.modelClass==="peg"?4.6:4.5
      const pixels=entry.kind==="ship"?32:entry.kind==="waypoint"?24:25
      entry.mesh.scale.setScalar(markerScale(distance,height,this.camera.fov,length,pixels))
    }
    this.renderer.render(this.scene,this.camera)
    if(this.renderer.getContext().isContextLost()||this.renderer.info.render.calls===0)
      throw Error("WebGL produced no draw calls")
    if(this.presentation){
      this.presentation.clearRect(0,0,this.canvas.width,this.canvas.height)
      this.presentation.drawImage(this.glCanvas,0,0)
      // Validate the initial full-system frame once, not every navigation tick.
      // The Sun is centered in the default camera and must be opaque.
      if(!this.ready){
        const sun=this.bodies.find(b=>b.id==="sun")
        const p=sun?.mesh.position.clone().project(this.camera)
        const x=Math.floor((p.x+1)*this.canvas.width/2)
        const y=Math.floor((1-p.y)*this.canvas.height/2)
        if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=this.canvas.width||y>=this.canvas.height||
          this.presentation.getImageData(x,y,1,1).data[3]===0)
          throw Error("Native orrery frame was empty")
      }
    }
    const entries=new Map([...this.bodies,...this.liveMarkers].map(e=>[e.key,e]))
    const occupied=[]
    // Give selected destinations priority when labels crowd together.
    const labels=[...this.labels.children].sort((a,b)=>Number(b.dataset.selected==="true")-Number(a.dataset.selected==="true"))
    for(const node of labels){
      const entry=entries.get(node.dataset.key)
      if(!entry)continue
      const p=entry.mesh.position.clone().project(this.camera)
      const x=(p.x+1)*width/2,y=(1-p.y)*height/2
      node.hidden=p.z>1||p.z< -1||x<0||x>width||y<0||y>height
      if(node.hidden)continue
      const w=node.offsetWidth||80,h=node.offsetHeight||18
      let pos=null
      for(const [dx,dy] of [[14,-22],[14,12],[-w-14,-22],[-w-14,12],[14,34],[-w-14,34]]){
        const box={x:x+dx,y:y+dy,w,h}
        if(box.x<0||box.x+w>width||box.y<0||box.y+h>height)continue
        if(!occupied.some(a=>a.x<box.x+w&&a.x+a.w>box.x&&a.y<box.y+h&&a.y+a.h>box.y)){pos=box;break}
      }
      // Preserve a keyboard-accessible label even in a crowded inner system.
      pos=pos||{x:clamp(x+14,0,Math.max(0,width-w)),y:clamp(y-22,0,Math.max(0,height-h)),w,h}
      occupied.push(pos)
      node.style.left=pos.x+"px";node.style.top=pos.y+"px"
    }
    this.ready=true
    return true
  }

  fail(error) {
    if(this.failed)return
    this.failed=true;this.active=false;this.ready=false
    console.warn("SpaceNova orrery unavailable:",error)
    this.actions.unavailable?.(String(error?.message||error))
  }

  setActive(active) {
    this.active=active&&!this.failed
    if(this.active)this.render()
  }

  dispose() {
    this.active=false
    this.resizeObserver?.disconnect()
    this.clear(this.staticGroup);this.clear(this.liveGroup)
    for(const key of this.models.keys())this.removeModel(key)
    this.renderer.dispose()
    this.renderer.forceContextLoss?.()
    this.host.replaceChildren()
  }

  entryForEvent(event) {
    const key=event.target?.closest?.("[data-key]")?.dataset.key
    const entries=[...this.bodies,...this.liveMarkers].filter(e=>["body","starbase","contact"].includes(e.kind))
    if(key)return entries.find(e=>e.key===key)
    this.setRay(event)
    const hit=this.ray.intersectObjects(entries.map(e=>e.mesh),true)[0]
    for(let obj=hit?.object;obj;obj=obj.parent){
      const entry=entries.find(e=>e.mesh===obj)
      if(entry)return entry
    }
    return undefined
  }

  setRay(event) {
    const rect=this.canvas.getBoundingClientRect()
    this.ray.setFromCamera({x:(event.clientX-rect.left)/rect.width*2-1,
      y:1-(event.clientY-rect.top)/rect.height*2},this.camera)
  }

  hit(event) {
    if(!this.ready||!this.active||this.failed)return null
    const entry=this.entryForEvent(event)
    if(entry)return {kind:entry.kind,id:entry.id,point:entry.point}
    this.setRay(event)
    const point=this.ray.ray.intersectPlane(this.plane,new this.T.Vector3())
    return point?{kind:"waypoint",position:orreryToWorld(point,this.focus,this.state?.navigation?.position_km?.z??0)}:null
  }

  zoomAnchor(event) {
    // Use a ray through the actual cursor, including when over a DOM label.
    this.setRay(event)
    const ray=this.ray.ray
    const entries=[...this.bodies,...this.liveMarkers]
    const key=event.target?.closest?.("[data-key]")?.dataset.key
    const labeled=key&&entries.find(entry=>entry.key===key)
    if(labeled){
      // Intersect a camera-facing plane at the labeled object's depth, not
      // its center (the label may be offset from the object on screen).
      const normal=this.camera.getWorldDirection(new this.T.Vector3())
      const plane=new this.T.Plane().setFromNormalAndCoplanarPoint(normal,labeled.mesh.position)
      const point=ray.intersectPlane(plane,new this.T.Vector3())
      if(point)return point
    }
    const hit=this.ray.intersectObjects(entries.map(entry=>entry.mesh),true)[0]
    if(hit)return hit.point
    // Empty space: prefer the orbital plane; avoid huge jumps near its horizon.
    const point=ray.intersectPlane(this.plane,new this.T.Vector3())
    if(point&&point.distanceTo(this.camera.position)<=this.cameraState.distance*4)return point
    const normal=this.camera.getWorldDirection(new this.T.Vector3())
    const plane=new this.T.Plane().setFromNormalAndCoplanarPoint(normal,this.target)
    return ray.intersectPlane(plane,new this.T.Vector3())
  }

  zoomAt(event) {
    if(!this.ready||!this.active||this.failed)return
    const units=event.deltaMode===1?16:event.deltaMode===2?this.height:1
    const delta=event.deltaY*units
    if(!Number.isFinite(delta)||delta===0)return
    const distance=this.cameraState.distance
    const requested=distance*Math.exp(clamp(delta,-400,400)*.0012)
    if(clamp(requested,45,1800)===distance)return
    const next=zoomAround(this.target,this.zoomAnchor(event),distance,requested)
    this.target.set(next.target.x,next.target.y,next.target.z)
    this.cameraState.distance=next.distance
    this.render()
  }

  reset() {
    this.cameraState={azimuth:.45,elevation:.66,distance:730}
    this.target.set(0,0,0);this.render()
  }

  bind() {
    let drag=null, suppressClick=false, suppressDoubleClick=false
    this.host.addEventListener("pointerdown",event=>{
      if(!this.active||!this.ready||drag||![0,1].includes(event.button))return
      suppressClick=false
      const rotate=event.button===1
      drag={x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,
        id:event.pointerId,rotate,moved:rotate}
      // Do not capture a left press yet: ordinary DOM label clicks must
      // still reach their original button, including keyboard focus.
      if(rotate){
        event.preventDefault()
        this.host.setPointerCapture?.(event.pointerId)
        this.host.dataset.dragging="rotate"
      }
    })
    this.host.addEventListener("pointermove",event=>{
      if(!drag||event.pointerId!==drag.id)return
      if(!drag.moved){
        if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<5)return
        drag.moved=true
        suppressClick=true;suppressDoubleClick=true
        this.host.setPointerCapture?.(event.pointerId)
        this.host.dataset.dragging="pan"
      }
      event.preventDefault()
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y
      if(drag.rotate){
        this.cameraState.azimuth-=dx*.008
        this.cameraState.elevation=clamp(this.cameraState.elevation+dy*.007,.18,1.51)
      }else{
        const next=panOrrery(this.target,this.cameraState,dx,dy,this.height,this.camera.fov)
        this.target.set(next.x,next.y,next.z)
      }
      drag.x=event.clientX;drag.y=event.clientY;this.render()
    })
    const finishDrag=event=>{
      if(drag?.id!==event.pointerId)return
      // Implicit capture on a touch target can be replaced by host capture;
      // ignore the child's lostpointercapture while the host owns the drag.
      if(event.type==="lostpointercapture"&&event.target!==this.host)return
      if(event.type==="pointerleave"&&drag.moved)return
      drag=null
      delete this.host.dataset.dragging
    }
    for(const type of ["pointerup","pointercancel","lostpointercapture","pointerleave"])
      this.host.addEventListener(type,finishDrag)
    this.host.addEventListener("auxclick",event=>{if(event.button===1)event.preventDefault()})
    this.host.addEventListener("wheel",event=>{
      event.preventDefault()
      this.zoomAt(event)
    },{passive:false})
    this.host.addEventListener("click",event=>{
      if(event.button!==0)return
      // Pointer-up can synthesize click even after capture and movement.
      if(suppressClick&&event.detail!==0){event.preventDefault();return}
      if(event.detail<=1)suppressDoubleClick=false
      const hit=this.hit(event)
      if(hit)this.actions.select?.(hit)
    })
    this.host.addEventListener("contextmenu",event=>{
      event.preventDefault()
      const hit=this.hit(event)
      if(hit)this.actions.context?.(hit,event.clientX,event.clientY)
    })
    this.host.addEventListener("dblclick",event=>{
      if(suppressClick||suppressDoubleClick)return
      const entry=this.entryForEvent(event)
      if(!entry)return
      this.target.copy(entry.mesh.position)
      this.cameraState.distance=clamp(entry.radius*12,55,240)
      this.render()
    })
    this.canvas.addEventListener("keydown",event=>{
      if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","+","=","-","Home"].includes(event.key))return
      event.preventDefault()
      if(event.key==="Home"){this.reset();return}
      if(event.key==="ArrowLeft")this.cameraState.azimuth-=.12
      if(event.key==="ArrowRight")this.cameraState.azimuth+=.12
      if(event.key==="ArrowUp")this.cameraState.elevation=clamp(this.cameraState.elevation+.1,.18,1.51)
      if(event.key==="ArrowDown")this.cameraState.elevation=clamp(this.cameraState.elevation-.1,.18,1.51)
      if(["+","=","-"].includes(event.key))this.cameraState.distance=clamp(this.cameraState.distance*(event.key==="-"?1.15:.87),45,1800)
      this.render()
    })
    this.glCanvas.addEventListener("webglcontextlost",event=>{
      event.preventDefault();if(this.active)this.fail(Error("WebGL context lost"))
    })
  }
}
