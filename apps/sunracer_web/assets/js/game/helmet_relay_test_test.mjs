import test from "node:test"
import assert from "node:assert/strict"
import {
  validRelayInvitation, relayQRUrl, relayInvitationFromQR,
  authenticatedRelayResult, attachHelmetRelayTest,
} from "./helmet_relay_test.mjs"

const page = "https://192.168.0.48:4443/helmet"
const secret = "c".repeat(48)
const invite = "https://192.168.0.48:4455/relay-check#" + secret

test("one existing QR carries Phoenix pairing plus private one-use LAN proof", () => {
  const qr = relayQRUrl(page + "?pair=ONE-USE-PHOENIX-CODE", invite)
  const parsed = new URL(qr)
  assert.equal(parsed.origin, "https://192.168.0.48:4443")
  assert.equal(parsed.pathname, "/helmet")
  assert.equal(parsed.searchParams.get("pair"), "ONE-USE-PHOENIX-CODE")
  assert.equal(parsed.searchParams.has("relay"), false)
  assert.ok(parsed.hash.includes("relay="))
  assert.equal(relayInvitationFromQR(qr), invite)
  const reconnectQr = relayQRUrl(page, invite)
  assert.equal(new URL(reconnectQr).searchParams.has("pair"), false,
    "already-paired device does not redeem a fresh Phoenix registration")
  assert.equal(relayInvitationFromQR(reconnectQr), invite)
  assert.equal(relayInvitationFromQR(page), null)
  assert.equal(relayQRUrl(page + "?pair=CODE",
    "https://192.168.0.49:4455/relay-check#" + secret),
    page + "?pair=CODE", "never embed challenge to a different host")
})

test("strictly same private laptop and HTTPS port 4455, never a public or arbitrary origin", () => {
  assert.equal(validRelayInvitation(invite, page)?.href, invite)
  for (const candidate of [
    "http://192.168.0.48:4455/relay-check#" + secret,
    "https://192.168.0.49:4455/relay-check#" + secret,
    "https://192.168.0.48:4443/relay-check#" + secret,
    "https://192.168.0.48:4455/other#" + secret,
    "https://192.168.0.48:4455/relay-check?x=1#" + secret,
    "https://someone@192.168.0.48:4455/relay-check#" + secret,
    "https://192.168.0.48:4455/relay-check#short",
    "https://localhost:4455/relay-check#" + secret,
    "https://sunracer.ddns.net:4455/relay-check#" + secret,
  ]) {
    assert.equal(validRelayInvitation(candidate, page), null, candidate)
  }
  assert.equal(validRelayInvitation(invite, "http://192.168.0.48:4000/helmet"), null)
  assert.equal(validRelayInvitation(invite, "https://sunracer.ddns.net/helmet"), null)
  assert.equal(relayInvitationFromQR(page + "#relay=" + encodeURIComponent(
    "https://192.168.0.49:4455/relay-check#" + secret)), null)
})

test("proof message requires the exact iframe window and TLS origin", () => {
  const frameWindow = {}
  const event = {source: frameWindow, origin: "https://192.168.0.48:4455",
    data: {type: "sunracer:relay-proof", passed: true}}
  assert.equal(authenticatedRelayResult(event, frameWindow, event.origin), true)
  assert.equal(authenticatedRelayResult({...event, source: {}}, frameWindow, event.origin), null)
  assert.equal(authenticatedRelayResult({...event, origin: "https://evil.test"}, frameWindow, event.origin), null)
  assert.equal(authenticatedRelayResult({...event, data: {passed: true}}, frameWindow, event.origin), null)
  assert.equal(authenticatedRelayResult({...event, data: {...event.data, passed: "true"}}, frameWindow, event.origin), null)
})

