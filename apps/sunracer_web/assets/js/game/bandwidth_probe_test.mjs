import test from "node:test"
import assert from "node:assert/strict"
import {
  BandwidthProbe, jsonPayloadBytes, instrumentPhoenixSocket,
} from "./bandwidth_probe.mjs"

test("measures UTF-8 JSON bytes, not JavaScript string length", () => {
  assert.equal(jsonPayloadBytes({text:"🌌"}), Buffer.byteLength(JSON.stringify({text:"🌌"})))
  assert.equal(jsonPayloadBytes({text:"🌌"}), 15)
  assert.equal(jsonPayloadBytes(undefined), 0)
  assert.equal(jsonPayloadBytes(42n), 0)
})

test("keeps counts but never retains message bodies or credentials", () => {
  let time = 1_000
  const probe = new BandwidthProbe("desktop", () => time)
  const token = "private-bearer-token-example"
  probe.record("in", "world", "world_delta", {secret: token, tick: 12})
  time += 1_000
  const result = probe.snapshot()
  assert.equal(result.window.messagesIn, 1)
  assert.ok(result.total.in > 0)
  assert.equal(JSON.stringify(result).includes(token), false)
  assert.equal(JSON.stringify(probe).includes(token), false)
  assert.equal(result.byEvent["world/world_delta"].messagesIn, 1)
})

test("reports a bounded sliding-window rate with stable cumulative totals", () => {
  let time = 0
  const probe = new BandwidthProbe("phone", () => time)
  probe.record("in", "helmet_control", "world_state", {tick:1})
  const first = jsonPayloadBytes({tick:1})
  time = 31_000
  probe.record("in", "helmet_control", "world_state", {tick:2})
  const result = probe.snapshot(30_000)
  assert.equal(result.window.messagesIn, 1)
  assert.equal(result.window.in, first)
  assert.equal(result.total.messagesIn, 2)
  assert.equal(result.total.in, first * 2)
  assert.equal(result.receivedBytesPerSecond, first / 30)
})

test("instrumented socket preserves Phoenix callbacks, returns and push receipts", () => {
  const subscribed = new Map()
  const receipt = {receive: () => receipt}
  const rawChannel = {
    on(event, callback) { subscribed.set(event, callback); return 77 },
    push(_event, _payload, _timeout) { return receipt },
  }
  const socket = {channel(topic, params) {
    assert.equal(topic, "world:sol:earth")
    assert.deepEqual(params, {stream:"delta_v1"})
    return rawChannel
  }}
  const meter = new BandwidthProbe("desktop", () => 2_000)
  instrumentPhoenixSocket(socket, meter)
  const channel = socket.channel("world:sol:earth", {stream:"delta_v1"})
  let received
  assert.equal(channel.on("world_delta", payload => {received = payload; return "ok"}), 77)
  assert.equal(subscribed.get("world_delta")({tick:2}), "ok")
  assert.deepEqual(received, {tick:2})
  assert.equal(channel.push("flight_controls", {pitch:1}, 3000), receipt)
  const summary = meter.snapshot()
  assert.equal(summary.byEvent["world/world_delta"].messagesIn, 1)
  assert.equal(summary.byEvent["world/flight_controls"].messagesOut, 1)
  assert.ok(summary.total.in > 0 && summary.total.out > 0)
})

test("bounded history does not grow indefinitely", () => {
  let time=0
  const meter = new BandwidthProbe("desktop", () => time)
  for(let i=0; i<4300; i++) {
    time += 1
    meter.record("out", "world", "flight_controls", {throttle:i})
  }
  const result = meter.snapshot()
  assert.equal(result.retainedSamples, 4096)
  assert.equal(result.total.messagesOut, 4300)
})

test("rejects unknown directions and does not retain topic identities", () => {
  const meter = new BandwidthProbe("phone", () => 10)
  meter.record("invalid", "world", "ignored", {secret:"ignore"})
  assert.equal(meter.snapshot().total.messagesIn, 0)
  const channel={on(_event,_handler){},push(){}}
  const socket={channel:(_topic) => channel}
  instrumentPhoenixSocket(socket,meter)
  socket.channel("helmet:control:private-player-id").push("recenter",{})
  const result=meter.snapshot()
  assert.ok(result.byEvent["helmet_control/recenter"])
  assert.equal(JSON.stringify(result).includes("private-player-id"),false)
})
