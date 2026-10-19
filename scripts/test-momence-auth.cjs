const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lead-galaxy-auth-'));
  try {
    const source = await fs.readFile('src/lib/momence-auth.ts', 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const env = { MOMENCE_EMAIL: 'test@example.com', MOMENCE_PASSWORD: 'test-password', MOMENCE_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', MOMENCE_ALL_COOKIES: 'session=expired' };
    let calls = []; let mode = 'success';
    const mockFetch = async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/auth/login')) {
        if (mode === 'fail') return new Response('', { status: 401 });
        return new Response('{}', { headers: { 'set-cookie': 'pre=login; Path=/; HttpOnly' } });
      }
      if (url.endsWith('/auth/mfa/totp/verify')) {
        assert.match(JSON.parse(init.body).token, /^\d{6}$/);
        assert.equal(init.headers.cookie, 'pre=login');
        return new Response('{}', { headers: { 'set-cookie': 'session=renewed; Path=/; HttpOnly' } });
      }
      if (mode === 'server-error') return new Response('', { status: 500 });
      return new Response('{}', { status: init.headers.get('cookie').includes('session=renewed') ? 200 : 401 });
    };
    const context = vm.createContext({ exports: {}, require, process: { env, cwd: () => dir }, Buffer, Headers, Response, URL, AbortSignal, fetch: mockFetch });
    vm.runInContext(code, context);
    const api = context.exports;
    assert.equal(api.generateTotp(env.MOMENCE_TOTP_SECRET, 59000), '287082', 'RFC 6238 vector');
    const headers = new Headers(); headers.append('set-cookie', 'session=new; Path=/'); headers.append('set-cookie', 'old=; Max-Age=0');
    assert.equal(api.mergeCookies('session=old; old=yes; other=keep', headers), 'session=new; other=keep');
    await fs.writeFile(path.join(dir, '.env.local'), '# keep comments\nOTHER="keep"\nMOMENCE_ALL_COOKIES="expired"\nMOMENCE_ALL_COOKIES="duplicate"\n');
    const url = 'https://momence.com/_api/primary/host/13752/customer-leads';
    const responses = await Promise.all([api.momenceFetch(url), api.momenceFetch(url)]);
    assert.ok(responses.every((r) => r.status === 200));
    assert.equal(calls.filter((c) => c.url.endsWith('/auth/login')).length, 1, 'concurrent renewal shared');
    assert.equal(calls.filter((c) => c.url.endsWith('/auth/mfa/totp/verify')).length, 1);
    const saved = await fs.readFile(path.join(dir, '.env.local'), 'utf8');
    assert.match(saved, /# keep comments\nOTHER="keep"/);
    assert.equal(saved.match(/MOMENCE_ALL_COOKIES=/g).length, 1);
    assert.match(saved, /session=renewed/);
    assert.equal((await fs.stat(path.join(dir, '.env.local'))).mode & 0o777, 0o600);
    mode = 'server-error'; calls = [];
    assert.equal((await api.momenceFetch(url)).status, 500); assert.equal(calls.length, 1);
    await assert.rejects(api.momenceFetch('https://example.com/_api/'), /Invalid Momence/);
    env.MOMENCE_ALL_COOKIES = ''; mode = 'fail'; calls = [];
    await assert.rejects(api.momenceFetch(url), /renewal failed/);
    await assert.rejects(api.momenceFetch(url), /Retry after one minute/);
    assert.equal(calls.length, 1, 'failed auth has cooldown');
    console.log('PASS: TOTP, cookie merge, one retry, concurrent renewal, atomic env persistence, permissions, non-auth failures, destination restriction, auth cooldown.');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
