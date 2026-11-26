import test from "node:test"
import assert from "node:assert/strict"
import {GlobalChat, CHAT_LIMIT} from "./global_chat.mjs"

test("chat renders literal text, caps local history, and marks unread",()=>{
  const node=()=>({children:[],textContent:"",hidden:false,scrollHeight:0,scrollTop:0,clientHeight:0,
    append(...children){for(const child of children){child.remove=()=>{this.children=this.children.filter(c=>c!==child)};this.children.push(child)}},
    get firstElementChild(){return this.children[0]}})
  const panel=node(),log=node(),unread=node()
  panel.hidden=true
  const root={querySelector:id=>({"#global-chat-panel":panel,"#global-chat-log":log,"#global-chat-unread":unread}[id]||null)}
  const chat=new GlobalChat({root,socket:null})
  const previous=globalThis.document
  globalThis.document={createElement:node}
  try{
    for(let i=0;i<CHAT_LIMIT+2;i++)chat.append({pilot_name:"Pilot",text:"<img onerror=alert(1)>"})
    assert.equal(log.children.length,CHAT_LIMIT)
    assert.equal(log.children[0].children[1].textContent,"<img onerror=alert(1)>")
    assert.equal(unread.textContent,"99+")
    assert.equal(unread.hidden,false)
    chat.append({pilot_name:null,text:"invalid"})
    assert.equal(log.children.length,CHAT_LIMIT)
  }finally{globalThis.document=previous}
})
test("chat owns keyboard input before flight handlers",()=>{
  const input={value:"hi"}
  const panel={hidden:false,contains:target=>target===input}
  const chat=new GlobalChat({root:{querySelector:id=>({"#global-chat-panel":panel,"#global-chat-input":input}[id]||null)}})
  let prevented=0,stopped=0,submitted=0
  chat.submit=()=>submitted++
  const event={type:"keydown",target:input,key:"w",code:"KeyW",preventDefault(){prevented++},stopImmediatePropagation(){stopped++}}
  chat.captureKey(event)
  assert.equal(stopped,1)
  assert.equal(prevented,0)
  chat.captureKey({...event,key:"Enter",code:"Enter"})
  assert.equal(submitted,1)
  assert.equal(prevented,1)
  chat.captureKey({...event,target:{}})
  assert.equal(stopped,2)
})
