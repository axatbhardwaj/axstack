// Build trusted assets once at module load, without writing an image or a file.
// The synchronous planner can then record the exact executable bytes in argv.
const build = await Bun.build({ entrypoints: [`${import.meta.dir}/proxy.js`], target: 'bun' });
if (!build.success || build.outputs.length !== 1) throw Error('Trusted proxy bundle failed');
const source = await build.outputs[0].text();
export function proxyArgv() { return ['bun', '--eval', source]; }
