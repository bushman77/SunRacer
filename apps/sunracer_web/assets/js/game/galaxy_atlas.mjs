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
// Deterministic SVG art: no raster assets, external requests or per-frame updates.
function drawGalaxy(layer){
  const defs=add(layer,"defs")
  const glow=(id,stops)=>{
    const g=add(defs,"radialGradient",{id})
    stops.forEach(([offset,color,opacity])=>add(g,"stop",{offset,"stop-color":color,"stop-opacity":opacity}))
  }
  glow("galaxy-halo",[[0,"#afc7ff",.18],[.45,"#557bc7",.12],[1,"#030814",0]])
  glow("galaxy-core",[[0,"#fffadf",1],[.14,"#ffe2a1",.85],[.44,"#d4975e",.26],[1,"#cc9250",0]])
  add(layer,"rect",{width:W,height:H,fill:"#030914"})
  add(layer,"ellipse",{cx:center.x,cy:center.y,rx:475,ry:285,fill:"url(#galaxy-halo)"})
  let seed=92819
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  for(let i=0;i<370;i++)add(layer,"circle",{cx:rnd()*W,cy:rnd()*H,r:.2+rnd()*.75,fill:"#c3d8ee",opacity:.12+rnd()*.42})
  // Four loosely logarithmic arms, with diffuse vector dust and luminous knots.
  const arms=add(layer,"g",{"aria-hidden":"true"})
  for(let arm=0;arm<4;arm++){
    const curve=[]
    for(let j=0;j<=160;j++){
      const t=j/160,r=25+405*t,angle=arm*Math.PI/2+4.1*t-1.25
      curve.push([center.x+r*Math.cos(angle),center.y+r*.58*Math.sin(angle)])
    }
    const d=curve.map(([x,y],i)=>(i?"L":"M")+x.toFixed(2)+" "+y.toFixed(2)).join(" ")
    for(const [width,color,opacity] of [[65,"#233a75",.10],[35,"#4263ab",.12],[15,"#587ab9",.16],[3,"#91aee8",.19]])
      add(arms,"path",{d,fill:"none",stroke:color,"stroke-width":width,"stroke-linecap":"round",opacity})
    for(let j=0;j<830;j++){
      const t=rnd(),r=25+405*t,angle=arm*Math.PI/2+4.1*t-1.25+(rnd()-.5)*.31
      const spread=(rnd()+rnd()+rnd()-1.5)*42
      const x=center.x+(r+spread)*Math.cos(angle),y=center.y+(r+spread)*.58*Math.sin(angle)
      add(arms,"circle",{cx:x.toFixed(2),cy:y.toFixed(2),r:(.24+rnd()**3*1.8).toFixed(2),
        fill:["#94b4ff","#d4dfff","#507cc8","#ef9acb","#718fe4"][Math.floor(rnd()*5)],opacity:(.12+rnd()*.65).toFixed(2)})
    }
  }
  // Orion Spur is a short local branch between major arms, not a fifth
  // galaxy-spanning arm. SOL is at ~26 kly on a 50 kly radius ellipse.
  const spur="M 332 379 Q 380 408 425 412 Q 475 418 515 402"
  for(const [width,opacity] of [[24,.15],[10,.28],[2,.4]])
    add(layer,"path",{d:spur,fill:"none",stroke:"#91c6ee","stroke-width":width,"stroke-linecap":"round",opacity})
  add(layer,"ellipse",{cx:center.x,cy:center.y,rx:126,ry:73,fill:"url(#galaxy-core)",transform:"rotate(-26 525 300)"})
  add(layer,"ellipse",{cx:center.x,cy:center.y,rx:62,ry:16,fill:"url(#galaxy-core)",transform:"rotate(-26 525 300)"})
  for(const r of [105,210,315,420])add(layer,"ellipse",{cx:center.x,cy:center.y,rx:r,ry:r*.58,stroke:"#5c9cb7","stroke-dasharray":"3 7",fill:"none",opacity:.19})
  for(const [x,y,name] of [[525,320,"GALACTIC CENTRE"],[470,405,"ORION SPUR"],[450,78,"PERSEUS ARM"],[310,255,"SAGITTARIUS–CARINA"],[660,523,"SCUTUM–CENTAURUS"]])
    add(layer,"text",{x,y,fill:"#a4b8d1","font-size":10,"letter-spacing":2,"text-anchor":"middle",opacity:.78},name)
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
