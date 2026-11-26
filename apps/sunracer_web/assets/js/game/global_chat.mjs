// Global, direct and private party communications on one authenticated socket.
export const CHAT_LIMIT = 100
const TABS = ["global", "party", "guild", "tells"]

// Quoted pilot names are supported because registration permits spaces.
export function parseChatCommand(raw, tab, recipient, lastTell) {
  const text = raw.trim()
  if (!text) return null
  if (!text.startsWith("/")) return {tab, recipient, text}
  const match = text.match(/^\/(\S+)(?:\s+([\s\S]*))?$/)
  if (!match) return {error:"Unknown command"}
  const command = match[1].toLowerCase(), rest = (match[2] || "").trim()
  if (["g","global","p","party","guild"].includes(command)) {
    const next = ["g","global"].includes(command) ? "global" : ["p","party"].includes(command) ? "party" : "guild"
    return rest ? {tab:next,text:rest} : {error:"Enter a message"}
  }
  if (command === "r") return lastTell && rest ? {tab:"tells",recipient:lastTell,text:rest} : {error:"No received tell to reply to, or message is empty"}
  if (["invite","tell","ignore","unignore"].includes(command)) {
    if (command !== "tell") {
      const name = rest.startsWith('"') && rest.endsWith('"') ? rest.slice(1,-1) : rest
      return name ? (command==="invite"?{invite:true,recipient:name}:{ignore:command === "ignore",recipient:name}) : {error:"Enter a pilot name"}
    }
    const args = rest.match(/^(?:"([^"]+)"|(\S+))\s+([\s\S]+)$/)
    return args ? {tab:"tells",recipient:args[1] || args[2],text:args[3]} : {error:'Use /tell Pilot message or /tell "Pilot Name" message'}
  }
  return {error:"Unknown command"}
}

export class GlobalChat {
  constructor({root, socket, Presence, canOpen = () => true, releaseInput = () => {}}) {
    this.root=root;this.socket=socket;this.canOpen=canOpen;this.releaseInput=releaseInput
    const get=id=>root.querySelector(id)
    this.panel=get("#global-chat-panel");this.toggle=get("#global-chat-toggle")
    this.input=get("#global-chat-input");this.send=get("#global-chat-send")
    this.log=get("#global-chat-log");this.status=get("#global-chat-status");this.unread=get("#global-chat-unread")
    this.recipient=get("#chat-recipient");this.recipientRow=get("#chat-recipient-row")
    this.context=get("#chat-context");this.tab="global";this.selfId=String(root.dataset?.layoutPlayerId || "")
    this.history={global:[],party:[],guild:[],tells:[]}
    this.counts={global:0,party:0,guild:0,tells:0}
    this.ignored=new Set();this.lastTell=null;this.contextPilot=null
    this.online=false;this.directOnline=false;this.pending=false
    this.Presence=Presence;this.partyOnline=false;this.party=null;this.invitation=null;this.directory=[]
  }

