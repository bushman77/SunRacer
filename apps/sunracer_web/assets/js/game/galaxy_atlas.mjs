const NS="http://www.w3.org/2000/svg"
const add=(parent,tag,attrs={},label)=>{
  const node=parent.ownerDocument.createElementNS(NS,tag)
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value))
  if(label!==undefined)node.textContent=label
  parent.appendChild(node)
  return node
}
const W=1000,H=600
const center={x:525,y:300}
export function validSystems(catalog){
  if(!Array.isArray(catalog))return []
  const seen=new Set()
  return catalog.filter(s=>{
    if(!s||typeof s.id!=="string"||typeof s.name!=="string"||seen.has(s.id)||
       !Number.isFinite(s.atlas_x)||!Number.isFinite(s.atlas_y)||
       s.atlas_x<0||s.atlas_x>W||s.atlas_y<0||s.atlas_y>H)return false
    seen.add(s.id)
    return true
  })
}
export const canEnterSystem=system=>system?.id==="sol"&&system["provisional?"]===false
// The approved photographic-style artwork is a local game asset. It is
// embedded in the same SVG coordinate space as the interactive markers,
// so zoom and reset always transform both layers together.
export const GALAXY_ART_PATH="/images/game/galaxy/milky-way.webp"

export function drawGalaxy(layer){
  layer.replaceChildren()
  add(layer,"rect",{width:W,height:H,fill:"#030914"})
  const art=add(layer,"image",{href:GALAXY_ART_PATH,x:0,y:0,width:W,height:H,
    preserveAspectRatio:"xMidYMid meet","pointer-events":"none"})
  const guides=add(layer,"g",{"aria-hidden":"true","pointer-events":"none"})
  for(const r of [105,210,315,420])add(guides,"ellipse",{cx:center.x,cy:center.y,rx:r,ry:r*.58,
    stroke:"#8fbde0","stroke-dasharray":"3 7",fill:"none",opacity:.24})
  add(guides,"path",{d:"M 525 16 V 584 M 30 300 H 970",fill:"none",stroke:"#86bbd7",opacity:.23,"stroke-width":.8})
  for(const [x,y,name] of [[525,18,"0°"],[525,584,"180°"],[35,294,"270°"],[965,294,"90°"],
      [525,320,"GALACTIC CENTRE"],[470,405,"ORION SPUR"],[450,78,"PERSEUS ARM"],[310,255,"SAGITTARIUS–CARINA"],[660,523,"SCUTUM–CENTAURUS"]])
    add(guides,"text",{x,y,fill:"#b2cde3","font-size":10,"letter-spacing":1.7,
      "text-anchor":"middle","paint-order":"stroke",stroke:"#030914","stroke-width":2,opacity:.8},name)
  // A missing local asset must be visible rather than silently showing a
  // different design. Star selection still works on the dark chart.
  art.addEventListener("error",()=>{
    art.remove()
    add(layer,"text",{x:500,y:562,fill:"#ffc27a","font-size":12,"text-anchor":"middle"},
      "GALAXY ART MISSING · INSTALL MILKY-WAY.WEBP")
  },{once:true})
}
export class GalaxyAtlas{
  constructor(root,enter){
    this.root=root;this.enter=enter;this.svg=root.querySelector("#nav-galaxy-chart")
    this.art=root.querySelector("#nav-galaxy-art");this.layer=root.querySelector("#nav-galaxy-stars")
    this.systems=[];this.selected="sol";this.zoom=1
    if(!this.svg||!this.art||!this.layer)return
    drawGalaxy(this.art)
    this.svg.addEventListener("click",e=>{
      const id=e.target?.closest?.("[data-galaxy-id]")?.getAttribute("data-galaxy-id")
      if(id)this.select(id)
    })
    this.svg.addEventListener("dblclick",e=>{
      const id=e.target?.closest?.("[data-galaxy-id]")?.getAttribute("data-galaxy-id")
      if(id==="sol"&&canEnterSystem(this.systems.find(s=>s.id===id)))this.enter()
    })
    this.svg.addEventListener("keydown",e=>{
      const id=e.target?.closest?.("[data-galaxy-id]")?.getAttribute("data-galaxy-id")
      if(id&&(e.key==="Enter"||e.key===" ")){e.preventDefault();this.select(id)}
    })
    root.querySelector("#nav-galaxy-enter")?.addEventListener("click",()=>{
      if(canEnterSystem(this.systems.find(s=>s.id===this.selected)))this.enter()
    })
    root.querySelector("#nav-galaxy-zoom-in")?.addEventListener("click",()=>this.setZoom(this.zoom*1.25))
    root.querySelector("#nav-galaxy-zoom-out")?.addEventListener("click",()=>this.setZoom(this.zoom/1.25))
    root.querySelector("#nav-galaxy-reset")?.addEventListener("click",()=>this.setZoom(1))
  }
  setCatalog(catalog){
    this.systems=validSystems(catalog)
    if(!this.systems.some(s=>s.id===this.selected))this.selected="sol"
    this.render()
  }
  setZoom(value){
    this.zoom=Math.max(1,Math.min(3,value))
    const w=W/this.zoom,h=H/this.zoom
    const selected=this.systems.find(s=>s.id===this.selected)
    const x=Math.max(0,Math.min(W-w,(selected?.atlas_x??W/2)-w/2))
    const y=Math.max(0,Math.min(H-h,(selected?.atlas_y??H/2)-h/2))
    this.svg?.setAttribute("viewBox",[x,y,w,h].join(" "))
  }
  select(id){
    if(!this.systems.some(s=>s.id===id))return
    this.selected=id;this.render()
  }
  render(){
    if(!this.layer)return
    this.layer.replaceChildren()
    const selected=this.systems.find(s=>s.id===this.selected)
    for(const s of this.systems){
      const x=s.atlas_x,y=s.atlas_y,current=s.id==="sol",active=s.id===this.selected
      const color=current?"#ffd06b":"#83dfef"
      const node=add(this.layer,"g",{"data-galaxy-id":s.id,role:"button",tabindex:0,
        "aria-label":s.name+(current?" · current system":" · expansion locked"),
        "aria-pressed":String(active)})
      add(node,"circle",{cx:x,cy:y,r:12,fill:"transparent"})
      add(node,"circle",{cx:x,cy:y,r:current?12:8,fill:color,opacity:.15})
      add(node,"circle",{class:"galaxy-marker-ring",cx:x,cy:y,r:current?7:5,fill:"#0b293d",stroke:color,"stroke-width":active?2:1})
      add(node,"circle",{cx:x,cy:y,r:current?3.7:2.6,fill:color})
      if(active)add(node,"circle",{cx:x,cy:y,r:13,fill:"none",stroke:color,"stroke-dasharray":"3 3"})
      const labelLeft=x>820
      add(node,"text",{x:x+(labelLeft?-10:10),y:y+4,fill:color,"font-size":12,
        "font-weight":active?"bold":"normal","text-anchor":labelLeft?"end":"start",
        "paint-order":"stroke",stroke:"#030914","stroke-width":3},s.name)
    }
    const set=(id,value)=>{const n=this.root.querySelector(id);if(n)n.textContent=value}
    set("#nav-galaxy-count",String(this.systems.length))
    set("#nav-galaxy-name",selected?.name||"Awaiting catalogue")
    set("#nav-galaxy-status",selected?(canEnterSystem(selected)?"ACTIVE · HOME":"CHARTED · LOCKED"):"CONNECTING")
    set("#nav-galaxy-distance",Number.isFinite(selected?.distance_from_sol_ly)?selected.distance_from_sol_ly+" ly":"Not catalogued")
    set("#nav-galaxy-description",canEnterSystem(selected)?"Orion Spur · approximately 26,000 ly from the galactic centre.":"Future expansion system. No playable planets or travel route yet.")
    const button=this.root.querySelector("#nav-galaxy-enter")
    if(button){button.disabled=!canEnterSystem(selected);button.textContent=button.disabled?"Interstellar travel locked":"Enter solar system"}
  }
}
