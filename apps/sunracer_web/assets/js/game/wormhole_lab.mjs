import * as THREE from "three"
import {FlightControls} from "./flight_controls.mjs"

// The server supplies sampled center/radius geometry and authoritative state.
// No client-side elapsed time, hull or completion claim is sent to Phoenix.
export function tunnelMeshData(sections, radialSegments=48){
  const positions=[],colors=[],indices=[]
  const a=new THREE.Color("#13265e"),b=new THREE.Color("#7c36b8"),c=new THREE.Color("#43e1ff")
  for(let i=0;i<sections.length;i++){
    const section=sections[i]
    for(let j=0;j<=radialSegments;j++){
      const t=2*Math.PI*j/radialSegments
      positions.push(section.x+section.radius*Math.cos(t),section.y+section.radius*Math.sin(t),-section.distance)
      const wave=.5+.5*Math.sin(t*5+i*.36)
      const color=a.clone().lerp(b,wave).lerp(c,Math.pow(.5+.5*Math.sin(t*11-i*.27),8)*.8)
      colors.push(color.r,color.g,color.b)
      if(i<sections.length-1&&j<radialSegments){
        const k=i*(radialSegments+1)+j,n=k+radialSegments+1
        indices.push(k,n,k+1,k+1,n,n+1)
      }
    }
  }
  return {positions,colors,indices}
}

export const WormholeLab={
  mounted(){
    const host=this.el.querySelector("#wormhole-lab-renderer")
    const sections=JSON.parse(this.el.dataset.geometry)
    this.scene=new THREE.Scene()
    this.scene.background=new THREE.Color("#02040e")
    this.scene.fog=new THREE.FogExp2("#080a24",.00056)
    this.camera=new THREE.PerspectiveCamera(83,1,2,14000)
    this.renderer=new THREE.WebGLRenderer({antialias:true})
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5))
    host.appendChild(this.renderer.domElement)
    const data=tunnelMeshData(sections)
    const geo=new THREE.BufferGeometry()
    geo.setAttribute("position",new THREE.Float32BufferAttribute(data.positions,3))
    geo.setAttribute("color",new THREE.Float32BufferAttribute(data.colors,3))
    geo.setIndex(data.indices)
    this.scene.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})))
    const ringMaterial=new THREE.LineBasicMaterial({color:0x73bce9,transparent:true,opacity:.48})
    for(let i=2;i<sections.length;i+=3){
      const s=sections[i],points=[]
      for(let j=0;j<=64;j++){
        const t=j*Math.PI*2/64
        points.push(new THREE.Vector3(s.x+s.radius*.79*Math.cos(t),s.y+s.radius*.79*Math.sin(t),-s.distance))
      }
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),ringMaterial))
    }
    // Long luminous filaments curve along the walls instead of a straight tube.
    for(let j=0;j<18;j++){
      const points=sections.map((s,i)=>{
        const t=j*Math.PI*2/18+i*.09
        return new THREE.Vector3(s.x+s.radius*.98*Math.cos(t),s.y+s.radius*.98*Math.sin(t),-s.distance)
      })
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({color:j%3===0?0xf29dff:0x5699ff,transparent:true,opacity:.65})))
    }
    const end=sections.at(-1)
    const exit=new THREE.Mesh(new THREE.CircleGeometry(end.radius*.95,64),
      new THREE.MeshBasicMaterial({color:0xffe5b4,side:THREE.DoubleSide}))
    exit.position.set(end.x,end.y,-end.distance-5)
    this.scene.add(exit)
    this.current=null
    this.controls=new FlightControls({active:()=>this.current?.status==="in_transit",
      send:input=>this.pushEvent("transit_controls",input)})
    this.down=e=>this.controls.keyDown(e)
    this.up=e=>this.controls.keyUp(e)
    this.blur=()=>this.controls.release()
    this.wheel=e=>this.controls.wheel(e)
    window.addEventListener("keydown",this.down)
    window.addEventListener("keyup",this.up)
    window.addEventListener("blur",this.blur)
    host.addEventListener("wheel",this.wheel,{passive:false})
    this.host=host
    this.resize=new ResizeObserver(()=>{
      const w=host.clientWidth,h=host.clientHeight
      if(w&&h){this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false)}
    })
    this.resize.observe(host)
    this.updated()
    const render=time=>{
      this.frame=requestAnimationFrame(render)
      this.controls.heartbeat(time)
      const target=this.current||{x:0,y:0,distance:0,roll:0}
      const position=new THREE.Vector3(target.x,target.y,-target.distance)
      this.camera.position.lerp(position,.22)
      this.camera.rotation.set(0,0,-target.roll)
      this.renderer.render(this.scene,this.camera)
    }
    this.frame=requestAnimationFrame(render)
  },
  updated(){this.current=JSON.parse(this.el.dataset.transit)},
  destroyed(){
    cancelAnimationFrame(this.frame)
    this.resize?.disconnect()
    window.removeEventListener("keydown",this.down)
    window.removeEventListener("keyup",this.up)
    window.removeEventListener("blur",this.blur)
    this.host?.removeEventListener("wheel",this.wheel)
    this.scene?.traverse(o=>{o.geometry?.dispose();o.material?.dispose()})
    this.renderer?.dispose()
  }
}
