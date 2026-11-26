// Inspect the actual packaged GLB metadata without Blender or a GPU.
// Usage: node clients/tauri/scripts/audit-station-textures.mjs
import {readFileSync, readdirSync} from "node:fs"
import {fileURLToPath} from "node:url"
import path from "node:path"
const dir = fileURLToPath(new URL("../../../apps/sunracer_web/priv/static/images/game/station/", import.meta.url))
let failures = 0
for (const name of readdirSync(dir).filter(n => n.endsWith(".glb"))) {
  try {
    const bytes = readFileSync(path.join(dir, name))
    if (bytes.length < 20 || bytes.toString("ascii",0,4) !== "glTF" ||
        bytes.readUInt32LE(4) !== 2 || bytes.toString("ascii",16,20) !== "JSON")
      throw Error("invalid GLB header")
    const length = bytes.readUInt32LE(12)
    if (20 + length > bytes.length) throw Error("invalid GLB JSON chunk")
    const doc = JSON.parse(bytes.toString("utf8",20,20+length))
    const primitives = (doc.meshes || []).flatMap(mesh => mesh.primitives || [])
    const mapped = primitives.filter(p => {
      const map = doc.materials?.[p.material]?.pbrMetallicRoughness?.baseColorTexture
      const texture = doc.textures?.[map?.index]
      const image = doc.images?.[texture?.source]
      const uv = "TEXCOORD_" + (map?.texCoord ?? 0)
      return p.attributes?.[uv] != null && image &&
        (image.bufferView != null || image.uri?.startsWith("data:"))
    }).length
    const colored = primitives.filter(p => p.attributes?.COLOR_0 != null).length
    const images = (doc.images || []).filter(i=>i.bufferView != null || i.uri?.startsWith("data:")).length
    console.log(name + ": " + mapped + "/" + primitives.length + " primitives with embedded base-color textures; " +
      images + " embedded images; " + colored + " vertex-colored primitives")
    if (!mapped && !colored) {
      console.error("  No embedded base-color texture or vertex colors detected; inspect the export.")
      failures++
    }
  } catch (error) {
    console.error(name + ": " + error.message)
    failures++
  }
}
if (failures) process.exitCode = 1
