import test from "node:test"
import assert from "node:assert/strict"
import {GlobalChat, CHAT_LIMIT, parseChatCommand} from "./global_chat.mjs"

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

test("commands route global, group and quoted direct tells without guessing recipients",()=>{
  assert.deepEqual(parseChatCommand('/tell "Pilot Name" hello',"global",null,null),{tab:"tells",recipient:"Pilot Name",text:"hello"})
  assert.deepEqual(parseChatCommand("/r yes","global",null,"Pilot Name"),{tab:"tells",recipient:"Pilot Name",text:"yes"})
  assert.ok(parseChatCommand("/r yes","global",null,null).error)
  assert.deepEqual(parseChatCommand("/p go","global",null,null),{tab:"party",text:"go"})
  assert.deepEqual(parseChatCommand("/ignore Pilot Name","global",null,null),{ignore:true,recipient:"Pilot Name"})
  assert.deepEqual(parseChatCommand("/invite Pilot","global",null,null),{invite:true,recipient:"Pilot"})
})
test("private messages never enter global history and ignored pilots are filtered",()=>{
  const node=()=>({children:[],textContent:"",hidden:false,scrollHeight:0,scrollTop:0,clientHeight:0,
    append(...children){this.children.push(...children)}})
  const panel=node(),log=node(),unread=node()
  const root={dataset:{layoutPlayerId:"1"},querySelector:id=>({"#global-chat-panel":panel,"#global-chat-log":log,"#global-chat-unread":unread}[id]||null)}
  const chat=new GlobalChat({root,socket:null})
  chat.ignored.add("3")
  chat.append({pilot_id:2,pilot_name:"Other",text:"private",recipient_id:1},"tells")
  chat.append({pilot_id:3,pilot_name:"Ignored",text:"blocked"},"global")
  assert.equal(chat.history.global.length,0)
  assert.equal(log.children.length,0)
  assert.equal(chat.history.tells.length,1)
  assert.equal(chat.lastTell,"Other")
  assert.equal(chat.counts.tells,1)
})

test("party changes discard history and unread counters, but reconnect to same party keeps them",()=>{
  const chat=new GlobalChat({root:{querySelector:()=>null},socket:null})
  chat.partyOnline=true
  chat.applyParty({party:{id:7,members:[]}})
  chat.history.party.push({text:"secret"});chat.counts.party=1
  chat.applyParty({party:{id:7,members:[]}})
  assert.equal(chat.history.party.length,1)
  assert.equal(chat.ready("party"),true)
  chat.applyParty({party:null})
  assert.equal(chat.history.party.length,0)
  assert.equal(chat.counts.party,0)
  assert.equal(chat.ready("party"),false)
})

test("guild membership enables guild chat and clears old guild history on removal",()=>{
  const chat=new GlobalChat({root:{querySelector:()=>null},socket:null})
  chat.guildOnline=true
  chat.applyGuild({guild:{id:17,rank:"leader",members:[]}})
  assert.equal(chat.ready("guild"),true)
  chat.history.guild.push({text:"private"})
  chat.applyGuild({guild:{id:17,rank:"officer",members:[]}})
  assert.equal(chat.history.guild.length,1)
  chat.applyGuild({guild:null})
  assert.equal(chat.ready("guild"),false)
  assert.equal(chat.history.guild.length,0)
  assert.deepEqual(parseChatCommand("/guild ready","global",null,null),{tab:"guild",text:"ready"})
})
