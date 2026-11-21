// Diagnostic only: estimates UTF-8 JSON PAYLOAD size. It does not count
// WebSocket framing, compression, TLS, heartbeat frames, or HTTP assets.
// Store counts and sizes only; never retain pilot data, tokens, or messages.
const MAX_SAMPLES = 4096
const WINDOW_MS = 30_000

export function jsonPayloadBytes(payload) {
  try {
    const encoded = JSON.stringify(payload)
    return typeof encoded === "string" ? new TextEncoder().encode(encoded).byteLength : 0
  } catch (_error) {
    return 0
  }
}

export class BandwidthProbe {
  constructor(label, clock = () => performance.now()) {
    this.label = label
    this.clock = clock
    this.startedAt = clock()
    this.samples = []
    this.totals = {in: 0, out: 0, messagesIn: 0, messagesOut: 0}
    this.byEvent = Object.create(null)
  }

  record(direction, lane, event, payload) {
    if (direction !== "in" && direction !== "out") return
    const bytes = jsonPayloadBytes(payload)
    const name = String(lane).slice(0, 40) + "/" + String(event).slice(0, 80)
    const moment = this.clock()
    const group = this.byEvent[name] || {
      in: 0, out: 0, messagesIn: 0, messagesOut: 0,
    }
    group[direction] += bytes
    group[direction === "in" ? "messagesIn" : "messagesOut"]++
    this.byEvent[name] = group
    this.totals[direction] += bytes
    this.totals[direction === "in" ? "messagesIn" : "messagesOut"]++
    this.samples.push({time: moment, direction, bytes, event: name})
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.splice(0, this.samples.length - MAX_SAMPLES)
    }
  }

  snapshot(windowMs = WINDOW_MS) {
    const now = this.clock()
    const duration = Math.max(1, Math.min(
      Number.isFinite(windowMs) && windowMs > 0 ? windowMs : WINDOW_MS,
      now - this.startedAt,
    ))
    const recent = this.samples.filter(item => item.time >= now - duration)
    const windowBytes = {in: 0, out: 0, messagesIn: 0, messagesOut: 0}
    for (const item of recent) {
      windowBytes[item.direction] += item.bytes
      windowBytes[item.direction === "in" ? "messagesIn" : "messagesOut"]++
    }
    return {
      label: this.label,
      unit: "UTF-8 JSON payload bytes (estimated; excludes network overhead and assets)",
      durationSeconds: duration / 1000,
      receivedBytesPerSecond: windowBytes.in * 1000 / duration,
      sentBytesPerSecond: windowBytes.out * 1000 / duration,
      window: windowBytes,
      total: {...this.totals},
      byEvent: Object.fromEntries(
        Object.entries(this.byEvent).map(([name, counts]) => [name, {...counts}]),
      ),
      retainedSamples: this.samples.length,
    }
  }
}

const LANE = topic => topic.startsWith("world:") ? "world" :
  topic.startsWith("helmet:") ? "helmet_control" : "other"

// Hooks into the public Channel on/push API. No flight/game command semantics
// change; existing callbacks, push receipts, timeouts and return values pass
// through unmodified. The channel's join acknowledgement is counted separately.
export function instrumentPhoenixChannel(channel, probe, lane) {
  const originalOn = channel.on.bind(channel)
  const originalPush = channel.push.bind(channel)
  channel.on = (event, callback) => originalOn(event, (...args) => {
    probe.record("in", lane, event, args[0])
    return callback(...args)
  })
  channel.push = (event, payload, ...args) => {
    probe.record("out", lane, event, payload)
    return originalPush(event, payload, ...args)
  }
  return channel
}

// The game's single Socket creates a world channel and HMD control channel.
// Observing at channel creation covers both without adding gameplay handlers.
export function instrumentPhoenixSocket(socket, probe) {
  const originalChannel = socket.channel.bind(socket)
  socket.channel = (topic, params) => instrumentPhoenixChannel(
    originalChannel(topic, params), probe, LANE(String(topic)),
  )
  return socket
}
