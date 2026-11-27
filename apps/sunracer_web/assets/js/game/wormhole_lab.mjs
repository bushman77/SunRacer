import * as THREE from "three"
import {FlightControls} from "./flight_controls.mjs"

// The server supplies sampled center/radius geometry and authoritative state.
// No client-side elapsed time, hull or completion claim is sent to Phoenix.
export function tunnelMeshData(sections, radialSegments=48){
  const positions=[],colors=[],indices=[],uvs=[]
  const a=new THREE.Color("#13265e"),b=new THREE.Color("#7c36b8"),c=new THREE.Color("#43e1ff")
  for(let i=0;i<sections.length;i++){
    const section=sections[i]
    for(let j=0;j<=radialSegments;j++){
      const t=2*Math.PI*j/radialSegments
      uvs.push(j/radialSegments,section.distance/1000)
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
  return {positions,colors,indices,uvs}
}

// Procedural emission: angularly periodic waves, moving eddies and thin
// turbulent filaments. No downloaded textures or geometry updates.
export function plasmaMaterial(){
  return new THREE.ShaderMaterial({
    side:THREE.DoubleSide,
    uniforms:{uTime:{value:0}},
    vertexShader:`
      varying vec2 vUV;
      varying float vDepth;
      void main(){
        vUV=uv;
        vec4 view=modelViewMatrix*vec4(position,1.0);
        vDepth=length(view.xyz);
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`
      uniform float uTime;
      varying vec2 vUV;
      varying float vDepth;
      void main(){
        float a=vUV.x*6.2831853;
        float z=vUV.y;
        float t=uTime;
        float curl=sin(a*3.0+z*2.3-t*.65)+.55*sin(a*7.0-z*3.7+t*.8);
        float fine=sin(a*19.0+z*11.0+t*2.0+curl*2.0);
        float clouds=.5+.5*sin(a*5.0-z*5.0+t*.9+curl*2.1);
        float streak=pow(max(0.0,.5+.5*sin(a*11.0+z*4.0+t*1.3+curl*2.6)),9.0);
        float sparks=pow(max(0.0,fine),12.0)*pow(clouds,3.0);
        vec3 c=mix(vec3(.025,.035,.13),vec3(.26,.06,.48),clouds);
        c+=streak*vec3(.12,.7,1.0)+sparks*vec3(.64,.27,.8);
        float haze=exp(-vDepth*.00046);
        gl_FragColor=vec4(mix(vec3(.012,.016,.055),c,haze),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  })
}

function randomGenerator(seed){
  let n=seed>>>0
  return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}
}

function plasmaParticles(sections,count=1250){
  const random=randomGenerator(7291),positions=new Float32Array(count*3)
  const seeds=Array.from({length:count},()=>({phase:random(),angle:random()*Math.PI*2,
    radius:.65+random()*.29,speed:.065+random()*.09}))
  const geo=new THREE.BufferGeometry()
  geo.setAttribute("position",new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage))
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(1800./max(1.,-p.z),1.,4.5);}`,
    fragmentShader:`void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.32,.78,1.,.8*(1.-smoothstep(0.,1.,r)));}`})
  const points=new THREE.Points(geo,material)
  points.frustumCulled=false
  return {points,update(time){
    for(let i=0;i<count;i++){
      const seed=seeds[i],p=((seed.phase+time*seed.speed)%1)*(sections.length-1)
      const j=Math.floor(p),f=p-j,a=sections[j],b=sections[Math.min(j+1,sections.length-1)]
      const lerp=(x,y)=>x+(y-x)*f
      const theta=seed.angle+time*.14+p*.04,r=lerp(a.radius,b.radius)*seed.radius
      positions[i*3]=lerp(a.x,b.x)+Math.cos(theta)*r
      positions[i*3+1]=lerp(a.y,b.y)+Math.sin(theta)*r
      positions[i*3+2]=-lerp(a.distance,b.distance)
    }
    geo.attributes.position.needsUpdate=true
  }}
}

function glowSprite(color,size){
  const canvas=document.createElement("canvas");canvas.width=canvas.height=128
  const ctx=canvas.getContext("2d"),g=ctx.createRadialGradient(64,64,0,64,64,64)
  g.addColorStop(0,"rgba(255,255,255,1)")
  g.addColorStop(.12,color)
  g.addColorStop(.38,color.replace("1)","0.17)"))
  g.addColorStop(1,"rgba(0,0,0,0)")
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128)
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,
    depthWrite:false,blending:THREE.AdditiveBlending}))
  sprite.scale.set(size,size,1)
  return sprite
}

// A separate destination sky is a visual preview, never a transfer request.
function exteriorScene(binary){
  const scene=new THREE.Scene();scene.background=new THREE.Color("#020511")
  const random=randomGenerator(binary?841:317),positions=[],colors=[]
  for(let i=0;i<2600;i++){
    const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y)*9000
    positions.push(r*Math.cos(a),y*9000,r*Math.sin(a))
    const b=.28+random()*.72;colors.push(b*.86,b*.93,b)
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3))
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3))
  scene.add(new THREE.Points(geometry,new THREE.PointsMaterial({vertexColors:true,size:1.8,sizeAttenuation:false})))
  const stars=binary?[[-1050,380,-4700,1300,"rgba(255,224,160,1)"],[1650,650,-6800,1000,"rgba(255,166,92,1)"]]:[[900,480,-5100,1050,"rgba(255,233,180,1)"]]
  for(const [x,y,z,size,color] of stars){
    const star=glowSprite(color,size);star.position.set(x,y,z);scene.add(star)
    const core=new THREE.Mesh(new THREE.SphereGeometry(size*.045,24,16),new THREE.MeshBasicMaterial({color:0xfff2d1}))
    core.position.copy(star.position);scene.add(core)
  }
  return scene
}

export function exteriorFor(state){
  if(state?.status==="arrived"&&state.location==="alpha_centauri_exit")return "alpha"
  if(["ejected","aborted"].includes(state?.status)&&state.location==="sol_entrance")return "sol"
  return null
}

export function arrivalFade(elapsedMs){
  return Math.max(0,Math.min(.92,.92*(1-Math.max(0,elapsedMs)/1600)))
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
    geo.setAttribute("uv",new THREE.Float32BufferAttribute(data.uvs,2))
    geo.setIndex(data.indices)
    this.plasma=plasmaMaterial()
    this.scene.add(new THREE.Mesh(geo,this.plasma))
    this.particles=plasmaParticles(sections)
    this.scene.add(this.particles.points)
    const ringMaterial=new THREE.MeshBasicMaterial({color:0x70e7ff,transparent:true,opacity:.85})
    const gateMaterial=new THREE.MeshBasicMaterial({color:0xf9d597})
    for(let i=6;i<sections.length-2;i+=6){
      const s=sections[i],major=i%24===0
      const ring=new THREE.Mesh(new THREE.TorusGeometry(s.radius*.75,major?4.2:2.3,6,64),
        major?gateMaterial:ringMaterial)
      ring.position.set(s.x,s.y,-s.distance)
      this.scene.add(ring)
      if(major){
        for(let j=0;j<4;j++){
          const a=j*Math.PI/2,marker=new THREE.Mesh(new THREE.SphereGeometry(7,8,6),gateMaterial)
          marker.position.set(s.x+Math.cos(a)*s.radius*.75,s.y+Math.sin(a)*s.radius*.75,-s.distance)
          this.scene.add(marker)
        }
      }
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
    const exit=new THREE.Mesh(new THREE.TorusGeometry(end.radius*.86,14,10,80),
      new THREE.MeshBasicMaterial({color:0xffe2ae}))
    exit.position.set(end.x,end.y,-end.distance)
    this.scene.add(exit)
    const halo=glowSprite("rgba(255,222,160,1)",end.radius*2.5)
    halo.position.set(end.x,end.y,-end.distance-120)
    this.scene.add(halo)
    this.exteriors={alpha:exteriorScene(true),sol:exteriorScene(false)}
    this.fade=document.createElement("div")
    this.fade.className="wormhole-exit-fade"
    this.fade.setAttribute("aria-hidden","true")
    host.appendChild(this.fade)
    this.transitionAt=null
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
      const exterior=exteriorFor(target)
      if(exterior){
        if(this.transitionAt===null)this.transitionAt=time
        this.camera.position.set(0,0,0)
        this.camera.rotation.set(0,0,0)
        this.renderer.render(this.exteriors[exterior],this.camera)
        this.fade.style.opacity=String(arrivalFade(time-this.transitionAt))
      }else{
        this.transitionAt=null
        this.fade.style.opacity="0"
        const position=new THREE.Vector3(target.x,target.y,-target.distance)
        this.camera.position.lerp(position,.22)
        this.camera.rotation.set(0,0,-target.roll)
        this.plasma.uniforms.uTime.value=time/1000
        this.particles.update(time/1000)
        this.renderer.render(this.scene,this.camera)
      }
    }
    this.frame=requestAnimationFrame(render)
  },
  updated(){
    const previous=this.current
    this.current=JSON.parse(this.el.dataset.transit)
    if(previous?.status==="in_transit"&&this.current?.status!=="in_transit"){
      this.controls.resetThrottle()
    }
    if(this.current?.status==="in_transit"&&previous?.status!=="in_transit"){
      this.controls.resetThrottle()
      this.camera.position.set(this.current.x,this.current.y,-this.current.distance)
    }
    this.host.classList.toggle("wormhole-breach",
      this.current?.status==="in_transit"&&this.current?.outside===true)
  },
  destroyed(){
    cancelAnimationFrame(this.frame)
    this.resize?.disconnect()
    window.removeEventListener("keydown",this.down)
    window.removeEventListener("keyup",this.up)
    window.removeEventListener("blur",this.blur)
    this.host?.removeEventListener("wheel",this.wheel)
    const materials=new Set(),geometries=new Set(),textures=new Set()
    for(const scene of [this.scene,...Object.values(this.exteriors||{})]){
      scene?.traverse(o=>{
        if(o.geometry)geometries.add(o.geometry)
        if(o.material){materials.add(o.material);if(o.material.map)textures.add(o.material.map)}
      })
    }
    geometries.forEach(g=>g.dispose())
    textures.forEach(t=>t.dispose())
    materials.forEach(m=>m.dispose())
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
    this.fade?.remove()
  }
}
