import sample from '../content/calendar.example.json' with { type: 'json' };
import { get } from '@vercel/blob';
import { attempt, authorized, matches, session } from './auth.mjs';
import { doorState, manifestPath, validate } from './calendar.mjs';
import { translate } from './i18n.mjs';
import { door, grid, page, welcome, escape } from './view.mjs';

const headers = {
  'Cache-Control':'private, no-store', 'X-Robots-Tag':'noindex, nofollow, noarchive',
  'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
};
const demo = validate(sample);
const redirect = (location, cookie) => new Response(null, {status:303, headers:{
  ...headers, Location:location, ...(cookie ? {'Set-Cookie': cookie} : {})
}});
const html = (t, lang, body, status = 200) => new Response(page(t, lang, body), {
  status, headers:{...headers,'Content-Type':'text/html; charset=utf-8'}
});

async function readAccessCode(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8')).get('code');
}

export function createHandler({local = false, env = process.env, clock = Date.now, blob = get, localContent} = {}) {
  return async request => {
    const url = new URL(request.url);
    const path = url.pathname;
    const privateMode = env.CALENDAR_MODE === 'private';
    const secure = !local;
    const localFiles = local && localContent;
    let lang = env.CALENDAR_LANGUAGE || 'es';
    let t = translate(lang);
    const now = clock();
    const error = (message, status) => html(t, lang, `<section class="letter"><p>${escape(message)}</p></section>`, status);
    try {
      if ((env.CALENDAR_MODE && !['demo','private'].includes(env.CALENDAR_MODE)) ||
        (privateMode && (!(env.ACCESS_CODE?.length >= 12) || env.ACCESS_CODE.length > 256 ||
          !(env.SESSION_SECRET?.length >= 32) || (!localFiles && !env.BLOB_READ_WRITE_TOKEN)))) return error(t.error, 503);
      if (path === '/acceso' || path === '/salir') {
        if (request.method !== 'POST') return error(t.missing, 405);
        const origin = request.headers.get('origin');
        if (!origin || new URL(origin).host !== url.host ||
            new URL(origin).protocol !== (secure ? 'https:' : url.protocol)) return error(t.missing, 403);
        if (!privateMode) return redirect('/calendario');
        if (path === '/salir') return redirect('/', session(env, now, secure, true));
        const ip = local ? 'local' : (request.headers.get('x-vercel-forwarded-for') || 'unknown').split(',')[0].trim();
        if (!attempt(ip, Date.now())) return html(t, lang, welcome(t, null, now, false, t.limited), 429);
        const code = await readAccessCode(request);
        if (!code || code.length > 256 || !matches(code, env.ACCESS_CODE)) {
          return html(t, lang, welcome(t, null, now, false, t.invalid), 401);
        }
        return redirect('/calendario', session(env, now, secure));
      }
      if (request.method !== 'GET') return error(t.missing, 405);
      if (privateMode && !authorized(request.headers.get('cookie'), env, now, secure)) {
        if (path === '/') return html(t, lang, welcome(t, null, now, false));
        return path === '/calendario' ? redirect('/') : error(t.missing, 401);
      }
      let calendar = demo;
      if (privateMode) {
        if (localFiles) calendar = validate(await localContent.calendar());
        else {
          const result = await blob(env.BLOB_CALENDAR_PATH || manifestPath(), {access:'private',token:env.BLOB_READ_WRITE_TOKEN});
          if (result?.statusCode !== 200) return error(t.error, 503);
          calendar = validate(await new Response(result.stream).json());
        }
      }
      calendar = {...calendar, todayOnly:env.CALENDAR_UNLOCK_POLICY === 'today'};
      lang = calendar.language;
      t = translate(lang);
      if (path === '/') return html(t, lang, welcome(t, calendar, now, !privateMode));
      if (path === '/calendario') return html(t, lang, grid(t, calendar, now, privateMode));
      const match = /^\/(contenido|foto)\/([1-9]|1\d|2[0-4])$/.exec(path);
      if (!match) return error(t.missing, 404);
      const day = Number(match[2]);
      if (match[1] === 'contenido') return html(t, lang, door(t, calendar, day, now, !privateMode));
      if (!privateMode || doorState(calendar, day, now) !== 'open') return error(t.missing, 404);
      const photoHeaders = {...headers,'Content-Type':'image/webp'};
      if (localFiles) return new Response(await localContent.photo(day), {headers:photoHeaders});
      const key = calendar.days[day - 1].photo;
      if (typeof key !== 'string' || !new RegExp(`^calendar/photos/[a-f0-9]{64}/${day}\\.webp$`).test(key)) return error(t.missing, 404);
      const image = await blob(key, {access:'private',token:env.BLOB_READ_WRITE_TOKEN});
      return image?.statusCode === 200 ? new Response(image.stream, {headers:photoHeaders}) : error(t.missing, 404);
    } catch {
      return error(t.error, 503);
    }
  };
}
