import {Socket} from "phoenix"
import {StereoSpaceView} from "./stereo_view.js"
import {storyHudModel} from "./story_hud.mjs"
import {BandwidthProbe, instrumentPhoenixSocket} from "./bandwidth_probe.mjs"
import {WorldStreamDelta} from "./world_stream_delta.mjs"
import {attachBandwidthPanel} from "./bandwidth_panel.mjs"
import {visualLaserRays} from "./laser_burst.mjs"
import {laserFeedback} from "./laser_feedback.mjs"
import {helmetSocketParams} from "./helmet_auth.mjs"
import {adjustedHelmetAlignment, HELMET_GAP_MIN, HELMET_GAP_MAX} from "./helmet_alignment.mjs"
import {restoredHelmetCalibration} from "./helmet_calibration_restore.mjs"
import {helmetSurrenderFromEntities} from "./helmet_surrender_view.mjs"
import {helmetRespawnView} from "./helmet_respawn_view.mjs"
import {helmetSurrenderChoice} from "./helmet_surrender_choice.mjs"
import {helmetModeIcon} from "./helmet_mode_icon.mjs"
import {MODE_GAZE_TARGET, nextFlightMode, modeSelectionAction} from "./helmet_mode_gaze.mjs"
import {helmetPlanetaryNavigation} from "./helmet_planetary_navigation.mjs"
import {pilotDockedInWorld} from "./green_starbase_interior_state.mjs"
import {dockingHoldFromEvent, syncDockingHold, dockingSeconds} from "./starbase_docking_countdown.mjs"
import {HelmetScreenWake} from "./helmet_screen_wake.mjs"
import {HelmetHeadTracking, headTrackingUnavailable} from "./helmet_head_tracking.mjs"
import {attachHelmetRelayTest, relayInvitationFromQR} from "./helmet_relay_test.mjs"
import {HelmetGazeDwell} from "./helmet_gaze_dwell.mjs"
import {
  HELMET_BANDWIDTH_HUD, renderHelmetBandwidth,
} from "./helmet_bandwidth_hud.mjs"
import {headsetScreenTapRecenterAllowed} from "./helmet_screen_recenter.mjs"
import {upsertHelmetEntity, smoothEntityPresentation, smoothHeading} from "./entity_smoothing.mjs"
import {localVisualPose, freshLocalVisualPose,
  VISUAL_POSE_SETTLE_SECONDS} from "./local_visual_pose.mjs"
import {ownPlanetaryWarning, planetaryWarningView} from "./planetary_warning.mjs"
import {helmetMaxPixelRatio, HELMET_DEFAULT_GAP_PX} from "./helmet_display.mjs"
import {parseLensCoefficients} from "./lens_distortion.mjs"
import {FrameScheduler} from "./frame_scheduler.mjs"

const STORAGE_KEY = "sunracer:pilot_hmd_credential"
const GAP_KEY = "sunracer:pilot_hmd_eye_gap"
const EYE_SEP_KEY = "sunracer:pilot_hmd_eye_sep"
const CALIBRATION_DIRTY_KEY = "sunracer:pilot_hmd_calibration_unsynced"
const CALIBRATION_SAVE_DELAY_MS = 350
const MAX_DPR_KEY = "sunracer:pilot_hmd_max_dpr"
const DISTORTION_KEY = "sunracer:pilot_hmd_lens_distortion"
// Optional per-headset "k1,k2" override for the distortion pass.
const LENS_K_KEY = "sunracer:pilot_hmd_lens_k"
const key = value => String(value)

// Read-only Phoenix companion. Head tracking and navigation gaze act only on
// locally rendered headset UI; no server flight/combat commands are sent.
export class HelmetClient {
  constructor(root) {
    this.root = root
    this.canvas = root.querySelector("#helmet-viewport")
    this.messageNode = root.querySelector("#helmet-message")
    this.pairCode = root.dataset.pairCode || null
    this.credential = localStorage.getItem(STORAGE_KEY)
    // Keep the QR invitation until the saved token has been verified.
    // If the local credential was revoked, the new QR can still enroll.
    this.mode = "standby"
    this.immersiveReady = false
    this.windowed = false
    // First run: the S21's two half-screen centres are ~72 mm apart, wider
    // than most phone-headset lenses, so start with an inward shift.
    const savedGap = Number(localStorage.getItem(GAP_KEY) ?? HELMET_DEFAULT_GAP_PX)
    this.eyeGapPx = Math.max(HELMET_GAP_MIN, Math.min(HELMET_GAP_MAX,
      Number.isFinite(savedGap) ? savedGap : HELMET_DEFAULT_GAP_PX))
    this.eyeSepMm = Math.max(40, Math.min(85, Number(localStorage.getItem(EYE_SEP_KEY)) || 64))
    this.calibrationRevision = 0
    this.calibrationSaveTimer = null
    this.calibrationSaveInFlight = false
    this.entities = new Map()
    // Measure this legacy phone-to-Phoenix connection while the future
    // laptop-to-phone LAN relay is still under development.
    this.bandwidth = new BandwidthProbe("headset-server")
    this.worldStream = null
    this.helmetResyncInFlight = false
    this.lastHelmetResyncAt = -Infinity
    this.selfId = null
    // Same field the laptop sets; StereoSpaceView draws it in the 3D HUD.
    this.planetaryWarningDisplay = null
    // Encounter hold drawn inside the stereo HUD, not a flat DOM card.
    this.encounterHold = null
    // Prologue objective line, same field shape the laptop's StoryHud exposes.
    this.storyHud = {stereoLine: null}
    this.selectedTargetId = null
    this.helmetSurrender = null
    this.respawnPending = false
    this.respawnError = null
    this.surrenderPending = false
    this.surrenderError = null
    this.surrenderDismissed = false
    this.modePending = false
    this.beams = []
    this.lastLaserFeedback = null
    this.view = null
    // StereoSpaceView reads the same navComputer.visual data on laptop and HMD.
    this.navComputer = {solarNavigation: {planetary_view: null}}
    this.orbitalBase = null
    this.mapId = null
    this.docked = false
    this.stationPosition = null
    this.stationAttendants = []
    this.stationDockingHold = null
    this.stationDockingSeconds = null
    this.screenWake = new HelmetScreenWake()
    this.gaze = new HelmetGazeDwell()
    this.headTracking = new HelmetHeadTracking({
      onStatus: status => this.showHeadTrackingStatus(status),
    })
    this.running = false
    this.frameCount = 0
    // One animation-frame request at a time. A frame queued before the page
    // was hidden otherwise resumes alongside the new loop, and every
    // sleep/wake cycle adds another full stereo render per vsync.
    this.frames = new FrameScheduler()
    this.lastFrameAt = null
    this.lastScreenRecenterAt = -Infinity
    this.lastSbsBandwidthUpdateAt = -Infinity
    this.localRelayActive = false
    this.localRelaySeq = 0
    this.localRelayLastSeen = -Infinity
    this.latestRelayMap = null
    this.localVisualPose = null
    this.localRelayCheckTimer = null
  }

