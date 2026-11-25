// entries/axstack-load-probe.mjs
import { lstat, readFile } from "node:fs/promises";

// binding.mjs
function bindingMatches(expected, actual) {
  return typeof expected === "string" && /^[a-f0-9]{64}$/.test(expected) && expected === actual;
}

// entries/axstack-load-probe.mjs
var name = "axstack-load-probe";
var version = 1;
var workflow = name + "@" + version;
async function verifyBinding() {
  try {
    const manifest = JSON.parse(await readFile(new URL("../.axstack-workflows.json", import.meta.url), "utf8"));
    const record = manifest.workflows[workflow];
    const info = await lstat(record.binding);
    if (!info.isFile() || info.mode & 63 || info.uid !== process.getuid())
      throw new Error;
    const bytes = await readFile(record.binding);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (bindingMatches(record.bindingDigest, digest))
      return { workflow, binding: "pass" };
  } catch {}
  throw new Error("Axstack workflow binding is missing, non-private, or its digest changed");
}
var result = Schema.Struct({ workflow: Schema.Literal(workflow), binding: Schema.Literal("pass") });
var axstack_load_probe_default = T3.workflow(name, {
  version,
  payload: Schema.Null,
  returns: result,
  resumeAfter: []
}, () => T3.step("verify-binding", { returns: result }, Effect.tryPromise({
  try: verifyBinding,
  catch: () => new Error("Axstack workflow binding verification failed")
})));
export {
  axstack_load_probe_default as default
};
