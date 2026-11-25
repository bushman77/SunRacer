import test from "node:test"
import assert from "node:assert/strict"
import {checkTitleConnection, startTitleSettings} from "../title_settings.mjs"

test("title network check reports actual same-origin HTTP response", async () => {
  let calls = 0
  let cancelled = false
  const result = await checkTitleConnection(async (path, options) => {
    assert.equal(path, "/")
    assert.equal(options.cache, "no-store")
    assert.equal(options.credentials, "same-origin")
    assert.equal(options.redirect, "error")
    assert.ok(options.signal)
    return {ok: true, status: 200, body: {cancel: async () => { cancelled = true }}}
  }, () => calls++ === 0 ? 10 : 34)
  assert.equal(result, "Server reachable · HTTP 200 · 24 ms")
  assert.equal(cancelled, true)
})

test("title network check does not claim success for HTTP errors", async () => {
  assert.equal(await checkTitleConnection(async () => ({ok: false, status: 503})), "Server responded with HTTP 503")
})

test("title network check handles connection failure", async () => {
  assert.match(await checkTitleConnection(async () => { throw Error("offline") }), /Connection test failed/)
})

test("title settings initialization does nothing on other pages", () => {
  assert.doesNotThrow(() => startTitleSettings({querySelector: () => null}, "http://localhost:4000"))
})