  start() {
    if (!this.panel || !this.toggle || !this.input || !this.log || !this.send) return this
    this.toggle.addEventListener("click",()=>this.panel.hidden?this.open():this.close())
    this.root.querySelector("#global-chat-close")?.addEventListener("click",()=>this.close())
    this.panel.addEventListener("focusin",()=>this.releaseInput())
    this.root.querySelector("#global-chat-form")?.addEventListener("submit",event=>{event.preventDefault();this.submit()})
    for(const button of this.root.querySelectorAll("[data-chat-tab]"))
      button.addEventListener("click",()=>this.selectTab(button.dataset.chatTab))
    this.root.querySelector("#chat-context-tell")?.addEventListener("click",()=>{
      if(!this.contextPilot)return
      this.recipient.value=this.contextPilot.name
      this.context.hidden=true;this.selectTab("tells");this.input.focus()
    })
    this.root.querySelector("#chat-context-ignore")?.addEventListener("click",()=>{
      if(this.contextPilot)this.setIgnore(this.contextPilot.name,!this.ignored.has(this.contextPilot.id))
      this.context.hidden=true
    })
    this.root.querySelector("#chat-context-close")?.addEventListener("click",()=>{this.context.hidden=true})
    this.root.querySelector("#chat-context-invite")?.addEventListener("click",()=>{
      if(this.contextPilot)this.partyAction("invite",{pilot_name:this.contextPilot.name})
      this.context.hidden=true
    })
    this.root.querySelector("#chat-directory-toggle")?.addEventListener("click",()=>{
      const directory=this.root.querySelector("#chat-directory")
      directory.hidden=!directory.hidden
      this.renderParty()
    })
    this.root.querySelector("#chat-party-invite")?.addEventListener("click",()=>{
      const field=this.root.querySelector("#chat-party-recipient")
      const name=field.value.trim()
      if(name)this.partyAction("invite",{pilot_name:name},()=>{field.value=""})
    })
    this.root.querySelector("#chat-party-leave")?.addEventListener("click",()=>this.partyAction("leave",{}))
    for(const action of ["accept","decline"]){
      this.root.querySelector("#chat-party-"+action)?.addEventListener("click",()=>{
        if(this.invitation)this.partyAction(action,{invitation_id:this.invitation.id})
      })
    }
    this.channel=this.socket.channel("chat:global",{})
    this.channel.on("chat_message",message=>this.append(message,"global"))
    this.channel.onError(()=>{this.online=false;this.refresh()})
    this.channel.onClose(()=>{this.online=false;this.refresh()})
    this.channel.join().receive("ok",()=>{this.online=true;this.refresh()})
      .receive("error",()=>{this.online=false;this.refresh()}).receive("timeout",()=>{this.online=false;this.refresh()})
    this.direct=this.socket.channel("chat:direct",{})
    this.direct.on("direct_tell",message=>this.append(message,"tells"))
    this.direct.on("ignore_changed",reply=>this.applyIgnored(reply.ignored_ids))
    this.direct.onError(()=>{this.directOnline=false;this.refresh()})
    this.direct.onClose(()=>{this.directOnline=false;this.refresh()})
    this.direct.join().receive("ok",reply=>{this.directOnline=true;this.applyIgnored(reply.ignored_ids);this.refresh()})
      .receive("error",()=>{this.directOnline=false;this.refresh()}).receive("timeout",()=>{this.directOnline=false;this.refresh()})
    this.partyChannel=this.socket.channel("chat:party",{})
    this.partyChannel.on("party_state",snapshot=>this.applyParty(snapshot))
    this.partyChannel.on("party_message",message=>{
      if(this.party&&message.party_id===this.party.id)this.append(message,"party")
    })
    this.partyChannel.onError(()=>this.partyConnection(false))
    this.partyChannel.onClose(()=>this.partyConnection(false))
    if(this.Presence){
      this.presence=new this.Presence(this.partyChannel)
      this.presence.onSync(()=>{
        this.directory=this.presence.list((id,{metas})=>({id:Number(id),name:metas[0]?.pilot_name}))
          .filter(p=>p.name).sort((a,b)=>a.name.localeCompare(b.name))
        this.renderParty()
      })
    }
    this.partyChannel.join().receive("ok",snapshot=>{this.partyConnection(true);this.applyParty(snapshot)})
      .receive("error",()=>this.partyConnection(false)).receive("timeout",()=>this.partyConnection(false))
    this.refresh()
    return this
  }

  partyConnection(online){
    this.partyOnline=online
    if(!online)this.directory=[]
    this.renderParty();this.refresh()
  }

  applyParty(snapshot){
    const next=snapshot?.party||null
    if(this.party?.id!==next?.id){
      this.history.party=[];this.counts.party=0
      if(this.tab==="party")this.renderHistory()
    }
    this.party=next
    this.invitation=snapshot?.invitation||null
    this.renderParty();this.updateUnread();this.refresh()
  }

