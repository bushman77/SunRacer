// Strictly local HMD instrument pages. Gaze never sends flight or combat commands.
// State comes from the same authenticated visual snapshots already rendered
// in the headset. Keep each label short for two narrow stereoscopic viewports.
const pct = (current, maximum) =>
  Number.isFinite(current) && Number.isFinite(maximum) && maximum > 0
    ? Math.round(Math.min(100, Math.max(0, 100 * current / maximum))) + "%"
    : "--"

const rounded = value => Number.isFinite(value) ? Math.round(value) : 0
const safeLabel = value => typeof value === "string"
  ? value.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 18)
  : ""

export const HMD_HUD_PAGES = Object.freeze(["flight", "contacts", "space"])

export function helmetHudLines(page, client) {
  const own = client?.entities?.get?.(client.selfId)
  if (page === "contacts") {
    const contacts = [...(client?.entities?.values?.() || [])]
      .filter(entity => entity.id !== client.selfId && entity.status !== "destroyed")
    return [
      "CONTACTS / VIEW",
      contacts.length + " NEARBY VESSEL" + (contacts.length === 1 ? "" : "S"),
      ...(contacts.length ? contacts.slice(0, 2).map((entity, index) =>
        (index + 1) + " " + (safeLabel(entity.displayName) || entity.kind?.toUpperCase?.() || "CONTACT"))
        : ["NO CONTACTS", "REPORTED"]),
    ].slice(0, 4)
  }
  if (page === "space") {
    const profile = client?.navComputer?.solarNavigation?.space_environment
    const kind = typeof profile?.kind === "string" ? profile.kind : "unknown"
    return [
      "SPACE / CONDITIONS",
      safeLabel(kind.replace(/_/g, " ").toUpperCase()),
      "INTENSITY " + (Number.isFinite(profile?.intensity)
        ? pct(profile.intensity, 1) : "--"),
      "VISUAL ENVIRONMENT",
    ]
  }
  const velocity = own?.velocity
  const speed = velocity && [velocity.x, velocity.y, velocity.z].every(Number.isFinite)
    ? rounded(Math.hypot(velocity.x, velocity.y, velocity.z)) : 0
  return [
    "FLIGHT / STATUS",
    "THR " + pct(own?.throttle, 1) + "  SPD " + speed,
    "HULL " + pct(own?.hull, own?.maxHull),
    "SHIELD " + pct(own?.shields, own?.maxShields),
  ]
}
