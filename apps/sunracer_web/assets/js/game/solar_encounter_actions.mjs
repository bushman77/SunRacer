// The display label is not authority. Navigation.enter_tactical validates
// the server-owned pending encounter and classification again.
export function tacticalEncounterAction(classification) {
  if (classification === "neutral_flyby") {
    return {visible: true, label: "Attack vessel"}
  }
  if (classification === "hostile_contact" ||
      classification === "patrol_attention") {
    return {visible: true, label: "Engage / Enter combat"}
  }
  return {visible: false, label: "Engage / Enter combat"}
}

// A successful hail changes wording for the current encounter only.
// This is presentation state, never a new navigation or story permission.
export function encounterContinueLabel(encounterId, hailedEncounterId) {
  return typeof encounterId === "string" && encounterId.length > 0 &&
    encounterId === hailedEncounterId ? "Resume course" : "Ignore / Resume course"
}
