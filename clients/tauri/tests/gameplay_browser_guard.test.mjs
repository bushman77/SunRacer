import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {installGameplayBrowserGuard} from "../ui/gameplay_browser_guard.mjs"

function fixture() {
  let active = true
  const handlers = new Map()
  const target = {
    addEventListener(type, fn, capture) {assert.equal(capture, true); handlers.set(type, fn)},
    removeEventListener(type, fn, capture) {
      assert.equal(capture, true); assert.equal(handlers.get(type), fn); handlers.delete(type)
    }
  }
  const dispose = installGameplayBrowserGuard({target, active: () => active})
  const fire = (type, props = {}) => {
    const event = {prevented: false, stopped: false,
      preventDefault() {this.prevented = true},
      stopImmediatePropagation() {this.stopped = true}, ...props}
    handlers.get(type)?.(event)
    return event
  }
  return {fire, dispose, inactive: () => {active = false}}
}

test("browser context menu is blocked without swallowing custom gameplay menus", () => {
  const {fire} = fixture()
  const menu = fire("contextmenu", {button: 2})
  assert.equal(menu.prevented, true)
  assert.equal(menu.stopped, false)
  assert.equal(fire("pointerdown", {button: 2}).prevented, false)
})

test("reload shortcuts are intercepted before flight input", () => {
  const {fire} = fixture()
  for (const props of [{key:"F5"}, {code:"F5",ctrlKey:true},
    {key:"r",ctrlKey:true}, {key:"R",ctrlKey:true,shiftKey:true},
    {key:"r",metaKey:true}, {code:"KeyR",ctrlKey:true}]) {
    const event = fire("keydown", props)
    assert.equal(event.prevented, true)
    assert.equal(event.stopped, true)
  }
  for (const props of [{key:"r"}, {key:"w"}, {key:"Escape"},
    {key:"v",ctrlKey:true}, {key:"c",ctrlKey:true}]) {
    assert.equal(fire("keydown", props).prevented, false)
  }
})

test("login is unaffected and listeners are removable", () => {
  const {fire, inactive, dispose} = fixture()
  inactive()
  assert.equal(fire("contextmenu").prevented, false)
  assert.equal(fire("keydown",{key:"F5"}).prevented, false)
  dispose()
  assert.equal(fire("contextmenu").prevented, false)
})

test("native bootstrap installs guard without changing credential storage or explicit logout", () => {
  const source = readFileSync(new URL("../ui/native_bootstrap.mjs", import.meta.url), "utf8")
  assert.match(source, /installGameplayBrowserGuard\(\{active: \(\) => !game\.hidden && Boolean\(token\)\}\)/)
  assert.match(source, /postJson\("\/api\/native\/logout", \{\}, oldToken\)/)
  assert.doesNotMatch(source, /(?:sessionStorage|localStorage)\.setItem\([^\n]*token/i)
})