  renderParty(){
    const get=id=>this.root.querySelector(id)
    const controls=get("#chat-party-controls"),roster=get("#chat-party-roster"),directory=get("#chat-directory-list")
    if(!controls||!roster||!directory)return
    const leader=this.party&&String(this.party.leader_id)===this.selfId
    controls.hidden=this.tab!=="party"
    get("#chat-party-leave").hidden=!this.party
    get("#chat-party-leave").disabled=!this.partyOnline
    get("#chat-party-invite").disabled=!this.partyOnline||Boolean(this.party&&!leader)||Boolean(this.party?.members.length>=6)
    get("#chat-party-recipient").disabled=get("#chat-party-invite").disabled
    get("#chat-party-count").textContent=this.party?this.party.members.length+"/6 pilots":"No active party"
    const invite=get("#chat-party-invitation")
    invite.hidden=!this.invitation
    get("#chat-party-inviter").textContent=this.invitation?this.invitation.inviter_name+" invites you to a party":""
    for(const action of ["accept","decline"])get("#chat-party-"+action).disabled=!this.partyOnline
    roster.replaceChildren()
    for(const pilot of this.party?.members||[]){
      const row=document.createElement("div"),name=document.createElement("button")
      name.type="button";name.textContent=(pilot.pilot_id===this.party.leader_id?"★ ":"")+pilot.pilot_name+(pilot.online?"":" · offline")
      name.addEventListener("click",()=>this.showContext(pilot,"party"))
      row.append(name)
      if(leader&&String(pilot.pilot_id)!==this.selfId){
        for(const [action,label] of [["transfer","Lead"],["remove","Remove"]]){
          const button=document.createElement("button");button.type="button";button.textContent=label
          button.disabled=!this.partyOnline||(action==="transfer"&&!pilot.online)
          button.addEventListener("click",()=>this.partyAction(action,{pilot_id:pilot.pilot_id}))
          row.append(button)
        }
      }
      roster.append(row)
    }
    get("#chat-directory-toggle").textContent="Online pilots ("+this.directory.length+")"
    directory.replaceChildren()
    for(const pilot of this.directory){
      if(String(pilot.id)===this.selfId||this.ignored.has(String(pilot.id)))continue
      const button=document.createElement("button");button.type="button";button.textContent=pilot.name
      button.addEventListener("click",()=>this.showContext({pilot_id:pilot.id,pilot_name:pilot.name},"global"))
      directory.append(button)
    }
  }

  partyAction(event,payload,onOk=()=>{}){
    if(!this.partyOnline||this.pending){this.refresh("Party service unavailable");return}
    this.pending=true;this.refresh()
    const finish=label=>{this.pending=false;this.refresh(label)}
    this.partyChannel.push(event,payload,5000)
      .receive("ok",()=>{onOk();finish(event==="invite"?"Invitation sent":"Party updated")})
      .receive("error",r=>finish(({party_full:"Party is full or seats are reserved",leader_required:"Only the leader can do that",
        invitation_unavailable:"Invitation expired or unavailable",recipient_unavailable:"Pilot unavailable",
        rate_limited:"Slow down · 4 actions per 10 seconds"})[r.reason]||"Party action rejected"))
      .receive("timeout",()=>finish("Party action unconfirmed"))
  }

  ready(tab=this.tab) {return tab==="global"?this.online:tab==="tells"?this.directOnline:tab==="party"?this.partyOnline&&Boolean(this.party):false}
  refresh(label=null) {
    if(this.status)this.status.textContent=label || (this.tab==="party"?(!this.partyOnline?"Party service offline":this.party?"Party connected":"Invite an online pilot to form a party"):
      this.tab==="guild"?"Guild membership coming next":this.ready()?"Connected":"Channel offline or unavailable")
    if(this.send)this.send.disabled=!this.ready()||this.pending
    if(this.input)this.input.disabled=!this.ready()
    if(this.recipient)this.recipient.disabled=!this.directOnline
  }

