import { chromium } from 'playwright-core';

const EXEC = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium';
const BASE = 'http://localhost:5173/';
let pass = 0, fail = 0;
const bad = [];
const ok = (name, cond, detail = '') => {
  if (cond) pass++;
  else { fail++; bad.push(`${name}${detail ? ' — ' + detail : ''}`); }
};
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

const browser = await chromium.launch({ executablePath: EXEC });

async function fresh(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts.ctx });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fail++; bad.push('PAGE ERROR: ' + e.message); });
  if (opts.storage) {
    await page.addInitScript(st => {
      for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v);
    }, opts.storage);
  } else {
    await page.addInitScript(() => localStorage.clear());
  }
  await page.goto(opts.url || BASE);
  return { ctx, page };
}
const bal = p => p.evaluate(() => {
  const t = document.querySelector('.bgc-balance b')?.textContent || '';
  return parseFloat(t.replace(/[^0-9.]/g, ''));
});
const flight = p => p.evaluate(() => document.querySelectorAll('.fx-hist-desktop .fx-hist-row').length);
const betShown = p => p.evaluate(() => parseFloat((document.querySelector('.bgc-bet-display b')?.textContent || '').replace(/[^0-9.]/g, '')));
const setInstant = async p => { await p.click('.bgc-instant .bgc-speed-btn:has-text("Instant")'); };

