const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)((name) => name.startsWith('.') ? load(path.resolve(path.dirname(file), `${name}.ts`)) : require(name), module, module.exports);
  return module.exports;
}
(async () => {
  const { isEligibleConversionSale: eligible, firstConversionSale: first } = load('src/lib/conversion.ts');
  const base = { memberId: 'm1', date: '2026-10-10', value: 100, paymentStatus: 'succeeded', voided: false, category: 'Memberships', product: 'Monthly', paymentItem: 'Studio Monthly', membershipName: '' };
  assert.equal(eligible(base), true);
  for (const field of ['product', 'paymentItem', 'membershipName']) {
    for (const excluded of ['Newcomers 2 For 1', '2-for-1 package', 'Intro Pack', 'INTRO-PACK', 'Copper & Cloves Single Class Package', 'Copper + Cloves Single Class Package', 'Copper + Cloves Credit', 'Copper & Cloves Credit']) {
      assert.equal(eligible({ ...base, [field]: excluded }), false, `${field}: ${excluded}`);
    }
  }
  for (const category of ['Retail', 'Retail - Apparel', 'Money Credits', 'money-credit']) assert.equal(eligible({ ...base, category }), false);
  for (const patch of [{ paymentStatus: 'pending' }, { paymentStatus: 'failed' }, { voided: true }, { value: 0 }, { value: -1 }, { date: null }, { date: '2026-02-31' }, { memberId: '' }]) assert.equal(eligible({ ...base, ...patch }), false);
  const sales = ['2026-10-12', '2026-10-09', '2026-10-10', '2026-10-11'].map((date) => ({memberId:'m1',date,value:100}));
  assert.equal(first('m1', '2026-10-10', sales).date, '2026-10-10');
  assert.equal(first('m2', '2026-10-10', sales), null);
  assert.equal(first('', '2026-10-10', sales), null);
  assert.equal(first('m1', null, sales), null);
  assert.equal(first('m1', '2026-10-12', sales).date, '2026-10-12');

  const { normalise, enrichWithCrossSheet } = load('src/lib/sheet.ts');
  const leads = normalise([
    ['ID', 'Member ID', 'Created At', 'Converted To Customer At', 'Conversion Status', 'Email', 'Stage Name'],
    ['lead1', 'm1', '2026-10-10', '2026-10-10', 'Not Converted', 'shared@example.com', ' Membership  SOLD '],
    ['lead2', 'm2', '2026-10-10', '2026-10-10', 'Converted', 'shared@example.com'],
    ['lead3', '', '2026-10-10', '2026-10-10', 'Won', 'shared@example.com'],
    ['lead4', 'm1', '2026-10-13', '2026-10-12', 'Converted', 'shared@example.com', 'Trial Scheduled'],
  ]).leads;
  assert.ok(leads.every((l) => !l.converted && l.convertedAt === null && l.conversionStatus === 'Unverified'));
  const header = ['Member ID','Customer Email','Payment Value','Payment Status','Payment Date','Calculated Location','Sec. Is Voided','Payment Item','Cleaned Product','Cleaned Category','Sec. Membership Name'];
  const row = (date, product, category = 'Memberships') => ['m1','shared@example.com','100','succeeded',date,'Bandra','FALSE',product,product,category,'-'];
  const csv = [header, row('2026-10-09','Monthly'),row('2026-10-10','Monthly'),row('2026-10-11','2 For 1'),row('2026-10-11','Copper + Cloves Credit'),row('2026-10-11','Socks','Retail'),row('2026-10-11','Monthly'),row('2026-10-12','Monthly')].map((r)=>r.join(',')).join('\n');
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => new Response(csv);
    const salesMap = await load('src/lib/crossSheet.ts').fetchSalesAggs();
    assert.equal(salesMap.get('m1').purchases, 7, 'LTV/purchase totals retain existing scope');
    assert.equal(salesMap.get('m1').conversionSales.length, 4, 'only eligible sale evidence retained');
    enrichWithCrossSheet(leads, salesMap, new Map());
    assert.equal(leads[0].converted, true); assert.equal(leads[0].conversionStatus, 'Converted');
    assert.equal(leads[0].convertedAt, '2026-10-10'); assert.equal(leads[0].daysToConversion, 0);
    assert.equal(leads[0].won, true); assert.equal(leads[0].status, 'Won');
    const checkins = new Map([['m1',{memberId:'m1',checkedInDates:['2026-10-09','2026-10-11'],visits:2,firstVisit:'2026-10-09',lastVisit:'2026-10-11',trialVisits:0}]]);
    enrichWithCrossSheet(leads,salesMap,checkins);
    assert.equal(leads[0].tried,true); assert.equal(leads[0].trialCompletedAt,'2026-10-11');
    checkins.get('m1').checkedInDates.push('2026-10-10');
    enrichWithCrossSheet(leads,salesMap,checkins);
    assert.equal(leads[0].trialCompletedAt,'2026-10-10','Same-day checked-in visits count');
    assert.ok(leads.slice(1).every((lead)=>!lead.tried), 'Trial requires same Member ID and post-creation attendance');
    enrichWithCrossSheet(leads,salesMap,new Map(),false);
    assert.equal(leads[0].trialStatus,'Unverified');
    assert.equal(leads[0].converted,true, 'Check-ins outage does not suppress Sales conversion');
    assert.ok(leads.slice(1).every((l) => !l.converted && l.convertedAt === null && l.conversionStatus === 'Not Converted'), 'No email/source-label fallbacks');
    global.fetch = async () => new Response('Member ID,Email,Checked In,Date (IST)\nm1,shared@example.com,FALSE,2026-10-12\nm1,shared@example.com,TRUE,2026-10-09\nm1,shared@example.com,TRUE,2026-10-11');
    const attendance = await load('src/lib/crossSheet.ts').fetchCheckinAggs();
    assert.deepEqual(attendance.get('m1').checkedInDates,['2026-10-09','2026-10-11']);
    enrichWithCrossSheet(leads,salesMap,attendance);
    assert.equal(leads[0].trialCompletedAt,'2026-10-11');
    global.fetch = async () => new Response('unexpected,headers\n1,2');
    await assert.rejects(load('src/lib/crossSheet.ts').fetchSalesAggs(), /schema changed/);
    global.fetch = async () => { throw new Error('transport failed'); };
    await assert.rejects(load('src/lib/crossSheet.ts').fetchSalesAggs(), /unavailable/);
  } finally { global.fetch = originalFetch; }
  console.log('PASS: exclusions, exact Member ID, same-day sales, post-creation attendance, earliest eligible sale, source-label/email rejection, normalized flags/status/dates, unchanged purchase/LTV scope.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