  selectTab(tab) {
    if(!TABS.includes(tab))return
    this.tab=tab;this.counts[tab]=0
    if(this.recipientRow)this.recipientRow.hidden=tab!=="tells"
    if(this.context)this.context.hidden=true
    if(this.input)this.input.placeholder=tab==="tells"?"Send a direct tell…":"Transmit to "+tab+"…"
    for(const button of this.root.querySelectorAll("[data-chat-tab]"))
      button.setAttribute("aria-pressed",String(button.dataset.chatTab===tab))
    this.renderHistory();this.renderParty();this.updateUnread();this.refresh()
  }

  open() {
    if(!this.canOpen()||!this.panel)return
    this.releaseInput();this.panel.hidden=false;this.toggle.setAttribute("aria-expanded","true")
    this.counts[this.tab]=0;this.updateUnread()
    this.log.scrollTop=this.log.scrollHeight
    this.input.focus({preventScroll:true})
  }

  close({focus=true}={}) {
    if(!this.panel||this.panel.hidden)return
    this.panel.hidden=true;this.toggle.setAttribute("aria-expanded","false")
    if(this.context)this.context.hidden=true
    if(focus)this.toggle.focus({preventScroll:true})
    else if(this.panel.contains(document.activeElement))document.activeElement.blur()
  }

  get editing(){return Boolean(this.panel&&!this.panel.hidden&&this.panel.contains(document.activeElement))}

  captureKey(event) {
    if(!this.panel||this.panel.hidden||!this.panel.contains(event.target))return
    if(event.type==="keydown"&&!event.isComposing){
      if(event.code==="Escape"){event.preventDefault();this.close()}
      else if(event.key==="Enter"&&event.target===this.input){event.preventDefault();if(!event.repeat)this.submit()}
    }
    event.stopImmediatePropagation()
  }

  updateUnread(){
    const total=Object.values(this.counts).reduce((a,b)=>a+b,0)+(this.invitation?1:0)
    if(this.unread){this.unread.hidden=!total;this.unread.textContent=total>99?"99+":String(total)}
    for(const node of this.root.querySelectorAll?.("[data-chat-unread]")||[]){
      const n=(this.counts[node.dataset.chatUnread]||0)+(node.dataset.chatUnread==="party"&&this.invitation?1:0)
      node.hidden=!n;node.textContent=n>99?"99+":String(n)
    }
  }

  applyIgnored(ids) {
    this.ignored=new Set((Array.isArray(ids)?ids:[]).map(String))
    for(const tab of TABS)this.history[tab]=this.history[tab].filter(m=>!this.ignored.has(String(m.pilot_id)))
    this.renderHistory();this.renderParty()
  }

  showContext(message,tab) {
    const own=String(message.pilot_id)===this.selfId
    const name=tab==="tells"&&own?message.recipient_name:message.pilot_name
    const id=String(tab==="tells"&&own?message.recipient_id:message.pilot_id)
    if(id===this.selfId||!name||!this.context)return
    this.contextPilot={name,id}
    this.root.querySelector("#chat-context-name").textContent=name
    this.root.querySelector("#chat-context-ignore").textContent=this.ignored.has(id)?"Unignore":"Ignore"
    const invite=this.root.querySelector("#chat-context-invite")
    if(invite)invite.disabled=!this.partyOnline||Boolean(this.party&&String(this.party.leader_id)!==this.selfId)||Boolean(this.party?.members.length>=6)
    this.context.hidden=false
  }

  messageNode(message,tab){
    const row=document.createElement("div"),name=document.createElement("button"),content=document.createElement("span")
    const own=String(message.pilot_id)===this.selfId
    name.type="button"
    name.textContent=tab==="tells"?(own?"To "+message.recipient_name:"From "+message.pilot_name):message.pilot_name
    name.addEventListener?.("click",()=>this.showContext(message,tab))
    name.addEventListener?.("contextmenu",e=>{e.preventDefault();this.showContext(message,tab)})
    content.textContent=message.text
    row.className="global-chat-message";row.dataset && (row.dataset.channel=tab)
    row.append(name,content);return row
  }