  async start() {
    // Capture the QR fragment before any pairing code clears the URL.
    // It cannot be sent to Phoenix: fragments are browser-local.
    const relayInvitation = relayInvitationFromQR(window.location.href)
    if (window.location.hash) {
      window.history.replaceState({}, "", window.location.pathname + window.location.search)
    }
    this.setupImmersiveControls()
    this.localLink = attachHelmetRelayTest(this.root, {
      onWorld: frame => this.acceptLocalWorld(frame),
      onHeartbeat: () => {this.localRelayLastSeen = performance.now()},
      onOffline: () => this.disableLocalRelay(),
      onVerified: () => {this.localRelayLastSeen = performance.now()},
    })
    attachBandwidthPanel(this.root, this.bandwidth)

    if (this.credential) {
      const verification = await this.verifySavedCredential()
      if (verification === true && this.pairCode) {
        // The phone is already registered. Do not consume a second invitation.
        this.pairCode = null
        window.history.replaceState({}, "", "/helmet")
      }
    }

    if (!this.credential && this.pairCode) {
      // Redeem once over HTTP and persist the token BEFORE opening Phoenix.
      // A viewer channel crash must never leave a consumed QR with no token.
      if (!await this.redeemPairingCode()) return
    }

    if (!this.credential) {
      this.message("No saved helmet registration. Open Atlas → PILOT HMD and scan a new QR code.")
      return
    }

    // The phone automatically reaches Tauri on the local LAN only after
    // the existing Phoenix QR credential has been authenticated.
    if (relayInvitation) this.localLink.prove(relayInvitation)

    this.socket = instrumentPhoenixSocket(new Socket("/socket", {
      params: () => helmetSocketParams({credential: this.credential}),
    }), this.bandwidth)
    window.sunRacerBandwidth = this.bandwidth
    this.socket.connect()
    this.channel = this.socket.channel("helmet:viewer", {device_name: "Android VR headset"})
    this.channel.on("helmet_mode", ({mode}) => this.setMode(mode))
    this.channel.on("helmet_alignment_adjust", ({axis, direction}) => {
      this.adjustAlignmentFromPilot(axis, direction)
    })
    this.channel.on("helmet_recenter", () => this.recenterFromPilot())
    this.channel.on("helmet_snapshot", ({map, player_id}) => {
      if (this.localRelayActive) return
      this.selfId = key(player_id)
      // A snapshot replaces the complete local delta baseline, including
      // after changing orbital regions or reconnecting the headset.
      this.worldStream = new WorldStreamDelta(map)
      this.helmetResyncInFlight = false
      this.applyWorld(map, {snap: true})
    })
    this.channel.on("world_delta", delta => {
      if (this.mode !== "combat" || this.localRelayActive) return
      if (!this.worldStream) {
        this.requestHelmetResync()
        return
      }
      const map = this.worldStream.apply(delta)
      if (map) this.applyWorld(map)
      else this.requestHelmetResync()
    })
    // Compatibility with an older local development server. New servers
    // should send a full snapshot only on initial join/resynchronization.
    this.channel.on("world_state", map => {
      if (this.mode !== "combat" || this.localRelayActive) return
      this.worldStream = new WorldStreamDelta(map)
      this.applyWorld(map, {snap: true})
    })
    // Explicit status is pushed on changes and reconnect; the world snapshot
    // remains a second path so the paired phone never depends on target lock.
    this.channel.on("helmet_surrender", payload => {
      if (this.mode === "combat") this.updateSurrender(payload)
    })
    this.channel.on("laser_fired", shot => this.laserFired(shot))
    this.channel.on("helmet_encounter", payload => {
      // Drawn inside the stereo HUD (StereoSpaceView.updateHud). A flat DOM
      // card split 50/50 ignores lens calibration and sits at screen depth.
      this.encounterHold = payload?.paused === true && payload.encounter
        ? {call_sign: String(payload.encounter.call_sign || "CONTACT")} : null
    })
    this.channel.on("helmet_story", payload => {
      // Read-only: the phone never sends story choices.
      this.storyHud = {stereoLine: storyHudModel(payload).stereoLine}
    })
    this.channel.on("helmet_navigation", payload => {
      this.navComputer.solarNavigation = helmetPlanetaryNavigation(payload)
    })
    this.channel.on("station_docking_started", payload => {
      if (key(payload.entity_id) === this.selfId && !this.docked) {
        this.stationDockingHold = dockingHoldFromEvent(payload, performance.now())
      }
    })
    this.channel.on("station_docking_cancelled", payload => {
      if (key(payload.entity_id) === this.selfId) this.stationDockingHold = null
    })
    this.channel.on("helmet_revoked", () => {
      localStorage.removeItem(STORAGE_KEY)
      this.credential = null
      this.mode = "standby"
      this.stop()
      this.message("Helmet was unpaired. Scan a new QR code.")
      this.socket.disconnect()
    })
    this.channel.on("helmet_error", ({reason}) => this.message(reason))
    this.channel.onError(() => {
      this.calibrationSaveInFlight = false
      this.disableLocalRelay()
      this.stop()
      this.message("Helmet link interrupted. Reconnecting…")
    })
    this.socket.onError(async () => {
      // A rejected WebSocket transport doesn't expose a Phoenix channel
      // reason. Check the bearer credential separately so a stale pairing
      // isn't misreported as an unreachable LAN.
      if (this.credential && await this.verifySavedCredential() === false) {
        this.socket.disconnect()
        this.stop()
        this.message("Saved helmet pairing rejected by Phoenix. Open Atlas → PILOT HMD → Forget headset, then scan a fresh QR code.")
      } else {
        this.message("Helmet WebSocket interrupted or blocked. Check that the laptop is still serving on the phone's network.")
      }
    })
    this.channel.join()
      .receive("ok", ({mode, player_id, calibration}) => {
        this.bandwidth.record("in", "helmet_control", "join_ack",
          {mode, player_id, calibration})
        this.selfId = key(player_id)
        // Restore BEFORE starting the SBS frame loop; never flash a default
        // separation in the headset when PostgreSQL already has a setting.
        this.restoreServerCalibration(calibration)
        this.setMode(mode)
        if (this.localRelayCheckTimer === null) {
          this.localRelayCheckTimer = setInterval(() => {
            if (this.localRelayActive &&
                performance.now() - this.localRelayLastSeen > 10_000) {
              this.disableLocalRelay()
            }
          }, 2_000)
        }
      })
      .receive("error", ({reason}) => {
        this.message("Helmet viewer connection refused: " + (reason || "unknown"))
        this.channel.leave()
      })
    window.addEventListener("resize", () => {
      this.resize()
      if (this.mode === "combat" && this.immersiveReady && !this.running) this.startRendering()
    })
    window.addEventListener("orientationchange", () => {
      this.headTracking.requestRecenter()
      this.resize()
    })
    window.visualViewport?.addEventListener("resize", () => this.resize())
    document.addEventListener("visibilitychange", () => {
      this.screenWake.onVisibilityChange()
      if (document.hidden) {
        this.gaze.reset()
        this.view?.setHelmetHeadRotation(null)
        // Best-effort write before the OS backgrounds the browser.
        this.persistCalibration()
        this.running = false
        this.cancelFrame()
        this.report(false)
      } else if (this.mode === "combat" && this.immersiveReady) {
        this.startRendering()
      }
    })
    window.addEventListener("pagehide", () => {
      this.persistCalibration()
      this.screenWake.disable()
      this.headTracking.stop()
    })
    window.addEventListener("pageshow", () => {
      if (this.immersiveReady) this.screenWake.enable()
    })
    setInterval(() => {
      this.report(this.running && this.frameCount > 0 && !document.hidden)
      if (localStorage.getItem(CALIBRATION_DIRTY_KEY) === "1" &&
          !this.calibrationSaveTimer && !this.calibrationSaveInFlight) {
        this.scheduleCalibrationSave()
      }
    }, 5000)
  }

