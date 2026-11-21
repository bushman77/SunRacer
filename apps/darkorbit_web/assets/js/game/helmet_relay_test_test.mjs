import test from "node:test"
import assert from "node:assert/strict"
import {
  validRelayInvitation, authenticatedRelayResult, attachHelmetRelayTest,
} from "./helmet_relay_test.mjs"

const page = "https://192.168.0.48:4443/helmet"
const token = "c".repeat(48)
const invite = "https://192.168.0.48:4455/relay-check#" + token

test("only a one-use TLS invitation for this exact private-LAN laptop is accepted", () => {
  assert.equal(validRelayInvitation(invite, page)?.href, invite)
  for (const candidate of [
    "http://192.168.0.48:4455/relay-check#" + token,
    "https://192.168.0.49:4455/relay-check#" + token,
    "https://192.168.0.48:4443/relay-check#" + token,
    "https://192.168.0.48:4455/other#" + token,
    "https://192.168.0.48:4455/relay-check?x=1#" + token,
    "https://someone@192.168.0.48:4455/relay-check#" + token,
    "https://192.168.0.48:4455/relay-check#short",
    "javascript:alert(1)",
    "https://localhost:4455/relay-check#" + token,
    "https://spacenova.ddns.net:4455/relay-check#" + token,
  ]) {
    assert.equal(validRelayInvitation(candidate, page), null, candidate)
  }
  assert.equal(validRelayInvitation(invite, "http://192.168.0.48:4000/helmet"), null)
  assert.equal(validRelayInvitation(invite, "https://spacenova.ddns.net/helmet"), null)
})

test("only a boolean proof from the matching iframe AND origin can pass", () => {
  const frameWindow = {}
  const event = {source: frameWindow, origin: "https://192.168.0.48:4455",
    data: {type: "space-nova:relay-proof", passed: true}}
  assert.equal(authenticatedRelayResult(event, frameWindow, event.origin), true)
  assert.equal(authenticatedRelayResult({...event, source: {}}, frameWindow, event.origin), null)
  assert.equal(authenticatedRelayResult({...event, origin: "https://evil.test"}, frameWindow, event.origin), null)
  assert.equal(authenticatedRelayResult({...event, data: {passed: true}}, frameWindow, event.origin), null)
  assert.equal(authenticatedRelayResult({...event, data: {...event.data, passed: "true"}}, frameWindow, event.origin), null)
  assert.equal(authenticatedRelayResult({...event, data: {...event.data, passed: false}}, frameWindow, event.origin), false)
})

function domHarness(clipboardText) {
  function element() {
    return {
      hidden: false, disabled: false, textContent: "", value: "", dataset: {},
      handlers: {}, style: {}, children: [],
      addEventListener(type, callback) {this.handlers[type] = callback},
      removeEventListener(type) {delete this.handlers[type]},
      setAttribute() {}, focus() {}, remove() {this.removed = true},
    }
  }
  const keys = ["helmet-relay-test", "helmet-relay-result", "helmet-relay-entry",
    "helmet-relay-url", "helmet-relay-submit"]
  const nodes = Object.fromEntries(keys.map(id => [id, element()]))
  nodes["helmet-relay-test"].textContent = "TEST LOCAL RELAY"
  const frame = element()
  frame.contentWindow = {}
  const listeners = new Map()
  let timeoutCallback
  const win = {
    location: {href: page},
    navigator: {clipboard: {readText: async () => clipboardText}},
    document: {createElement(name) {assert.equal(name, "iframe");return frame}},
    addEventListener(name, fn) {listeners.set(name, fn)},
    removeEventListener(name) {listeners.delete(name)},
    setTimeout(fn) {timeoutCallback = fn;return 7},
    clearTimeout() {},
  }
  const root = {querySelector: id => nodes[id.slice(1)], appendChild(x) {this.frame = x}}
  const detach = attachHelmetRelayTest(root, {win})
  return {nodes, win, root, frame, listeners, detach, timeout: () => timeoutCallback?.()}
}

test("one tap tests copied invitation; button becomes PASSED only on valid proof", async () => {
  const {nodes, root, frame, listeners, timeout, detach} = domHarness(invite)
  const btn = nodes["helmet-relay-test"], result = nodes["helmet-relay-result"]
  await btn.handlers.click()
  assert.equal(btn.textContent, "TESTING...")
  assert.equal(btn.hidden, false)
  assert.equal(btn.disabled, true)
  assert.equal(root.frame.src, invite)
  assert.equal(root.frame.referrerPolicy, "no-referrer")
  assert.equal(result.hidden, true)
  listeners.get("message")({source: frame.contentWindow, origin: "https://evil.test",
    data: {type: "space-nova:relay-proof", passed: true}})
  assert.equal(btn.hidden, false, "spoofed result must not pass")
  listeners.get("message")({source: frame.contentWindow, origin: "https://192.168.0.48:4455",
    data: {type: "space-nova:relay-proof", passed: true}})
  assert.equal(btn.hidden, true)
  assert.equal(result.textContent, "PASSED")
  assert.equal(result.dataset.passed, "true")
  assert.equal(frame.removed, true)
  timeout()
  assert.equal(result.textContent, "PASSED", "completed timeout was cancelled")
  detach()
})

test("clipboard unavailable shows small paste fallback; failure is never PASSED", async () => {
  const h = domHarness("unrelated text")
  const {nodes, listeners, frame} = h
  const btn = nodes["helmet-relay-test"]
  await btn.handlers.click()
  assert.equal(nodes["helmet-relay-entry"].hidden, false)
  assert.equal(nodes["helmet-relay-result"].textContent, "PASTE LINK FROM TAURI")
  nodes["helmet-relay-url"].value = invite
  nodes["helmet-relay-submit"].handlers.click()
  listeners.get("message")({source: frame.contentWindow, origin: "https://192.168.0.48:4455",
    data: {type: "space-nova:relay-proof", passed: false}})
  assert.equal(nodes["helmet-relay-result"].textContent, "NOT CONNECTED")
  assert.equal(btn.hidden, false)
  assert.equal(btn.disabled, false)
  h.detach()
})
