import assert from "node:assert/strict"
import test from "node:test"
import {drawSolarAtlas,renderSolarDetails} from "./solar_atlas.mjs"
import {findSolarBody,solarLayout,solarPositionToChart} from "./solar_system.mjs"

const fakeNode = (type="div") => ({
  type,attrs:{},children:[],textContent:"",style:{},dataset:{},
  setAttribute(name,value){this.attrs[name]=String(value)},
  getAttribute(name){return this.attrs[name]??null},
  appendChild(child){this.children.push(child);return child},
  append(...children){this.children.push(...children)},
  replaceChildren(...children){this.children=[...children]},
})

const withDocument = fn => {
  const previous=globalThis.document
  globalThis.document={
    createElement:tag=>fakeNode(tag),
    createElementNS:(_ns,tag)=>fakeNode(tag),
  }
  try{return fn()}finally{globalThis.document=previous}
}

test("Solar Atlas draws Sun through Pluto with selectable SVG markers",()=>{
  withDocument(()=>{
    const layer=fakeNode("g")
    const svg={querySelector:q=>q==="#nav-solar-content"?layer:null}
    drawSolarAtlas(svg,{selectedId:"pluto"})
    const groups=layer.children.filter(node=>node.attrs["data-body-id"])
    assert.equal(groups.length,10)
    assert.deepEqual(groups.map(group=>group.attrs["data-body-id"]),
      solarLayout().map(body=>body.id))
    const pluto=groups.find(group=>group.attrs["data-body-id"]==="pluto")
    assert.equal(pluto.attrs["aria-pressed"],"true")
    assert.equal(pluto.attrs.tabindex,"0")
    assert.ok(layer.children.filter(node=>node.type==="circle").length>150)
  })
})

test("inner magnification shows Sun and terrestrial planets without lying about AU",()=>{
  withDocument(()=>{
    const layer=fakeNode("g")
    const svg={querySelector:q=>q==="#nav-solar-content"?layer:null}
    drawSolarAtlas(svg,{focus:"inner",selectedId:"earth"})
    const markers=layer.children.filter(node=>node.attrs["data-body-id"])
    assert.deepEqual(markers.map(item=>item.attrs["data-body-id"]),[
      "sun","mercury","venus","earth","mars",
    ])
    const earth=markers.find(item=>item.attrs["data-body-id"]==="earth")
    assert.equal(earth.attrs["aria-pressed"],"true")
    assert.equal(findSolarBody("earth").au,1)
  })
})

test("clickable body list and selected details include Pluto's classification",()=>{
  withDocument(()=>{
    const views=Object.fromEntries([
      "#nav-solar-name","#nav-solar-type","#nav-solar-distance",
      "#nav-solar-period","#nav-system-bodies",
    ].map(key=>[key,fakeNode()]))
    const root={querySelector:key=>views[key]||null}
    renderSolarDetails(root,"pluto")
    assert.equal(views["#nav-solar-name"].textContent,"Pluto")
    assert.equal(views["#nav-solar-type"].textContent,"Dwarf planet")
    assert.equal(views["#nav-solar-distance"].textContent,"39.482 AU")
    const list=views["#nav-system-bodies"].children
    assert.equal(list.length,10)
    assert.equal(list[9].dataset.bodyId,"pluto")
    assert.equal(list[9].attrs["aria-pressed"],"true")
    assert.equal(list[0].attrs["aria-pressed"],"false")
  })
})

test("server-owned transit draws travel vector and interpolated pilot marker",()=>{
  withDocument(()=>{
    const layer=fakeNode("g")
    const svg={querySelector:q=>q==="#nav-solar-content"?layer:null}
    drawSolarAtlas(svg,{selectedId:"mars",navigation:{
      system_id:"sol",status:"traveling",location_id:"earth",
      destination_id:"mars",progress:.5,
    }})
    const path=layer.children.find(child=>
      child.type==="line"&&child.attrs["stroke"]==="#67f4ee")
    assert.ok(path)
    const marker=layer.children.find(child=>
      child.type==="circle"&&child.attrs["stroke"]==="#a8ffff")
    assert.ok(marker)
    const earth=solarLayout().find(b=>b.id==="earth")
    const mars=solarLayout().find(b=>b.id==="mars")
    assert.ok(Math.abs(Number(marker.attrs.cx)-(earth.x+mars.x)/2)<.0001)
    assert.ok(Math.abs(Number(marker.attrs.cy)-(earth.y+mars.y)/2)<.0001)
  })
})