  async redeemPairingCode() {
    if (!this.pairCode) return false

    // Check storage before consuming the single-use invitation.
    try {
      const storageTestKey = STORAGE_KEY + ":storage_test"
      localStorage.setItem(storageTestKey, "1")
      localStorage.removeItem(storageTestKey)
    } catch (_error) {
      this.message("This browser is blocking local storage. Enable site storage or use Chrome/Samsung Internet before pairing.")
      return false
    }

    this.message("Registering helmet with Phoenix…")
    try {
      const response = await fetch("/helmet/pair", {
        method: "POST",
        headers: {"Content-Type": "application/json", "Accept": "application/json"},
        cache: "no-store",
        credentials: "omit",
        body: JSON.stringify({code: this.pairCode, device_name: "Galaxy S21 headset"}),
      })
      const result = await response.json().catch(() => ({}))
      if (response.ok && typeof result.credential === "string") {
        // Save the credential before any viewer channel can subscribe/crash.
        localStorage.setItem(STORAGE_KEY, result.credential)
        this.credential = result.credential
        this.pairCode = null
        window.history.replaceState({}, "", "/helmet")
        this.message("Helmet registered. Connecting display…")
        return true
      }
      if (response.status === 409) {
        this.message("The laptop already has a paired helmet, but this browser has no valid saved credential. Choose Forget headset in the laptop Atlas, then scan the new QR once.")
      } else if (response.status === 410) {
        this.message("This QR invitation was already consumed or the Atlas panel closed. If the laptop shows PAIRED but this phone has no saved credential, choose Forget headset once, then scan a fresh QR with the panel open.")
      } else {
        this.message("Helmet registration failed (" + response.status + "). Check the Phoenix server log.")
      }
      return false
    } catch (_error) {
      this.message("Could not reach the helmet registration endpoint. Check the laptop network address.")
      return false
    }
  }

