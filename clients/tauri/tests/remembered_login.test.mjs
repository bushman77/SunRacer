import test from "node:test"
import assert from "node:assert/strict"
import {rememberedLogin} from "../ui/remembered_login.mjs"

test("remembered login uses only native vault IPC scoped to selected origin", async () => {
  const calls=[]
  const vault=rememberedLogin("https://sunracer.ddns.net", async (command,args)=>{
    calls.push({command,args})
    return args.operation==="read"?"test-credential":null
  })
  assert.equal(await vault.read(),"test-credential")
  await vault.write("test-credential")
  await vault.clear()
  assert.deepEqual(calls.map(c=>c.args.operation),["read","write","clear"])
  assert.ok(calls.every(c=>c.command==="remembered_credential"&&c.args.origin==="https://sunracer.ddns.net"))
  assert.equal(calls[1].args.credential,"test-credential")
  assert.equal(calls[2].args.credential,null)
})
test("no plaintext fallback when OS credential vault is unavailable", async () => {
  const vault=rememberedLogin("http://localhost:4000",null)
  assert.equal(await vault.read(),null)
  await assert.rejects(vault.write("test-credential"),/installed desktop client/)
})
