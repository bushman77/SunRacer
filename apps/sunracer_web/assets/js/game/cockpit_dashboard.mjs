import {targetRange, LASER_FEEDBACK_MS} from "./laser_feedback.mjs"

// Presentation only. The active tactical encounter owns one NPC per pilot.
// Match both the class and owning pilot; never use arbitrary selected NPCs
// to enable a surrender settlement.
export function tacticalOpponent(client) {
  const tactical = client?.navComputer?.solarNavigation?.tactical_encounter
  const pilot = client?.player?.pilot?.id ?? client?.selfId
  if (!tactical?.id || pilot == null) return null
  const type = typeof tactical.ship_class === "string"
    ? "solar-" + tactical.ship_class + "-" + pilot : null
  const suffix = "-" + pilot
  for (const entity of client.entities?.values?.() || []) {
    const id = entity.npcTypeId
    if (entity.kind === "npc" && entity.status !== "destroyed" &&
        typeof id === "string" &&
        (type ? id === type : id.startsWith("solar-") && id.endsWith(suffix))) return entity
  }
  return null
}

const clean = (value, fallback = "") => typeof value === "string" && value.trim()
  ? value.trim().toUpperCase().slice(0, 65) : fallback
const num = value => Number.isFinite(value) ? value : 0
const tab = (id, label, x) => ({id, label, x, y: 12, w: 238, h: 43})
export function dashboardModel(client, page = "tactical", time = 0) {
  const own = client?.entities?.get?.(client.selfId)
  const nav = client?.navComputer?.solarNavigation
  const active = Boolean(nav?.tactical_encounter?.id || nav?.tactical_active === true ||
    client?.helmetSurrender?.surrendered === true)
  const opponent = tacticalOpponent(client)
  const selected = active ? opponent : client?.entities?.get?.(client.selectedTargetId)
  const surrendered = active && (opponent?.state === "surrendered" ||
    (client?.helmetSurrender?.surrendered === true))
  const range = targetRange(own, selected)
  const v = own?.velocity
  const speed = Math.round(Math.hypot(num(v?.x), num(v?.y), num(v?.z)))
  const throttle = Math.round(num(own?.throttle) * 100)
  const tabs = [tab("tactical", "TACTICAL", 18), tab("comms", "COMMS", 268),
    tab("navigation", "ATLAS", 518), tab("cargo", "CARGO", 768)]
  const actions = []
  const push = (id, label, x, w) => actions.push({id, label, x, y: 190, w, h: 52})
  const feedback = client?.lastLaserFeedback
  const recent = feedback && time - feedback.at < LASER_FEEDBACK_MS
  const warning = client?.planetaryWarningDisplay
  const title = surrendered
    ? clean(opponent?.displayName || client?.helmetSurrender?.call_sign, "CONTACT") + " · SURRENDERED"
    : active ? clean(nav?.tactical_encounter?.call_sign, "TACTICAL CONTACT") + " · HOSTILE"
    : selected ? "TARGET " + clean(selected.displayName, "CONTACT")
    : "NO TARGET SELECTED"
  let detail = range ? range.label : "NO RANGE DATA"
  let line = title
  if (active) {
    if (nav?.tactical_encounter?.id && !client?.tacticalRetreating && !client?.helmetSurrender) {
      if (surrendered && opponent?.state === "surrendered") {
        push("accept", "ACCEPT SURRENDER", 18, 480)
        push("seize", "SEIZE CARGO", 518, 488)
      } else push("retreat", "RETREAT", 768, 238)
    }
    if (surrendered) detail = "WEAPONS COLD · RELEASE OR SEIZE"
    else if (recent) detail = feedback.label + (range ? " · RNG " + range.distance : "")
  } else if (page === "comms") {
    line = clean(client?.storyHud?.model?.speaker, "COMMUNICATIONS")
    detail = clean(client?.storyHud?.model?.objective, "NO ACTIVE TRANSMISSION")
  } else {
    line = selected ? title : "FLIGHT SYSTEMS READY"
    detail = range ? range.label :
      clean(client?.storyHud?.stereoLine, "DESTINATION " + clean(nav?.destination_id, "UNPLOTTED"))
  }
  if (client?.encounterHold && !active) detail = "CRUISE PAUSED · " +
    clean(client.encounterHold.call_sign, "CONTACT") + " · HAIL VIA LAPTOP"
  if (warning) detail = clean(warning.level) + " · " + clean(warning.detail)
  if (active && client?.tacticalRetreating) detail = "TRANSMITTING · STAND BY"
  if (active && client?.dashboardError) detail = clean(client.dashboardError)
  return {tabs, actions, speed, throttle, line, detail, active, surrendered,
    page: active ? "tactical" : page, danger: Boolean(warning), recent: Boolean(recent)}
}

// Canvas coordinates have origin at top-left; Three.js UV has origin at bottom-left.
export function dashboardHit(model, uv) {
  if (!uv || !Number.isFinite(uv.x) || !Number.isFinite(uv.y)) return null
  const x = uv.x * 1024, y = (1 - uv.y) * 256
  return [...(model?.tabs || []), ...(model?.actions || [])].find(b =>
    x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id || null
}