  renderHistory(){
    if(!this.log)return
    this.log.replaceChildren(...this.history[this.tab].map(m=>this.messageNode(m,this.tab)))
    this.log.scrollTop=this.log.scrollHeight
  }

  append(message,tab="global"){
    if(!TABS.includes(tab)||typeof message?.pilot_name!=="string"||typeof message?.text!=="string"||
       this.ignored.has(String(message.pilot_id)))return
    if(tab==="tells"&&String(message.pilot_id)!==this.selfId)this.lastTell=message.pilot_name
    const history=this.history[tab];history.push(message);if(history.length>CHAT_LIMIT)history.shift()
    if(this.tab===tab){
      const follow=this.log.scrollHeight-this.log.scrollTop-this.log.clientHeight<32
      this.log.append(this.messageNode(message,tab))
      while(this.log.children.length>CHAT_LIMIT)this.log.firstElementChild.remove()
      if(follow)this.log.scrollTop=this.log.scrollHeight
    }
    if(this.panel.hidden||this.tab!==tab){
      this.counts[tab]=Math.min(100,this.counts[tab]+1);this.updateUnread()
    }
  }

  setIgnore(name,ignored,clearText=null){
    if(!this.directOnline||this.pending)return
    this.pending=true;this.refresh()
    const finish=label=>{this.pending=false;this.refresh(label)}
    this.direct.push("set_ignore",{pilot_name:name,ignored},5000)
      .receive("ok",reply=>{
        this.applyIgnored(reply.ignored_ids)
        if(clearText!==null&&this.input.value.trim()===clearText)this.input.value=""
        finish(ignored?"Pilot ignored":"Pilot unignored")
      })
      .receive("error",r=>finish(r.reason==="rate_limited"?"Slow down · rate limit":"Unable to update ignore"))
      .receive("timeout",()=>finish("Ignore update unconfirmed"))
  }

  submit(){
    if(this.pending||!this.canOpen())return
    const raw=this.input.value.trim()
    const command=parseChatCommand(raw,this.tab,this.recipient?.value.trim(),this.lastTell)
    if(!command)return
    if(command.error){this.refresh(command.error);return}
    if(command.invite){this.partyAction("invite",{pilot_name:command.recipient},()=>{if(this.input.value.trim()===raw)this.input.value=""});return}
    if("ignore" in command){this.setIgnore(command.recipient,command.ignore,raw);return}
    const {tab,recipient,text}=command
    if(!this.ready(tab)){this.refresh("Channel unavailable");return}
    if(tab==="tells"&&!recipient){this.refresh("Enter a recipient pilot name");this.recipient?.focus();return}
    if(tab!==this.tab)this.selectTab(tab)
    if(tab==="tells")this.recipient.value=recipient
    this.pending=true;this.refresh()
    const finish=label=>{this.pending=false;this.refresh(label)}
    const channel=tab==="tells"?this.direct:tab==="party"?this.partyChannel:this.channel
    const payload=tab==="tells"?{recipient,text}:{text}
    channel.push(tab==="tells"?"send_tell":"send_message",payload,5000)
      .receive("ok",()=>{
        if(this.input.value.trim()===raw)this.input.value=""
        finish(tab==="tells"?"Submitted · live delivery only":"Connected")
      })
      .receive("error",r=>finish(r.reason==="rate_limited"?"Slow down · 4 actions per 10 seconds":
        r.reason==="recipient_unavailable"?"Recipient unavailable":"Message rejected"))
      .receive("timeout",()=>finish("Delivery unconfirmed"))
  }

  syncAvailability(){
    if(!this.toggle)return
    const available=this.canOpen()
    this.toggle.hidden=!available
    if(!available)this.close({focus:false})
  }
}
