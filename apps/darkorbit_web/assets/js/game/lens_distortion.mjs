// Optional barrel pre-distortion for phone-in-headset viewing (beta).
//
// Headset lenses magnify the centre less than the edges (pincushion), so
// straight lines bow and the periphery stretches. Rendering each eye into an
// offscreen target and resampling it with the radial polynomial below bends
// the image the opposite way, so the two cancel through the lens.
//
// The pure helpers mirror the shader so they can be regression-tested in
// Node; LensDistortionPass is only constructed in the browser.

// Mild defaults: a starting point for a generic Cardboard-style viewer, not
// a calibrated profile. Override per headset with "k1,k2".
export const DEFAULT_LENS_COEFFICIENTS = Object.freeze({k1: 0.10, k2: 0.05})
const K_LIMIT = 1

export function parseLensCoefficients(text) {
  if (typeof text !== "string") return {...DEFAULT_LENS_COEFFICIENTS}
  const [k1, k2] = text.split(",").map(part => Number(part.trim()))
  if (![k1, k2].every(Number.isFinite) || Math.abs(k1) > K_LIMIT || Math.abs(k2) > K_LIMIT) {
    return {...DEFAULT_LENS_COEFFICIENTS}
  }
  return {k1, k2}
}

// Horizontal lens centre (0..1) inside an eye viewport. A negative calibrated
// gap moves the left image right and the right image left by `shiftNdc`
// (see inwardStereoProjectionOffset); the optical axis moves with it.
export function lensCenterU(eye, shiftNdc = 0) {
  const shift = Number(shiftNdc) || 0
  return eye === "left" ? 0.5 + shift / 2 : 0.5 - shift / 2
}

export const radialScale = (r2, {k1, k2}) => 1 + k1 * r2 + k2 * r2 * r2

// Output pixel (u, v) in the eye viewport -> source uv in the undistorted
// render, or null when it falls outside (drawn black). Radius is normalised
// so the top/bottom edge through the lens centre is r = 1.
export function distortedSampleUv(u, v, centerU, aspect, coefficients) {
  const px = (u - centerU) * aspect * 2
  const py = (v - 0.5) * 2
  const scale = radialScale(px * px + py * py, coefficients)
  const su = centerU + px * scale / (aspect * 2)
  const sv = 0.5 + py * scale / 2
  if (su < 0 || su > 1 || sv < 0 || sv > 1) return null
  return {u: su, v: sv}
}

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAGMENT = `
uniform sampler2D tSource;
uniform float centerU;
uniform float aspect;
uniform float k1;
uniform float k2;
varying vec2 vUv;
void main() {
  vec2 p = vec2((vUv.x - centerU) * aspect * 2.0, (vUv.y - 0.5) * 2.0);
  float r2 = dot(p, p);
  float scale = 1.0 + k1 * r2 + k2 * r2 * r2;
  vec2 uv = vec2(centerU + p.x * scale / (aspect * 2.0), 0.5 + p.y * scale / 2.0);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    gl_FragColor = texture2D(tSource, uv);
  }
  #include <colorspace_fragment>
}
`

export class LensDistortionPass {
  constructor(THREE, coefficients = DEFAULT_LENS_COEFFICIENTS) {
    this.THREE = THREE
    this.target = null
    this.uniforms = {
      tSource: {value: null},
      centerU: {value: 0.5},
      aspect: {value: 1},
      k1: {value: DEFAULT_LENS_COEFFICIENTS.k1},
      k2: {value: DEFAULT_LENS_COEFFICIENTS.k2},
    }
    this.setCoefficients(coefficients)
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      depthTest: false, depthWrite: false,
    })
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.quad.frustumCulled = false
    this.quadScene = new THREE.Scene()
    this.quadScene.add(this.quad)
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  setCoefficients(coefficients) {
    const {k1, k2} = parseLensCoefficients(
      coefficients ? `${coefficients.k1},${coefficients.k2}` : undefined)
    this.uniforms.k1.value = k1
    this.uniforms.k2.value = k2
  }

  ensureTarget(width, height) {
    const T = this.THREE
    if (!this.target) {
      // Half-float avoids banding in the very dark space backdrop; MSAA keeps
      // the antialiasing the on-screen path had.
      this.target = new T.WebGLRenderTarget(width, height, {
        type: T.HalfFloatType, samples: 4,
      })
    } else if (this.target.width !== width || this.target.height !== height) {
      this.target.setSize(width, height)
    }
    return this.target
  }

  // Render one eye offscreen, then resample it into that eye's viewport.
  renderEye(renderer, scene, camera, viewport, dpr, centerU) {
    const width = Math.max(1, Math.round(viewport.width * dpr))
    const height = Math.max(1, Math.round(viewport.height * dpr))
    const target = this.ensureTarget(width, height)
    renderer.setRenderTarget(target)
    renderer.setScissorTest(false)
    renderer.clear(true, true, true)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)

    this.uniforms.tSource.value = target.texture
    this.uniforms.centerU.value = centerU
    this.uniforms.aspect.value = viewport.width / Math.max(1, viewport.height)
    renderer.setScissorTest(true)
    renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height)
    renderer.setScissor(viewport.x, viewport.y, viewport.width, viewport.height)
    renderer.render(this.quadScene, this.quadCamera)
  }

  dispose() {
    this.target?.dispose()
    this.material.dispose()
    this.quad.geometry.dispose()
    this.target = null
  }
}
