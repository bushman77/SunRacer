import test from "node:test"
import assert from "node:assert/strict"
import {bindClientUpdate} from "../ui/client_update.mjs"

function setup(invoke) {
  const button = {disabled: false, addEventListener(_event, cb) { this.click = cb }}
  const status = {hidden: true, textContent: ""}
  bindClientUpdate(button, status, () => invoke)
  return {button, status}
}

test("manual check invokes native updater once while pending and displays result", async () => {
  let count = 0
  let resolve
  const {button, status} = setup(command => {
    assert.equal(command, "check_client_update")
    count++
    return new Promise(done => { resolve = done })
  })
  const pending = button.click()
  assert.equal(button.disabled, true)
  assert.equal(status.hidden, false)
  await button.click()
  assert.equal(count, 1)
  resolve("SunRacer is up to date.")
  await pending
  assert.equal(status.textContent, "SunRacer is up to date.")
  assert.equal(button.disabled, false)
})

test("manual check reports failure and permits retry", async () => {
  const {button, status} = setup(async () => { throw "network unavailable" })
  await button.click()
  assert.equal(status.textContent, "Update unavailable: network unavailable")
  assert.equal(button.disabled, false)
})

test("manual check outside native client does not attempt install", async () => {
  const {button, status} = setup(undefined)
  await button.click()
  assert.match(status.textContent, /installed SunRacer desktop app/)
})