// A starbase is not an extra planet; the Atlas draws it as a separate
// navigable object using the server-supplied coordinate.
test("independent Green Starbase renders as a selected twin-pyramid Atlas marker",()=>{
  withDocument(()=>{
    const layer=fakeNode("g")
    const svg={querySelector:q=>q==="#nav-solar-content"?layer:null}
    const site={id:"sol:starbase:green",name:"Green Starbase",
      kind:"starbase",position_km:{x:-9_957_476,y:-849_608,z:0}}
    drawSolarAtlas(svg,{selectedId:"earth",selectedStarbaseId:site.id,
      navigation:{system_id:"sol",status:"idle",starbases:[site]}})
    const marker=layer.children.find(node=>node.attrs["data-starbase-id"]===site.id)
    assert.ok(marker)
    assert.equal(marker.attrs["aria-pressed"],"true")
    assert.equal(marker.children.filter(n=>n.type==="polygon").length,2)
    assert.equal(marker.children.filter(n=>n.type==="rect").length,2)
    assert.equal(layer.children.filter(n=>n.attrs["data-body-id"]).length,10)
  })
})

test("Atlas paints server-owned environmental regions without adding destinations",()=>{
  withDocument(()=>{
    const layer=fakeNode("g")
    const svg={querySelector:q=>q==="#nav-solar-content"?layer:null}
    const belt={id:"sol:asteroid_belt",kind:"asteroid_belt",
      inner_radius_km:17_963_991,outer_radius_km:23_704_662,
      half_thickness_km:2_400_000,visual_only:true}
    const storm={id:"sol:ion_storm:alpha",kind:"ion_storm",
      center_km:{x:12_000_000,y:-17_000_000,z:0},
      radius_km:1_350_000,visual_only:true}
    drawSolarAtlas(svg,{navigation:{system_id:"sol",status:"idle",
      environment_regions:[belt,storm],
      space_environment:{region_id:storm.id,kind:storm.kind,intensity:0.8,
        visual_only:true}}})
    const band=layer.children.find(n=>n.attrs["data-environment-id"]===belt.id)
    const bubble=layer.children.find(n=>n.attrs["data-environment-id"]===storm.id)
    assert.ok(band)
    assert.ok(bubble)
    assert.equal(band.getAttribute("aria-label"),"Asteroid belt · charted region")
    assert.equal(bubble.getAttribute("aria-label"),"Ion storm · charted region")
    assert.equal(bubble.children.some(n=>n.attrs["stroke"]==="#f6a5ff"),true)
    assert.equal(layer.children.filter(n=>n.attrs["data-body-id"]).length,10)
  })
})

test("inner Atlas excludes out-of-focus belt overlays",()=>{
  withDocument(()=>{
    const layer=fakeNode("g")
    drawSolarAtlas({querySelector:q=>q==="#nav-solar-content"?layer:null},
      {focus:"inner",navigation:{system_id:"sol",status:"idle",
        environment_regions:[{id:"sol:asteroid_belt",kind:"asteroid_belt",
        inner_radius_km:18_000_000,outer_radius_km:24_000_000,
        visual_only:true}]}})
    assert.equal(layer.children.filter(n=>n.attrs["data-environment-id"]).length,0)
  })
})

test("server charted wormhole is outside Pluto to the east-southeast; hidden in inner view",()=>{
  withDocument(()=>{
    const layer=fakeNode("g")
    const svg={querySelector:q=>q==="#nav-solar-content"?layer:null}
    const mouth={id:"sol_alpha_mouth",system_id:"sol",name:"Alpha Centauri Wormhole",
      position_km:{x:84000000,y:35000000,z:0},transit_available:false}
    const navigation={system_id:"sol",wormholes:[mouth]}
    drawSolarAtlas(svg,{navigation})
    const marker=layer.children.find(n=>n.attrs["data-wormhole-id"]===mouth.id)
    assert.ok(marker)
    const p=solarPositionToChart(mouth.position_km)
    assert.ok(p.x>500&&p.y>300)
    assert.ok(Math.hypot(p.x-500,p.y-300)>solarLayout().find(b=>b.id==="pluto").orbitRadius)
    assert.equal(Number(marker.children[0].attrs.cx),p.x)
    assert.ok(marker.children.some(n=>n.textContent==="TRANSIT LOCKED"))
    drawSolarAtlas(svg,{navigation,focus:"inner"})
    assert.equal(layer.children.some(n=>n.attrs["data-wormhole-id"]),false)
  })
})
