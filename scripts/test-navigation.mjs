import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/js/navigation-hotfix-20260726.js', import.meta.url), 'utf8');
function browser({ hash = '', saved = null, blocked = false } = {}) {
  const events = {}, documentEvents = {}, frames = [], scrolls = [];
  const anchor = { id: 'section', getClientRects: () => [1], getBoundingClientRect: () => ({ top: 500 - context.scrollY, bottom: 900 - context.scrollY }) };
  const context = {
    history: { scrollRestoration: 'auto' }, location: { hash, pathname: '/en/', href: 'https://example.com/en/', origin: 'https://example.com' },
    scrollY: 900, innerHeight: 844, Date, URL, Promise, setTimeout: fn => { fn(); },
    CSS: { escape: x => x }, requestAnimationFrame: fn => frames.push(fn),
    sessionStorage: { getItem: () => { if (blocked) throw Error('blocked'); return JSON.stringify(saved); }, removeItem() {} },
    document: {
      fonts: { ready: Promise.resolve() },
      querySelector: selector => selector === '#site-header' ? { offsetHeight: 68 } : null,
      querySelectorAll: selector => selector.startsWith('main [id]') ? [anchor] : [],
      getElementById: id => id === 'section' ? anchor : null,
      addEventListener: (name, fn) => { (documentEvents[name] ||= []).push(fn); }
    },
    addEventListener: (name, fn) => { events[name] = fn; }, removeEventListener() {},
    scrollTo: options => { scrolls.push(options); context.scrollY = options.top; }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return { context, events, documentEvents, frames, scrolls, async show(persisted = false) {
    events.pageshow({ persisted });
    await new Promise(resolve => setImmediate(resolve));
    while (frames.length) frames.shift()();
  } };
}

test('ordinary documents start at zero with instant scrolling despite smooth CSS', async () => {
  const page = browser(); await page.show();
  assert.equal(page.context.history.scrollRestoration, 'manual');
  assert.equal(page.context.scrollY, 0);
  assert.ok(page.scrolls.every(x => x.behavior === 'instant'));
  page.context.scrollY = 300;
  await page.show();
  assert.equal(page.context.scrollY, 300, 'the same pageshow must not reset a second time');
  await page.show(true);
  assert.equal(page.context.scrollY, 0, 'a back/forward document also opens at its beginning');
});
test('explicit destinations remain below the sticky header', async () => {
  const page = browser({ hash: '#section' }); await page.show();
  assert.equal(page.context.scrollY, 416);
});
test('language handoff restores the semantic anchor once and rejects stale or unrelated state', async () => {
  const saved = { target: '/en/', time: Date.now(), position: { id: 'section', offset: 23, top: 100 }, tabs: [], details: [] };
  const page = browser({ saved }); await page.show();
  assert.equal(page.context.scrollY, 393);
  for (const state of [{ ...saved, target: '/ar/' }, { ...saved, time: Date.now() - 60000 }]) {
    const other = browser({ saved: state }); await other.show(); assert.equal(other.context.scrollY, 0);
  }
});
test('disabled session storage does not break ordinary navigation', async () => {
  const page = browser({ blocked: true }); await page.show(); assert.equal(page.context.scrollY, 0);
});
test('a shrinking accordion keeps its clicked control at the same viewport position', () => {
  const page = browser(); let top = 300;
  const control = { isConnected: true, id: 'question', closest: () => null, matches: () => false,
    getClientRects: () => [1], getBoundingClientRect: () => ({ top }) };
  const event = { target: { closest: () => control }, defaultPrevented: false };
  page.context.scrollY = 500;
  page.documentEvents.click.at(-1)(event);
  top = 180;
  page.frames.shift()();
  assert.equal(page.context.scrollY, 380);
});

test('incomplete or future language records cannot break ordinary page entry', async () => {
  for (const saved of [
    {target:'/en/',time:Date.now()},
    {target:'/en/',time:Date.now()+60000,position:{top:100,offset:0}},
    {target:'/en/',time:Date.now(),position:{top:'100',offset:0}}
  ]) {
    const page=browser({saved}); await page.show(); assert.equal(page.context.scrollY,0);
  }
});
test('an obsolete language selector falls back to the matching section', async () => {
  const page=browser({saved:{target:'/en/',time:Date.now(),position:{selector:'obsolete',id:'section',offset:23,top:100},tabs:[],details:[]}});
  await page.show(); assert.equal(page.context.scrollY,393);
});

test('a language change from the page top stays at the top even when an anchor resolves', async () => {
  const page = browser({ saved: { target: '/en/', time: Date.now(), position: { id: 'section', top: 0, offset: 40 } } });
  await page.show();
  assert.equal(page.context.scrollY, 0);
});

test('language handoff preserves reading progress through rewrapped content', async () => {
  const page = browser({ saved: { target: '/en/', time: Date.now(), position: { id: 'section', top: 120, offset: -30, progress: 0.25 } } });
  // The equivalent block is 400px tall on this page.
  page.context.document.getElementById('section').getBoundingClientRect = () => ({
    top: 500 - page.context.scrollY, bottom: 900 - page.context.scrollY, height: 400
  });
  await page.show();
  assert.equal(page.context.scrollY, 516);
});

test('back-forward and same-document fragment navigation use the sticky-header offset', async () => {
  const page = browser({ hash: '#section' });
  await page.show(true);
  assert.equal(page.context.scrollY, 416);
  page.context.scrollY = 700;
  page.events.hashchange();
  assert.equal(page.context.scrollY, 416);
});
