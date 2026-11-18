import test from 'node:test';
import assert from 'node:assert/strict';
import sample from '../content/calendar.example.json' with { type:'json' };
import { createHandler } from '../src/server.mjs';
import { unlockAt } from '../src/calendar.mjs';
import { session } from '../src/auth.mjs';
import vercel from '../api/calendar.js';

const url = 'https://example.test';
const request = (path, options) => new Request(url + path, options);
const midnight = day => Date.UTC(2026, 10, 30 + day - 1, 23);
const env = {
  CALENDAR_MODE:'private', ACCESS_CODE:'fictional-code-for-test',
  SESSION_SECRET:'fictional-session-secret-for-tests-only', BLOB_READ_WRITE_TOKEN:'fixture'
};

test('las 24 puertas respetan la medianoche romana y siguen abiertas después', async () => {
  let now = 0;
  const handle = createHandler({clock:() => now, env:{}});
  for (const {day, title} of sample.days) {
    assert.equal(unlockAt(sample, day), midnight(day));
    now = midnight(day) - 1;
    assert.match(await (await handle(request('/contenido/' + day))).text(), /Esta puerta se abre el/);
    now++;
    const html = await (await handle(request('/contenido/' + day))).text();
    assert.ok(html.includes(title));
    assert.match(html, /\/demo\/invierno\.svg/);
  }
  assert.match(await (await handle(request('/calendario'))).text(), /Ya puedes abrir las 24 puertas/);
  assert.match(await (await handle(request('/contenido/24'))).text(), /Feliz Navidad/);
  assert.match(await (await handle(request('/contenido/1'))).text(), /Ya estamos en diciembre/);
  assert.equal(unlockAt({...sample,timezone:'Pacific/Kiritimati'}, 1), Date.UTC(2026, 10, 30, 10));
});

test('autorización, cookies, mensajes y fotos privadas', async () => {
  let now = midnight(1);
  let calls = 0;
  const calendar = structuredClone(sample);
  calendar.days[0].message = '<script>texto ficticio</script>';
  calendar.days[0].photo = 'calendar/photos/' + 'a'.repeat(64) + '/1.webp';
  const handle = createHandler({clock:() => now, env, blob:async key => {
    calls++;
    return {statusCode:200, stream:new Response(key.endsWith('.webp') ? 'fixture' : JSON.stringify(calendar)).body};
  }});
  assert.equal((await handle(request('/calendario'))).headers.get('location'), '/');
  for (const path of ['/contenido/1','/foto/1']) {
    assert.equal((await handle(request(path))).status, 401);
  }
  assert.equal(calls, 0);
  const login = options => request('/acceso', {
    method:'POST', headers:{origin:url, 'x-vercel-forwarded-for':'192.0.2.10', ...options},
    body:new URLSearchParams({code:env.ACCESS_CODE})
  });
  assert.equal((await handle(login({origin:'https://other.test'}))).status, 403);
  const response = await handle(login());
  assert.equal(response.status, 303);
  const value = response.headers.get('set-cookie');
  assert.match(value, /__Host-advent=.*HttpOnly.*SameSite=Strict.*Secure/);
  const headers = {cookie:value.split(';')[0]};
  const authorized = path => handle(request(path, {headers}));
  assert.equal((await authorized('/foto/2')).status, 404);
  assert.match(await (await authorized('/contenido/2')).text(), /Esta puerta se abre el/);
  const letter = await (await authorized('/contenido/1')).text();
  assert.match(letter, /&lt;script&gt;texto ficticio/);
  assert.doesNotMatch(letter, /calendar\/photos/);
  const photo = await authorized('/foto/1');
  assert.equal(photo.headers.get('cache-control'), 'private, no-store');
  assert.equal(photo.headers.get('content-type'), 'image/webp');
  assert.equal(await photo.text(), 'fixture');
  const logout = await handle(request('/salir', {method:'POST', headers:{...headers,origin:url}}));
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  now += 8 * 86400000;
  assert.equal((await authorized('/foto/1')).status, 401);
  const forged = session({...env,SESSION_SECRET:'x'.repeat(32)}, now, true);
  assert.equal((await handle(request('/foto/1', {headers:{cookie:forged}}))).status, 401);
});

test('el formulario limita intentos repetidos y la configuración privada incompleta falla cerrada', async () => {
  const handle = createHandler({env});
  for (let n = 0; n < 9; n++) {
    const response = await handle(request('/acceso', {method:'POST',
      headers:{origin:url,'x-vercel-forwarded-for':'192.0.2.99'},body:'code=no'}));
    assert.equal(response.status, n < 8 ? 401 : 429);
  }
  assert.equal((await createHandler({env:{CALENDAR_MODE:'private'}})(request('/'))).status, 503);
});

test('la entrada de Vercel sirve la demo sin credenciales ni archivos privados', async () => {
  const home = await vercel.fetch(request('/api/calendar'));
  assert.match(await home.text(), /Calendario de muestra/);
  assert.match(home.headers.get('x-robots-tag'), /noindex/);
  const grid = await vercel.fetch(request('/api/calendar?r=calendar'));
  assert.equal((await grid.text()).match(/class="door /g).length, 24);
  const bad = await vercel.fetch(request('/api/calendar?r=photo&day=../1'));
  assert.equal(bad.status, 404);
  const login = await vercel.fetch(request('/api/calendar?r=login', {method:'POST',
    headers:{origin:url},body:new URLSearchParams({code:'fictional'})}));
  assert.equal(login.status, 303);
});

test('en modo diario solo se pueden leer y descargar los contenidos del día en Roma', async () => {
  let now = midnight(1) - 1;
  const calendar = structuredClone(sample);
  for (const entry of calendar.days) entry.photo = 'calendar/photos/' + 'b'.repeat(64) + '/' + entry.day + '.webp';
  const policyEnv = {...env, CALENDAR_UNLOCK_POLICY:'today'};
  const handle = createHandler({env:policyEnv, clock:() => now, blob:async key => ({
    statusCode:200, stream:new Response(key.endsWith('.webp') ? 'fixture' : JSON.stringify(calendar)).body
  })});
  const get = path => handle(request(path, {headers:{cookie:session(policyEnv, now, true).split(';')[0]}}));
  const count = async () => ((await (await get('/calendario')).text()).match(/class="door [^"]*\bopen"/g) || []).length;
  assert.equal(await count(), 0);
  for (const day of [1, 2, 12, 24]) {
    now = midnight(day);
    assert.equal(await count(), 1);
    assert.match(await (await get('/contenido/' + day)).text(), /class="message"/);
    assert.equal((await get('/foto/' + day)).status, 200);
    if (day > 1) {
      assert.match(await (await get('/contenido/' + (day - 1))).text(), /solo se podía abrir ese día/);
      assert.equal((await get('/foto/' + (day - 1))).status, 404);
    }
    if (day < 24) {
      assert.match(await (await get('/contenido/' + (day + 1))).text(), /Esta puerta se abre el/);
      assert.equal((await get('/foto/' + (day + 1))).status, 404);
    }
  }
  now = midnight(25);
  assert.equal(await count(), 0);
  assert.equal((await get('/foto/24')).status, 404);
  assert.match(await (await get('/calendario')).text(), /El calendario ha terminado/);
});
