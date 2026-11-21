// Holds at most one pending animation-frame request.
//
// A frame queued before the page is hidden is not dropped: the browser runs
// it when the page becomes visible again. If a new loop is started on
// visibility without cancelling it, both loops keep running and every
// sleep/wake cycle adds another full render per vsync.
export class FrameScheduler {
  constructor({request, cancel} = {}) {
    this.requestFn = request || (cb => requestAnimationFrame(cb))
    this.cancelFn = cancel || (id => cancelAnimationFrame(id))
    this.id = null
  }

  get pending() { return this.id !== null }

  request(callback) {
    this.cancel()
    const id = this.requestFn(time => {
      if (this.id !== id) return
      this.id = null
      callback(time)
    })
    this.id = id
    return id
  }

  cancel() {
    if (this.id !== null) this.cancelFn(this.id)
    this.id = null
  }
}