function domHarness(callbacks = {}) {
  const result = {hidden: true, textContent: "", dataset: {}}
  const frame = {contentWindow: {}, setAttribute() {}, remove() {this.removed = true}, style: {}}
  const listeners = new Map()
  let timeoutHandler
  const win = {
    location: {href: page},
    document: {createElement(name) {assert.equal(name, "iframe");return frame}},
    addEventListener(name, fn) {listeners.set(name, fn)},
    removeEventListener(name) {listeners.delete(name)},
    setTimeout(fn) {timeoutHandler = fn;return 7},
    clearTimeout() {timeoutHandler = null},
  }
  const root = {
    querySelector: selector => selector === "#helmet-relay-result" ? result : null,
    appendChild(x) {this.frame = x},
  }
  const link = attachHelmetRelayTest(root, {win, ...callbacks})
  return {link, win, root, frame, result, listeners, timeout: () => timeoutHandler?.()}
}

test("automatic post-pair proof reports only authenticated success", () => {
  const h = domHarness()
  h.link.prove(invite)
  assert.equal(h.root.frame.src, invite)
  assert.equal(h.result.textContent, "Checking secure local link...")
  assert.equal(h.frame.referrerPolicy, "no-referrer")
  h.listeners.get("message")({source: {}, origin: "https://192.168.0.48:4455",
    data: {type: "sunracer:relay-proof", passed: true}})
  assert.equal(h.result.dataset.passed, "false")
  h.listeners.get("message")({source: h.frame.contentWindow, origin: "https://192.168.0.48:4455",
    data: {type: "sunracer:relay-proof", passed: true}})
  assert.equal(h.result.textContent, "LOCAL LINK VERIFIED")
  assert.equal(h.result.dataset.passed, "true")
  assert.equal(h.frame.removed, undefined,
    "keep the authenticated iframe alive for the local world stream")
  h.timeout()
  assert.equal(h.result.textContent, "LOCAL LINK VERIFIED")
  h.link.dispose()
  assert.equal(h.frame.removed, true)
})

test("timeout or false proof never shows verified", () => {
  const h = domHarness()
  h.link.prove(invite)
  h.timeout()
  assert.match(h.result.textContent, /timed out/)
  assert.equal(h.result.dataset.passed, "false")
  h.link.prove(invite)
  h.listeners.get("message")({source: h.frame.contentWindow, origin: "https://192.168.0.48:4455",
    data: {type: "sunracer:relay-proof", passed: false}})
  assert.match(h.result.textContent, /unavailable/)
  assert.equal(h.result.dataset.passed, "false")
  h.link.dispose()
})

test("world messages are accepted only from the paired TLS iframe", () => {
  const frames = []
  let beats = 0, offline = 0
  const h = domHarness({
    onWorld: x => frames.push(x),
    onHeartbeat: () => beats++,
    onOffline: () => offline++,
  })
  h.link.prove(invite)
  h.listeners.get("message")({source: h.frame.contentWindow,
    origin: "https://192.168.0.48:4455",
    data: {type: "sunracer:relay-proof", passed: true}})
  const frame = {seq: 8, map: {map_id: "sol:free_earth", tick: 3,
    entities: [{id: 1, kind: "pilot"}]}}
  const publish = (source, origin, payload) =>
    h.listeners.get("message")({source, origin, data: payload})
  publish({}, "https://192.168.0.48:4455",
    {type: "sunracer:relay-world", frame})
  publish(h.frame.contentWindow, "https://wrong.example",
    {type: "sunracer:relay-world", frame})
  assert.equal(frames.length, 0)
  publish(h.frame.contentWindow, "https://192.168.0.48:4455",
    {type: "sunracer:relay-world", frame})
  assert.equal(frames.length, 1)
  assert.equal(frames[0].map.tick, 3)
  publish(h.frame.contentWindow, "https://192.168.0.48:4455",
    {type: "sunracer:relay-heartbeat"})
  assert.equal(beats, 1)
  publish(h.frame.contentWindow, "https://192.168.0.48:4455",
    {type: "sunracer:relay-proof", passed: false})
  assert.equal(offline, 1)
  assert.equal(h.frame.removed, true)
  h.link.dispose()
})
