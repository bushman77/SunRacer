import test from "node:test"
import assert from "node:assert/strict"
import {FrameScheduler} from "./frame_scheduler.mjs"

function fakeRaf() {
  let next = 1
  const queue = new Map()
  return {
    queue,
    request: cb => { const id = next++; queue.set(id, cb); return id },
    cancel: id => queue.delete(id),
    flush(time = 16) {
      const due = [...queue.entries()]
      queue.clear()
      for (const [, cb] of due) cb(time)
    },
  }
}

test("only one frame is ever pending", () => {
  const raf = fakeRaf()
  const frames = new FrameScheduler(raf)
  frames.request(() => {})
  frames.request(() => {})
  assert.equal(raf.queue.size, 1)
  assert.equal(frames.pending, true)
})

test("a frame queued before hiding does not start a second loop on wake", () => {
  const raf = fakeRaf()
  const frames = new FrameScheduler(raf)
  let renders = 0
  const loop = () => { renders++; frames.request(loop) }

  frames.request(loop)        // running
  // Page hidden: the browser keeps this callback and runs it on return.
  const stale = [...raf.queue.values()][0]
  frames.cancel()             // hidden branch cancels it
  frames.request(loop)        // visible again: new loop
  stale(16)                   // browser still delivers the old callback
  raf.flush()
  assert.equal(renders, 1)
  assert.equal(raf.queue.size, 1)
})

test("cancel clears the pending request", () => {
  const raf = fakeRaf()
  const frames = new FrameScheduler(raf)
  let ran = false
  frames.request(() => { ran = true })
  frames.cancel()
  raf.flush()
  assert.equal(ran, false)
  assert.equal(frames.pending, false)
})
