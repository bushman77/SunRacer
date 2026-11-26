import {environmentFieldKey,environmentFieldObjects} from "./space_environment_field.mjs"

// Shared 3D scene geometry renders identically in desktop and stereo SBS eyes.
// These meshes are not raycast targets and have NO collision or damage effect.
export class SpaceEnvironmentVisual {
  constructor(THREE,scene){
    this.THREE=THREE
    this.scene=scene
    this.root=new THREE.Group()
    this.root.name="sol-environment-visual-only"
    this.scene.add(this.root)
    this.rockGeometry=new THREE.IcosahedronGeometry(1,0)
    this.stormGeometry=new THREE.SphereGeometry(1,6,5)
    this.rockMaterial=new THREE.MeshStandardMaterial({
      color:0x8f8a7f,roughness:0.95,metalness:0.03,flatShading:true,
    })
    this.debrisMaterial=new THREE.MeshStandardMaterial({
      color:0x687c8b,roughness:0.72,metalness:0.47,flatShading:true,
    })
    this.stormMaterial=new THREE.MeshBasicMaterial({
      color:0x9ba8ff,transparent:true,opacity:0.42,
      depthWrite:false,blending:THREE.AdditiveBlending,
    })
    this.currentKey=null
    this.batch=null
    this.root.visible=false
  }

  update(profile,camera,mapId){
    const key=environmentFieldKey(profile,camera?.position,mapId)
    if(!key){
      this.root.visible=false
      this.currentKey=null
      return
    }
    this.root.visible=true
    if(this.currentKey===key)return
    this.currentKey=key
    if(this.batch){
      this.root.remove(this.batch)
      this.batch.dispose?.()
    }
    const objects=environmentFieldObjects(profile,camera.position,mapId)
    if(!objects.length){
      this.batch=null
      return
    }
    const storm=profile.kind==="ion_storm"
    const mesh=new this.THREE.InstancedMesh(
      storm?this.stormGeometry:this.rockGeometry,
      storm?this.stormMaterial:
        (profile.kind==="orbital_debris"||profile.kind==="open_space")?this.debrisMaterial:this.rockMaterial,
      objects.length,
    )
    mesh.name="sol-environment-"+profile.kind
    mesh.frustumCulled=false
    mesh.userData.visualOnly=true
    const transform=new this.THREE.Object3D()
    for(const [index,obj] of objects.entries()){
      transform.position.set(obj.x,obj.y,obj.z)
      transform.rotation.set(obj.rx,obj.ry,obj.rz)
      if(storm)transform.scale.set(obj.size*0.5,obj.size*0.8,obj.size*3.5)
      else transform.scale.set(obj.size,obj.size*0.65,obj.size*1.2)
      transform.updateMatrix()
      mesh.setMatrixAt(index,transform.matrix)
    }
    mesh.instanceMatrix.needsUpdate=true
    this.batch=mesh
    this.root.add(mesh)
  }

  dispose(){
    if(this.batch){
      this.root.remove(this.batch)
      this.batch.dispose?.()
    }
    this.scene.remove(this.root)
    this.rockGeometry.dispose()
    this.stormGeometry.dispose()
    this.rockMaterial.dispose()
    this.debrisMaterial.dispose()
    this.stormMaterial.dispose()
    this.batch=null
    this.currentKey=null
  }
}