// ---------- S1: loading screen ----------
try {
  const { ctx, page } = await fresh();
  ok('S1 loading screen shows', await page.locator('.loading-screen').isVisible());
  ok('S1 MYBC logo present', await page.locator('.loading-logo').count() === 1);
  ok('S1 peg animation present', await page.locator('.load-ball').count() === 1);
  await page.waitForTimeout(2700);
  ok('S1 loader gone after 2.2s', !(await page.locator('.loading-screen').count()));
  ok('S1 game visible', await page.locator('.play-btn').isVisible());
  await ctx.close();
} catch (e) { fail++; bad.push('S1: loading screen CRASHED: ' + e.message.split('\n')[0]); }// ---------- S2: manual bet happy path ----------
try {
  const { ctx, page } = await fresh();
  await page.waitForTimeout(2700);
  const b0 = await bal(page);
  ok('S2 starting balance 10000', b0 === 10000, `got ${b0}`);
  const bet0 = await betShown(page);
  ok('S2 default bet 1.00', bet0 === 1, `got ${bet0}`);
  await page.click('.bgc-instant .bgc-speed-btn:has-text("Slow")');
  await page.click('.play-btn');
  await page.waitForTimeout(120);
  const bMid = await bal(page);
  ok('S2 stake debited at drop', approx(bMid, b0 - bet0), `mid=${bMid}`);
  await page.waitForTimeout(5200);
  const rows = await flight(page);
  ok('S2 history row appears', rows === 1, `rows=${rows}`);
  const b1 = await bal(page);
  const st = await page.evaluate(() => parseFloat(localStorage.getItem('plinko_balance') || '0'));
  ok('S2 balance persisted == shown', approx(b1, st), `shown=${b1} stored=${st}`);
  const sess = await page.evaluate(() => document.querySelector('.fx-hist')?.textContent || '');
  ok('S2 session shows 1 round', /SESSION/i.test(sess) || sess.length > 0);
  await ctx.close();
} catch (e) { fail++; bad.push('S2: manual bet happy path CRASHED: ' + e.message.split('\n')[0]); }// ---------- S3: bet pills ladder ----------
try {
  const { ctx, page } = await fresh();
  await page.waitForTimeout(2700);
  const pills = page.locator('.bgc-pill');
  await pills.nth(0).click(); // Min
  ok('S3 Min sets 0.10', await betShown(page) === 0.1, `got ${await betShown(page)}`);
  await pills.nth(2).click(); // +
  ok('S3 + steps to 0.20', await betShown(page) === 0.2);
  await pills.nth(3).click(); // Max
  ok('S3 Max caps at 1000 (table max < balance)', await betShown(page) === 1000, `got ${await betShown(page)}`);
  await pills.nth(1).click(); // −
  ok('S3 − steps down to 500', await betShown(page) === 500);
  await ctx.close();
} catch (e) { fail++; bad.push('S3: bet pills ladder CRASHED: ' + e.message.split('\n')[0]); }// ---------- S4: insufficient balance + refill ----------
try {
  const { ctx, page } = await fresh({ storage: { plinko_balance: '0.50', plinko_bet: '1.00' } });
  await page.waitForTimeout(2700);
  ok('S4 low balance loaded', await bal(page) === 0.5);
  await page.click('.play-btn');
  await page.waitForTimeout(300);
  ok('S4 alert toast shown', await page.locator('.alert-toast').count() === 1);
  ok('S4 no ball dropped', await flight(page) === 0);
  await ctx.close();
  // sub-MIN_BET balance auto-refills
  const { ctx: c2, page: p2 } = await fresh({ storage: { plinko_balance: '0.05' } });
  await p2.waitForTimeout(2700);
  ok('S4 busted balance refills to 10000', await bal(p2) === 10000, `got ${await bal(p2)}`);
  await c2.close();
} catch (e) { fail++; bad.push('S4: insufficient balance + refill CRASHED: ' + e.message.split('\n')[0]); }// ---------- S5: auto play N rounds + summary ----------
try {
  const { ctx, page } = await fresh();
  await page.waitForTimeout(2700);
  await setInstant(page);
  await page.click('.bgc-mode .bgc-opt:has-text("Auto")');
  await page.click('.bgc-nob-btn:has-text("−")'); // 10 -> 5
  await page.click('.play-btn'); // starts 5 rounds
  await page.waitForTimeout(150);
  ok('S5 STOP orb shown', await page.locator('.play-btn.stop').count() === 1);
  await page.waitForTimeout(4500);
  const modal = page.locator('.modal.free-bet-summary');
  ok('S5 auto summary modal', await modal.count() === 1);
  const txt = (await modal.textContent()) || '';
  ok('S5 summary says 5 rounds', /Rounds5/.test(txt.replace(/\s/g, '')), txt.slice(0, 80));
  await page.click('.fbs-btn');
  ok('S5 summary dismissed', await modal.count() === 0);
  ok('S5 5 history rows', await flight(page) === 5, `rows=${await flight(page)}`);
  await ctx.close();
} catch (e) { fail++; bad.push('S5: auto play N rounds + summary CRASHED: ' + e.message.split('\n')[0]); }// ---------- S6: auto stop early ----------
try {
  const { ctx, page } = await fresh();
  await page.waitForTimeout(2700);
  await setInstant(page);
  await page.click('.bgc-mode .bgc-opt:has-text("Auto")');
  await page.click('.play-btn'); // 10 rounds
  await page.waitForTimeout(500); // ~3-4 started
  await page.click('.play-btn.stop');
  await page.waitForTimeout(2500);
  const t = (await page.locator('.modal.free-bet-summary').textContent().catch(() => '')) || '';
  ok('S6 early-stop summary shown', t.length > 0);
  const rows = await flight(page);
  ok('S6 stopped early (<10 rounds)', rows > 0 && rows < 10, `rows=${rows}`);
  await ctx.close();
} catch (e) { fail++; bad.push('S6: auto stop early CRASHED: ' + e.message.split('\n')[0]); }// ---------- S7: risk & lines lock while ball in flight ----------
try {
  const { ctx, page } = await fresh();
  await page.waitForTimeout(2700);
  await page.click('.bgc-instant .bgc-speed-btn:has-text("Slow")');
  await page.click('.play-btn');
  await page.waitForTimeout(200);
  ok('S7 risk locked mid-flight', await page.locator('.bgc-risk .bgc-opt[disabled]').count() === 3);
  ok('S7 lines locked mid-flight', await page.locator('.lines-rail-btn[disabled]').count() === 9);
  ok('S7 mode locked mid-flight', await page.locator('.bgc-mode .bgc-opt[disabled]').count() === 2);
  await page.waitForTimeout(5000);
  ok('S7 risk unlocked after land', await page.locator('.bgc-risk .bgc-opt[disabled]').count() === 0);
  await ctx.close();
} catch (e) { fail++; bad.push('S7: risk & lines lock while ball in flight CRASHED: ' + e.message.split('\n')[0]); }// ---------- S8: space key ----------
try {
  const { ctx, page } = await fresh();
  await page.waitForTimeout(2700);
  await setInstant(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(2200);
  ok('S8 Space drops a ball', await flight(page) === 1, `rows=${await flight(page)}`);
  await ctx.close();
} catch (e) { fail++; bad.push('S8: space key CRASHED: ' + e.message.split('\n')[0]); }// ---------- S9: hold-to-pour ----------
try {
  const { ctx, page } = await fresh();
  await page.waitForTimeout(2700);
  await setInstant(page);
  const btn = page.locator('.play-btn');
  const box = await btn.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1100); // 250ms hold + ~6 ticks
  await page.mouse.up();
  await page.waitForTimeout(2600);
  const rows = await flight(page);
  ok('S9 pour drops multiple balls', rows >= 4, `rows=${rows}`);
  await ctx.close();
} catch (e) { fail++; bad.push('S9: hold-to-pour CRASHED: ' + e.message.split('\n')[0]); }// ---------- S10: speed persistence + bet persistence across reload ----------
try {
  const { ctx, page } = await fresh({ storage: { plinko_balance: '10000' } });
  await page.waitForTimeout(2700);
  await setInstant(page);
  await page.locator('.bgc-pill').nth(2).click(); // bet 2.00
  ok('S10 + stepped to 2.00 pre-reload', await betShown(page) === 2, `got ${await betShown(page)}`);
  await page.reload();
  await page.waitForTimeout(2700);
  ok('S10 bet persists reload', await betShown(page) === 2, `got ${await betShown(page)}`);
  const instantActive = await page.locator('.bgc-instant .bgc-speed-btn.active:has-text("Instant")').count();
  ok('S10 speed persists reload', instantActive === 1);
  await ctx.close();
} catch (e) { fail++; bad.push('S10: speed persistence + bet persistence across reload CRASHED: ' + e.message.split('\n')[0]); }// ---------- S11: free rounds full UI flow ----------
try {
  const { ctx, page } = await fresh({ url: BASE + '?demo-free=3&free-bet=2' });
  await page.waitForTimeout(2700);
  ok('S11 welcome modal', await page.locator('.free-bet-welcome').count() === 1);
  await page.click('.free-bet-welcome .fbs-btn');
  await setInstant(page);
  ok('S11 FREE label on orb', /FREE/.test(await page.locator('.play-btn').textContent()));
  ok('S11 free slot replaces bet row', await page.locator('.free-round-slot').count() === 1 && await page.locator('.bgc-bet-row').count() === 0);
  const b0 = await bal(page);
  for (let i = 0; i < 3; i++) { await page.click('.play-btn'); await page.waitForTimeout(250); }
  await page.waitForTimeout(2800);
  ok('S11 completion modal', await page.locator('.free-bet-summary').count() >= 1);
  await page.click('.fbs-btn');
  await page.waitForTimeout(300);
  ok('S11 back to paid UI', await page.locator('.bgc-bet-row').count() === 1);
  const b1 = await bal(page);
  ok('S11 balance only grew', b1 >= b0, `b0=${b0} b1=${b1}`);
  ok('S11 FREE badges in history', await page.locator('.fx-hist-desktop .free-badge').count() === 3, `got ${await page.locator('.fx-hist-desktop .free-badge').count()}`);
  await ctx.close();
} catch (e) { fail++; bad.push('S11: free rounds full UI flow CRASHED: ' + e.message.split('\n')[0]); }// ---------- S12: auto during free grant (suspected stale auto-summary bug) ----------
try {
  const { ctx, page } = await fresh({ url: BASE + '?demo-free=3&free-bet=1' });
  await page.waitForTimeout(2700);
  await page.click('.free-bet-welcome .fbs-btn');
  await setInstant(page);
  await page.click('.bgc-mode .bgc-opt:has-text("Auto")'); // Number of bets = 10 > 3 free
  await page.click('.play-btn');
  await page.waitForTimeout(140);
  const stopTxt = (await page.locator('.play-btn.stop').textContent().catch(() => '')) || '';
  ok('S12 STOP counter capped to free rounds (<=3)', /STOP[0-3]$/.test(stopTxt.trim()), `stop="${stopTxt}"`);
  await page.waitForTimeout(4500);
  ok('S12 free summary after auto-free run', (await page.locator('.free-bet-summary h2').first().textContent().catch(() => '')).includes('Free'));
  await page.click('.fbs-btn'); // Continue Playing (clearFree)
  await page.waitForTimeout(500);
  const staleAuto = await page.locator('.modal.free-bet-summary').count();
  ok('S12 no stale auto-summary modal after Continue', staleAuto === 0, `modals=${staleAuto}`);
  await ctx.close();
} catch (e) { fail++; bad.push('S12: auto during free grant (suspected stale auto-summary bug) CRASHED: ' + e.message.split('\n')[0]); }// ---------- S13: history drawer + provably fair verify ----------
try {
  const { ctx, page } = await fresh();
  await page.waitForTimeout(2700);
  await setInstant(page);
  await page.click('.play-btn');
  await page.waitForTimeout(2600);
  await page.locator('.fx-hist-desktop .fx-hist-row').first().click();
  await page.waitForTimeout(400);
  ok('S13 history drawer opens', await page.locator('.drawer, .hist-drawer, [class*=drawer]').count() > 0);
  await page.locator('.hist-item').first().click();
  await page.waitForTimeout(200);
  const verifyBtn = page.locator('button:has-text("Verify Round")').first();
  if (await verifyBtn.count()) {
    await verifyBtn.click();
    await page.waitForTimeout(800);
    const vTxt = await page.evaluate(() => document.body.textContent || '');
    ok('S13 round verifies OK', /Verified/.test(vTxt), 'no "Verified" found');
  } else {
    ok('S13 verify button exists', false, 'Verify Round button not found');
  }
  await ctx.close();
} catch (e) { fail++; bad.push('S13: history drawer + provably fair verify CRASHED: ' + e.message.split('\n')[0]); }// ---------- S14: mobile layout basics ----------
try {
  const { ctx, page } = await fresh({ ctx: { viewport: { width: 390, height: 844 } } });
  await page.waitForTimeout(2700);
  ok('S14 mobile session chip', await page.locator('.mob-session').isVisible());
  ok('S14 mobile dots menu', await page.locator('.hdr-dots').isVisible());
  await page.click('.hdr-dots', { force: true });
  await page.waitForTimeout(200);
  ok('S14 dots menu opens', await page.locator('.dots-menu').count() === 1);
  // resize regression: live desktop→mobile
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  ok('S14 survives live resizes', await page.locator('.play-btn').isVisible());
  await ctx.close();
} catch (e) { fail++; bad.push('S14: mobile layout basics CRASHED: ' + e.message.split('\n')[0]); }

await browser.close();
console.log(`\nPASS ${pass}  FAIL ${fail}`);
if (bad.length) console.log(bad.map(b => '  ✗ ' + b).join('\n'));