  async verifySavedCredential() {
    if (!this.credential) return null
    try {
      const response = await fetch("/helmet/verify", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Authorization": "Bearer " + this.credential,
        },
        cache: "no-store",
        credentials: "omit",
      })
      if (response.status === 401) {
        // Local bearer is stale or revoked. The phone can re-enroll with
        // a newly scanned QR, or tell the pilot how to regenerate pairing.
        localStorage.removeItem(STORAGE_KEY)
        this.credential = null
        this.message("Saved helmet registration is not recognized. In the laptop Atlas, choose Forget headset, then scan its new QR code.")
        return false
      }
      return response.ok ? true : null
    } catch (_error) {
      // Could be a temporary LAN failure: do not destroy a valid credential.
      return null
    }
  }

  setupImmersiveControls() {
    const setup = this.root.querySelector("#helmet-setup")
    const hint = this.root.querySelector("#helmet-fullscreen-hint")
    const fullscreen = this.root.querySelector("#helmet-fullscreen")
    const windowed = this.root.querySelector("#helmet-windowed")
    const distortion = this.root.querySelector("#helmet-lens-distortion")
    if (distortion) {
      distortion.checked = this.lensDistortionEnabled()
      distortion.addEventListener("change", () => {
        localStorage.setItem(DISTORTION_KEY, distortion.checked ? "1" : "0")
        this.applyLensDistortion()
      })
    }

    // The mechanical VR button presses the phone display like a finger.
    // Capture touchscreen/pen presses at the root so an encounter overlay
    // cannot block the button. Click also supports synthesized tap-only
    // browsers. Debounce their two event paths into one recenter action.
    const recenterFromScreenTap = event => {
      if (event.type === "pointerdown" &&
          event.pointerType !== "touch" && event.pointerType !== "pen") return
      if (!headsetScreenTapRecenterAllowed({
        mode: this.mode,
        immersiveReady: this.immersiveReady,
        running: this.running,
        setupVisible: !setup?.hidden,
        target: event.target,
      })) return
      const now = performance.now()
      if (now - this.lastScreenRecenterAt < 400) return
      this.lastScreenRecenterAt = now
      this.recenterFromPilot()
    }
    this.root.addEventListener("pointerdown", recenterFromScreenTap, true)
    this.root.addEventListener("click", recenterFromScreenTap, true)

    fullscreen?.addEventListener("click", async () => {
      if (!this.root.requestFullscreen) {
        if (hint) {
          hint.textContent = "Fullscreen unavailable. Try Chrome or Samsung Internet."
          hint.hidden = false
        }
        if (windowed) windowed.hidden = false
        return
      }
      try {
        // One tap starts the sensor subscription automatically. DO NOT await
        // this permission request before requestFullscreen: awaiting can
        // consume the gesture required by Android/iOS fullscreen browsers.
        // Some platforms may still ask permission on the first tap.
        void this.headTracking.startFromGesture()
        this.screenWake.enable()
        await this.root.requestFullscreen()
        this.windowed = false
        this.immersiveReady = true
        if (setup) setup.hidden = true
        try { await screen.orientation?.lock?.("landscape") } catch (_error) { /* rotate manually */ }
        this.resize()
        if (this.mode === "combat") this.startRendering()
      } catch (_error) {
        this.screenWake.disable()
        if (hint) {
          hint.textContent = "Fullscreen blocked. Try Chrome or Samsung Internet."
          hint.hidden = false
        }
        if (windowed) windowed.hidden = false
      }
    })
    windowed?.addEventListener("click", () => {
      // The fallback also starts sensors from the same physical tap.
      void this.headTracking.startFromGesture()
      this.screenWake.enable()
      this.windowed = true
      this.immersiveReady = true
      if (setup) setup.hidden = true
      if (this.mode === "combat") this.startRendering()
    })
    document.addEventListener("fullscreenchange", () => {
      this.resize()
      if (document.fullscreenElement === this.root) {
        this.immersiveReady = true
        if (setup) setup.hidden = true
        if (this.mode === "combat") this.startRendering()
      } else if (!this.windowed && this.immersiveReady) {
        this.screenWake.disable()
        this.immersiveReady = false
        this.stop()
        if (setup) setup.hidden = false
      }
    })
  }

  lensDistortionEnabled() {
    return localStorage.getItem(DISTORTION_KEY) === "1"
  }

  applyLensDistortion() {
    this.view?.setLensDistortion(this.lensDistortionEnabled(),
      parseLensCoefficients(localStorage.getItem(LENS_K_KEY)))
  }

  recenterFromPilot() {
    if (this.mode !== "combat" || !this.immersiveReady || !this.running) return
    // Immediately aim the virtual eyes straight down the ship axis, then
    // use the next physical sensor sample as the new headset neutral pose.
    this.headTracking.requestRecenter()
    this.view?.setHelmetHeadRotation(null)
    this.view?.setHelmetNavOpen(false)
    this.gaze.reset()
  }

  adjustAlignmentFromPilot(axis, direction) {
    if (this.mode !== "combat" || !this.immersiveReady || !this.running) return
    const next = adjustedHelmetAlignment(
      {eyeGapPx: this.eyeGapPx, eyeSepMm: this.eyeSepMm}, axis, direction)
    if (!next) return

    this.eyeGapPx = next.eyeGapPx
    this.eyeSepMm = next.eyeSepMm
    this.rememberCalibration()

    this.applyAlignment()
    this.reportAlignment()
  }

  restoreServerCalibration(saved) {
    const remote = saved && {
      eyeGapPx: saved.eye_gap_px,
      eyeSepMm: saved.eye_sep_mm,
    }
    const restored = restoredHelmetCalibration({
      server: remote,
      local: {eyeGapPx: this.eyeGapPx, eyeSepMm: this.eyeSepMm},
      dirty: localStorage.getItem(CALIBRATION_DIRTY_KEY) === "1",
    })

    this.eyeGapPx = restored.calibration.eyeGapPx
    this.eyeSepMm = restored.calibration.eyeSepMm
    localStorage.setItem(GAP_KEY, String(this.eyeGapPx))
    localStorage.setItem(EYE_SEP_KEY, String(this.eyeSepMm))

    if (restored.needsSave) {
      localStorage.setItem(CALIBRATION_DIRTY_KEY, "1")
      this.calibrationRevision++
      this.scheduleCalibrationSave()
    } else {
      localStorage.removeItem(CALIBRATION_DIRTY_KEY)
    }

    this.applyAlignment()
    this.reportAlignment()
  }

  rememberCalibration() {
    // Local storage updates synchronously on every keypress. A reload before
    // PostgreSQL acknowledges still preserves the last adjustment on the phone.
    localStorage.setItem(GAP_KEY, String(this.eyeGapPx))
    localStorage.setItem(EYE_SEP_KEY, String(this.eyeSepMm))
    localStorage.setItem(CALIBRATION_DIRTY_KEY, "1")
    this.calibrationRevision++
    this.scheduleCalibrationSave()
  }

  scheduleCalibrationSave() {
    if (this.calibrationSaveTimer) clearTimeout(this.calibrationSaveTimer)
    this.calibrationSaveTimer = setTimeout(() => {
      this.calibrationSaveTimer = null
      this.persistCalibration()
    }, CALIBRATION_SAVE_DELAY_MS)
  }

  persistCalibration() {
    if (this.calibrationSaveInFlight || this.channel?.state !== "joined" ||
        localStorage.getItem(CALIBRATION_DIRTY_KEY) !== "1") return

    this.calibrationSaveInFlight = true
    const revision = this.calibrationRevision
    const payload = {
      eye_gap_px: Math.round(this.eyeGapPx),
      eye_sep_mm: Math.round(this.eyeSepMm),
    }

    this.channel.push("save_alignment", payload, 5000)
      .receive("ok", saved => {
        this.calibrationSaveInFlight = false
        if (revision === this.calibrationRevision &&
            saved.eye_gap_px === payload.eye_gap_px &&
            saved.eye_sep_mm === payload.eye_sep_mm) {
          localStorage.removeItem(CALIBRATION_DIRTY_KEY)
        } else {
          // A newer adjustment was made during this write: save it next.
          this.scheduleCalibrationSave()
        }
      })
      .receive("error", () => {
        // Retain local data. Retry after the channel reconnects or the
        // periodic health report fires; never interrupt the VR display.
        this.calibrationSaveInFlight = false
      })
      .receive("timeout", () => {
        this.calibrationSaveInFlight = false
      })
  }

  reportAlignment() {
    if (this.channel?.state !== "joined") return
    this.channel.push("alignment_state", {
      eye_gap_px: Math.round(this.eyeGapPx),
      eye_sep_mm: Math.round(this.eyeSepMm),
    })
  }

  applyAlignment() {
    this.view?.setHelmetAlignment({eyeGapPx: this.eyeGapPx, eyeSep: this.eyeSepMm / 1000})
  }

  setMode(mode) {
    this.mode = mode === "combat" ? "combat" : "standby"
    if (this.mode !== "combat") this.encounterHold = null
    if (this.mode === "combat") {
      if (this.latestRelayMap &&
          performance.now() - this.localRelayLastSeen < 10_000) {
        this.applyLocalMap(this.latestRelayMap)
      }
      if (this.immersiveReady) this.startRendering()
    } else {
      this.disableLocalRelay()
      this.stop()
      this.message("")
    }
  }

  // Local map frames originate ONLY from the one-time authenticated,
  // same-host TLS iframe. Phoenix remains the pilot's source of identity.
  acceptLocalWorld({seq, map}) {
    if (!Number.isSafeInteger(seq) || seq <= this.localRelaySeq ||
        !Number.isSafeInteger(map?.tick) ||
        !Array.isArray(map?.entities) || map.entities.length > 256 ||
        typeof map.map_id !== "string") return
    this.localRelaySeq = seq
    this.localRelayLastSeen = performance.now()
    this.latestRelayMap = map
    if (this.mode === "combat") this.applyLocalMap(map)
  }

  applyLocalMap(map) {
    if (this.channel?.state !== "joined" || !this.selfId ||
        !map.entities.some(e => key(e.id) === this.selfId)) return
    // The first cutover covers flight. Keep Phoenix world delivery while
    // the pilot is walking through the Green Starbase's interior.
    if (pilotDockedInWorld(map, this.selfId)) {
      this.disableLocalRelay()
      return
    }
    this.worldStream = new WorldStreamDelta(map)
    this.applyWorld(map)
    // The LAN-only visual pose follows the desktop's current predicted
    // camera. It never overwrites Phoenix's authoritative orientation.
    this.localVisualPose = localVisualPose(map, this.selfId, performance.now()) ||
      (this.localVisualPose?.mapId === map.map_id ? this.localVisualPose : null)
    this.bandwidth.record("in", "headset_lan", "world_snapshot", map)
    if (!this.localRelayActive) {
      this.localRelayActive = true
      this.channel.push("relay_stream_mode", {mode: "local"}, 5000)
        .receive("error", () => this.disableLocalRelay())
        .receive("timeout", () => this.disableLocalRelay())
    }
  }

  disableLocalRelay() {
    this.localVisualPose = null
    if (!this.localRelayActive) return
    this.localRelayActive = false
    // Phoenix responds with its current authoritative snapshot to establish
    // a fresh delta baseline; LAN ticks never become a server baseline.
    if (this.channel?.state === "joined") {
      this.channel.push("relay_stream_mode", {mode: "phoenix"}, 5000)
        .receive("error", () => this.requestHelmetResync())
        .receive("timeout", () => this.requestHelmetResync())
    }
  }

  startRendering() {
    if (document.hidden || this.running || !this.immersiveReady) return
    if (window.innerWidth < window.innerHeight) {
      this.canvas.hidden = true
      this.message("Rotate the phone to landscape for side-by-side headset alignment.")
      this.report(false)
      return
    }
    if (!this.view) {
      try {
        this.view = new StereoSpaceView(this.canvas)
        this.view.maxPixelRatio = helmetMaxPixelRatio(localStorage.getItem(MAX_DPR_KEY))
        this.view.setHelmetTrackingUnavailable(headTrackingUnavailable(this.headTracking.status))
        this.applyLensDistortion()
        this.view.setMode("sbs")
        this.view.setHelmetGazeEnabled(true)
        this.view.onHelmetGaze = (target, time) => this.updateHelmetGaze(target, time)
        this.applyAlignment()
      } catch (_error) {
        this.message("This phone's browser could not initialize WebGL.")
        this.report(false)
        return
      }
    }
    this.canvas.hidden = false
    // These two eye overlays remain visible without head tracking.
    const bandwidthOverlay = this.root.querySelector("#helmet-bandwidth-sbs")
    if (bandwidthOverlay) bandwidthOverlay.hidden = false
    this.lastSbsBandwidthUpdateAt = -Infinity
    this.updateSbsBandwidth(performance.now())
    // The initial permission tap may have been in portrait or outside the
    // headset. Recenter after the immersive cockpit actually starts.
    this.headTracking.requestRecenter()
    this.gaze.reset()
    this.view.setHelmetHeadRotation(null)
    this.resize()
    this.message("")
    this.running = true
    this.lastFrameAt = null
    this.requestFrame()
  }

  requestFrame() {
    this.frames.request(time => this.frame(time))
  }

  cancelFrame() {
    this.frames.cancel()
  }

  stop() {
    this.gaze.reset()
    this.view?.setHelmetHeadRotation(null)
    this.view?.setHelmetNavOpen(false)
    this.running = false
    this.cancelFrame()
    this.frameCount = 0
    this.encounterHold = null
    this.planetaryWarningDisplay = null
    this.updateSurrender(null)
    this.helmetSurrender = null
    this.respawnPending = false
    this.respawnError = null
    this.surrenderPending = false
    this.surrenderError = null
    this.surrenderDismissed = false
    this.modePending = false
    this.view?.setHelmetDestroyed({destroyed: false})
    this.view?.setHelmetModeIcon({visible: false})
    this.view?.setHelmetSurrenderChoice({open: false})
    this.canvas.hidden = true
    const bandwidthOverlay = this.root.querySelector("#helmet-bandwidth-sbs")
    if (bandwidthOverlay) bandwidthOverlay.hidden = true
    this.entities.clear()
    this.worldStream = null
    this.helmetResyncInFlight = false
    this.navComputer.solarNavigation = {planetary_view: null}
    this.orbitalBase = null
    this.mapId = null
    this.docked = false
    this.stationPosition = null
    this.stationAttendants = []
    this.stationDockingHold = null
    this.stationDockingSeconds = null
    this.beams = []
    this.report(false)
  }

  resize() {
    if (!this.view) return
    // The view applies its own maxPixelRatio cap (2.0 on the headset):
    // the lenses magnify every pixel, and 1.5 left the HUD text soft.
    this.view.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1)
  }

  updateSurrenderChoice() {
    const view = helmetSurrenderChoice(this.helmetSurrender,
      {pending: this.surrenderPending, error: this.surrenderError,
       dismissed: this.surrenderDismissed})
    this.view?.setHelmetSurrenderChoice(view)
  }

  // Both outcomes are settled entirely by the server: it resolves the
  // encounter from this pilot's own session, and the map refuses unless the
  // opponent really has surrendered. The headset sends no encounter, ship,
  // cargo or target of any kind.
  requestSurrenderOutcome(event) {
    if (this.surrenderPending || this.channel?.state !== "joined" ||
        this.helmetSurrender?.surrendered !== true) return
    this.surrenderPending = true
    this.surrenderError = null
    this.updateSurrenderChoice()
    const old = this.channel

    const failed = reason => {
      if (this.channel !== old) return
      this.surrenderPending = false
      this.surrenderError = reason
      this.gaze.reset()
      this.updateSurrenderChoice()
    }

    old.push(event, {}, 5_000)
      .receive("ok", () => {
        if (this.channel !== old) return
        this.surrenderPending = false
        this.surrenderError = null
        this.gaze.reset()
        // The encounter is closed; the server stops pushing surrender state.
        this.updateSurrender(null)
        this.requestHelmetResync()
      })
      .receive("error", ({reason} = {}) => failed(reason || "refused"))
      .receive("timeout", () => failed("timeout"))
  }

  updateSurrender(payload) {
    // This field is consumed by StereoSpaceView.updateHud(), so the status
    // is part of the actual stereoscopic WebGL instrument, not HTML alone.
    const offered = payload?.surrendered === true
    const previous = this.helmetSurrender?.call_sign
    this.helmetSurrender = offered
      ? {surrendered: true, call_sign: payload.call_sign}
      : {surrendered: false}
    // A different captain yielding is a new decision, so a prompt the pilot
    // waved away with KEEP FIRING comes back rather than staying hidden.
    if (!offered || payload.call_sign !== previous) {
      this.surrenderDismissed = false
      this.surrenderError = null
    }
    // The HUD already shows the surrender line in stereo; the old flat DOM
    // overlay duplicated it at screen depth.
    this.updateSurrenderChoice()
  }

  applyWorld(map, {snap = false} = {}) {
    if (!map?.entities || this.mode !== "combat") return
    // The helmet uses its pilot's server-subscribed orbital region, not a
    // phone-provided map ID. Green Starbase must only appear in deep space.
    const previousMapId = this.mapId
    this.mapId = typeof map.map_id === "string" ? map.map_id : null
    // A different map is a new place: never sweep the camera across it.
    if (previousMapId && this.mapId !== previousMapId) snap = true
    const wasDocked = this.docked
    this.docked = pilotDockedInWorld(map, this.selfId)
    this.stationPosition = this.docked ?
      map.station_avatars?.find(avatar => key(avatar.player_id) === this.selfId) || null
      : null
    this.stationAttendants = Array.isArray(map.station_attendants) ?
      map.station_attendants : []
    this.stationDockingHold = this.docked ? null :
      syncDockingHold(this.stationDockingHold, map, this.selfId, performance.now())
    if (wasDocked !== this.docked) {
      this.gaze.reset()
      this.view?.setHelmetNavOpen(false)
    }
    this.orbitalBase = map.orbital_base || null
    const active = new Set()
    for (const e of map.entities) {
      // Keep one object per entity so smoothing state survives updates.
      const entity = upsertHelmetEntity(this.entities, e, key, {snap})
      active.add(entity.id)
    }
    for (const id of this.entities.keys()) {
      if (!active.has(id)) this.entities.delete(id)
    }
    this.selectedTargetId = this.entities.get(this.selfId)?.targetId || null
    this.planetaryWarningDisplay = planetaryWarningView(ownPlanetaryWarning(map, this.selfId))
    this.updateSurrender(helmetSurrenderFromEntities(this.entities, this.selfId))
    this.updateRespawnPanel()
    this.updateModeIcon()
  }

  updateModeIcon() {
    this.view?.setHelmetModeIcon(
      helmetModeIcon(this.entities, this.selfId, {pending: this.modePending}))
  }

  // One visible icon toggles the authoritative ship mode. The relay remains
  // an explicit intent, not a headset-issued flight command.
  requestFlightModeSelection(mode) {
    const action = modeSelectionAction(mode)
    if (!action || this.modePending || this.channel?.state !== "joined") return
    const current = this.entities.get(this.selfId)?.flightMode
    if (current !== "cruise" && current !== "newtonian") return
    // Leave the fixed gaze target latched until the pilot looks away.
    // A stationary gaze must never toggle a second time after confirmation.
    if (mode === current) return
    this.modePending = true
    this.updateModeIcon()
    const old = this.channel
    const settle = (reason = null) => {
      if (this.channel !== old) return
      this.modePending = false
      // Don't reset gaze on acknowledgement. The same held gaze must not
      // dispatch another command before the world confirms the new mode.
      this.updateModeIcon()
      if (reason) this.message("Flight mode switch unavailable: " + reason)
    }
    old.push("helmet_action", {action}, 5_000)
      .receive("ok", () => settle())
      .receive("error", reply => settle(reply?.reason || "request rejected"))
      .receive("timeout", () => settle("request timed out"))
  }

  updateRespawnPanel() {
    const view = helmetRespawnView(this.entities, this.selfId,
      {pending: this.respawnPending, error: this.respawnError})
    // A live hull clears any stale refusal left over from an earlier death.
    if (!view.destroyed && this.respawnError) this.respawnError = null
    this.view?.setHelmetDestroyed(view)
  }

  // The single world-mutating message the headset sends. The server refuses
  // unless the map itself reports this pilot's ship destroyed, so a stray
  // gaze cannot do anything but request a recovery the server already allows.
  requestRespawn() {
    if (this.respawnPending || this.channel?.state !== "joined" ||
        this.entities.get(this.selfId)?.status !== "destroyed") return
    this.respawnPending = true
    this.respawnError = null
    this.updateRespawnPanel()
    const old = this.channel

    const failed = reason => {
      if (this.channel !== old) return
      this.respawnPending = false
      this.respawnError = reason
      this.gaze.reset()
      this.updateRespawnPanel()
    }

    old.push("respawn", {}, 10_000)
      .receive("ok", () => {
        if (this.channel !== old) return
        this.respawnPending = false
        this.respawnError = null
        this.gaze.reset()
        // The pilot is somewhere else entirely now; take a fresh map rather
        // than smoothing the wreck across the system to Earth.
        this.entities.clear()
        this.selectedTargetId = null
        this.stationDockingHold = null
        this.updateRespawnPanel()
        this.requestHelmetResync()
      })
      .receive("error", ({reason} = {}) => failed(reason || "refused"))
      .receive("timeout", () => failed("timeout"))
  }

  // Same presentation smoothing the laptop uses between world updates.
  // Without it the headset camera steps at the update rate (10 Hz from
  // Phoenix, ~16 Hz from the LAN relay), the main cause of judder in VR.
  smooth(time) {
    const deltaSeconds = this.lastFrameAt === null ? 0
      : Math.min(0.25, Math.max(0, (time - this.lastFrameAt) / 1000))
    this.lastFrameAt = time
    const visual = this.localRelayActive
      ? freshLocalVisualPose(this.localVisualPose, this.mapId, this.selfId, time)
      : null
    // Laptop virtual-joystick deflection; StereoSpaceView draws the line.
    // Expires with the visual pose, so a stale stick is never shown.
    this.steeringDeflection = visual?.steering || null
    for (const entity of this.entities.values()) {
      if (visual && entity.id === this.selfId && !this.docked) {
        smoothEntityPresentation(entity, deltaSeconds,
          VISUAL_POSE_SETTLE_SECONDS,
          {orientation: visual.orientation, target: visual.target,
            positionSettleSeconds: VISUAL_POSE_SETTLE_SECONDS})
      } else {
        smoothEntityPresentation(entity, deltaSeconds)
      }
      entity.angle = smoothHeading(entity.angle, entity.targetAngle, deltaSeconds)
    }
  }

  laserFired(shot) {
    if (this.mode !== "combat") return
    const attacker = this.entities.get(key(shot.attacker_id))
    const target = this.entities.get(key(shot.target_id))
    const at = performance.now()
    for (const ray of visualLaserRays(shot, attacker, target)) {
      this.beams.push({...ray, hostile: attacker?.kind === "npc",
        startedAt: at, expiresAt: at + 550})
    }
    if (key(shot.attacker_id) === this.selfId) {
      this.lastLaserFeedback = laserFeedback(shot, this.entities, at)
    }
  }

  updateSbsBandwidth(time) {
    if (time - this.lastSbsBandwidthUpdateAt < HELMET_BANDWIDTH_HUD.refreshMs) return
    this.lastSbsBandwidthUpdateAt = time
    renderHelmetBandwidth(this.root,
      this.bandwidth.snapshot(HELMET_BANDWIDTH_HUD.windowMs))
  }

  // Recovery is permitted only for the paired, authenticated visual channel.
  // Do not send a client-selected map or use the desktop pilot credential.
  requestHelmetResync() {
    if (this.helmetResyncInFlight || this.channel?.state !== "joined") return
    const now = performance.now()
    if (now - this.lastHelmetResyncAt < 1_500) return
    this.lastHelmetResyncAt = now
    this.helmetResyncInFlight = true
    this.channel.push("helmet_resync", {})
      .receive("ok", ({map}) => {
        this.helmetResyncInFlight = false
        if (!map || this.mode !== "combat") return
        this.worldStream = new WorldStreamDelta(map)
        this.applyWorld(map, {snap: true})
      })
      .receive("error", () => { this.helmetResyncInFlight = false })
      .receive("timeout", () => { this.helmetResyncInFlight = false })
  }

  frame(time) {
    if (!this.running || this.mode !== "combat" || document.hidden) return
    try {
      this.updateSbsBandwidth(time)
      this.beams = this.beams.filter(beam => beam.expiresAt > time)
      this.stationDockingSeconds = this.docked ? null :
        dockingSeconds(this.stationDockingHold, time)
      this.smooth(time)
      this.view.setHelmetHeadRotation(this.headTracking.rotation(time))
      this.view.render(this, time)
      this.frameCount++
      if (this.frameCount === 1) this.report(true)
    } catch (_error) {
      this.stop()
      this.message("Headset rendering stopped. Check WebGL support.")
      return
    }
    this.requestFrame()
  }

  updateHelmetGaze(target, time) {
    const enabled = this.running && this.immersiveReady &&
      !document.hidden && this.headTracking.ready(time)
    const update = this.gaze.update(target, time, enabled)
    this.view?.updateGazeFeedback(update)
    if (update.activated === "nav_open" || update.activated === "hud_inspect") {
      this.view?.setHelmetHudPage("flight")
      this.view?.setHelmetNavOpen(true)
      this.gaze.reset()
    } else if (update.activated === "hud_flight" ||
               update.activated === "hud_contacts" ||
               update.activated === "hud_space") {
      // Do NOT reset the latch: a held look must not repeatedly activate a tab.
      this.view?.setHelmetHudPage(update.activated.slice(4))
    } else if (update.activated === "nav_close") {
      this.view?.setHelmetNavOpen(false)
      this.gaze.reset()
    } else if (update.activated === MODE_GAZE_TARGET) {
      this.requestFlightModeSelection(
        nextFlightMode(this.entities.get(this.selfId)?.flightMode))
    } else if (update.activated === "surrender_accept") {
      this.requestSurrenderOutcome("solar_accept_surrender")
    } else if (update.activated === "surrender_seize") {
      this.requestSurrenderOutcome("solar_seize_cargo")
    } else if (update.activated === "surrender_dismiss") {
      // Keep firing: purely local, nothing is sent and the fight continues.
      this.surrenderDismissed = true
      this.gaze.reset()
      this.updateSurrenderChoice()
    } else if (update.activated === "respawn") {
      // Do NOT reset the latch here: the panel disarms itself while the
      // request is in flight, so a held gaze cannot fire a second recovery.
      this.requestRespawn()
    } else if (update.activated === "recenter") {
      if (this.headTracking.recenter()) {
        this.gaze.reset()
        // The new head-neutral orientation will apply on the next frame.
        this.showHeadTrackingStatus("recentered")
      }
    }
  }

  showHeadTrackingStatus(status) {
    // The cockpit warning panel only appears for a real sensor failure.
    this.view?.setHelmetTrackingUnavailable(headTrackingUnavailable(status))
    const label = this.root.querySelector("#helmet-tracking-status")
    if (!label) return
    const descriptions = {
      off: "Head tracking disabled; SBS remains available.",
      waiting: "Motion sensor enabled. Move the phone gently to calibrate.",
      tracking: "Head tracking active. Face forward when entering VR.",
      recentered: "Head direction recalibrated.",
      denied: "Motion sensor permission denied; SBS remains available.",
      unsupported: "This browser does not expose orientation sensors.",
      "https-required": "Head tracking needs HTTPS on the phone. SBS still works on HTTP.",
    }
    label.textContent = descriptions[status] || "Head tracking unavailable."
    // The main setup remains barebones; only sensor errors need explaining.
    label.hidden = !["denied", "unsupported", "https-required"].includes(status)
  }

  report(rendering) {
    if (this.channel?.state === "joined") {
      this.channel.push("rendering_status", {rendering: Boolean(rendering)})
    }
  }

  message(value) {
    if (!this.messageNode) return
    this.messageNode.textContent = value || ""
    this.messageNode.hidden = !value
    const setup = this.root.querySelector("#helmet-setup")
    const hint = this.root.querySelector("#helmet-fullscreen-hint")
    if (value && setup && !setup.hidden && hint) {
      hint.textContent = value
      hint.hidden = false
    }
  }
}

export function startHelmetClient() {
  const root = document.getElementById("helmet-client")
  if (root) new HelmetClient(root).start()
}
