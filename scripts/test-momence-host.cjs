const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = vm.createContext({ exports: {} });
vm.runInContext(ts.transpileModule(fs.readFileSync('src/lib/momence-host.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const resolve = context.exports.resolveMomenceHost;
for (const center of ['Kenkere House, Bengaluru', 'the Studio by Copper + Cloves, Indiranagar', 'Bangalore', 'KENKERE HOUSE']) {
  assert.equal(resolve({ center, hostId: '13752' }), '33905', center);
}
for (const center of ['Supreme HQ, Bandra', 'Kwality House, Kemps Corner', 'Mumbai']) {
  assert.equal(resolve({ center, hostId: '33905' }), '13752', center);
}
assert.equal(resolve({ center: 'Pop up', hostId: '33905' }), '33905');
assert.equal(resolve({ center: 'Unassigned', hostId: '' }), '13752');
assert.equal(resolve({ center: 'Unknown', hostId: '../bad-host' }), '13752');
console.log('PASS: regional host IDs override stale values; event fallback and invalid IDs handled.');
