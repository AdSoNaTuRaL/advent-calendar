import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { basename } from 'node:path';
import sharp from 'sharp';
import { validate } from '../src/calendar.mjs';
import { escape } from '../src/view.mjs';

const base = 'private/photos';
const contentPath = 'content/calendar.private.json';
const orderPath = base + '/order.json';
const port = Number(process.env.EDITOR_PORT || 3010);
const origin = 'http://127.0.0.1:' + port;
const key = randomUUID();
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const calendar = validate(await read(contentPath));
const order = await read(orderPath);
if (!Array.isArray(order) || order.length !== 24 || new Set(order).size !== 24 ||
    !order.every(file => typeof file === 'string' && basename(file) === file && /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file))) {
  throw Error('order.json debe contener 24 nombres válidos y distintos.');
}
const originals = order.map(file => base + '/originals/' + file);
const thumbnails = new Map();
const initial = calendar.days.map((entry, index) => ({
  id:index, title:entry.title, message:entry.message, alt:entry.alt || ''
}));
const script = await readFile(new URL('./editor-client.js', import.meta.url));
let active = false;
let entries = initial;

function page() {
  return `<!doctype html><html lang="es"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Editar el calendario</title>
<style>
:root{color-scheme:dark;background:#102721;color:#fff4df;font:16px system-ui}*{box-sizing:border-box}body{max-width:66rem;margin:auto;padding:1rem}h1,h2{font-family:Georgia,serif}h1{font-size:clamp(2rem,6vw,3.4rem)}p{line-height:1.5}form{display:grid;gap:1rem}.toolbar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;padding:.85rem;background:#102721;border:1px solid #928058}.status{margin:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr));gap:1rem}.card{border:1px solid #928058;padding:1rem;background:#19372e}.card img{display:block;width:100%;height:15rem;object-fit:contain;background:#102721}.card h2{margin:.4rem 0 .8rem;font-size:1.65rem}label{display:block;margin-top:.7rem}input,textarea,select,button{font:inherit;min-height:44px;border:1px solid #b49b65;border-radius:.2rem;padding:.45rem;color:inherit;background:#102721}input,textarea{display:block;width:100%;margin-top:.25rem}textarea{min-height:8rem;resize:vertical}button{background:#e3bd77;color:#17211a;font-weight:700;cursor:pointer;padding-inline:.8rem}button:disabled{opacity:.65}a{color:#f3cf88}:focus-visible{outline:3px solid #ffe5ad;outline-offset:3px}
</style>
<h1>Editar el calendario</h1><p>Cambia los textos y usa «Mover al día» para cambiar el orden. La nota se mueve junto con su foto.</p>
<form action="/guardar" method="post" data-key="${key}">
<div class="toolbar"><button type="submit">Guardar y actualizar la vista previa</button>
<a href="/revision" target="_blank" rel="noopener">Ver revisión</a><p class="status" role="status"></p></div>
<div class="grid">${entries.map(({id,title,message,alt}, index) => `<section class="card" data-id="${id}">
<h2>Día ${index + 1}</h2><img src="/miniatura/${id}" alt="${escape(alt)}" loading="lazy">
<label>Mover al día <select name="move">${entries.map((_,i) => `<option value="${i}" ${i === index ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
<label>Título<input name="title" maxlength="8000" required value="${escape(title)}"></label>
<label>Mensaje<textarea name="message" maxlength="8000" required>\n${escape(message)}</textarea></label>
<label>Descripción de la foto<input name="alt" maxlength="1000" value="${escape(alt)}"></label>
</section>`).join('')}</div></form><script src="/editor.js" defer></script>`;
}

async function replacePair(manifest, nextOrder) {
  const files = [[contentPath, manifest], [orderPath, nextOrder]];
  const token = randomUUID();
  const temps = files.map(([path]) => path + '.' + token + '.private.tmp');
  const previous = await Promise.all(files.map(([path]) => readFile(path)));
  let changed = 0;
  try {
    for (const [index, [, data]] of files.entries()) {
      await writeFile(temps[index], JSON.stringify(data, null, 2) + '\n', {flag:'wx',mode:0o600});
    }
    for (const [index, [path]] of files.entries()) {
      await rename(temps[index], path);
      changed++;
    }
  } catch (error) {
    for (let index = 0; index < changed; index++) await writeFile(files[index][0], previous[index]);
    throw error;
  } finally {
    await Promise.all(temps.map(path => unlink(path).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    })));
  }
}

function prepare() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/photos.mjs','prepare'], {stdio:'ignore'});
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(Error('No se pudo actualizar la revisión.')));
  });
}

async function save(req, res) {
  if (req.headers.origin !== origin || req.headers['x-editor-key'] !== key) return res.writeHead(403).end();
  if (active) return res.writeHead(409).end('Ya hay un guardado en curso.');
  active = true;
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 1024) {
        res.writeHead(413).end('El formulario es demasiado grande.');
        return;
      }
      chunks.push(chunk);
    }
    let next;
    try {
      next = JSON.parse(Buffer.concat(chunks).toString());
      if (!Array.isArray(next) || next.length !== 24 || new Set(next.map(entry => entry?.id)).size !== 24 ||
          !next.every(entry => Number.isInteger(entry?.id) && entry.id >= 0 && entry.id < 24 &&
            typeof entry.alt === 'string' && entry.alt.length <= 1000)) throw Error();
      validate({...calendar, days:next.map(({title,message,alt}, i) => ({day:i+1,title,message,alt}))});
    } catch {
      return res.writeHead(400).end('Comprueba que los 24 días tienen título y mensaje.');
    }
    const manifest = {...calendar, days:next.map(({title,message,alt}, i) => ({day:i+1,title,message,alt}))};
    await replacePair(manifest, next.map(({id}) => order[id]));
    entries = next;
    try {
      await prepare();
      res.end('Cambios guardados. La vista previa está actualizada.');
    } catch {
      res.writeHead(500).end('Cambios guardados. La vista previa no se pudo actualizar.');
    }
  } finally {
    active = false;
  }
}

const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  if (req.headers.host !== new URL(origin).host) return res.writeHead(403).end();
  try {
    if (req.method === 'POST' && req.url === '/guardar') return await save(req, res);
    if (req.method !== 'GET') return res.writeHead(405).end();
    if (req.url === '/') return res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}).end(page());
    if (req.url === '/editor.js') return res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8'}).end(script);
    if (req.url === '/revision') {
      const review = await readFile(base + '/review.html').catch(error => {
        if (error.code !== 'ENOENT') throw error;
        return null;
      });
      if (!review) return res.writeHead(404).end('Guarda el formulario para generar la vista previa.');
      return res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}).end(review);
    }
    const match = /^\/miniatura\/(\d{1,2})$/.exec(req.url);
    const id = match && Number(match[1]);
    if (!match || !originals[id]) return res.writeHead(404).end();
    if (!thumbnails.has(id)) thumbnails.set(id, sharp(originals[id]).autoOrient()
      .resize(640, 480, {fit:'inside',withoutEnlargement:true}).webp({quality:75}).toBuffer());
    return res.writeHead(200, {'Content-Type':'image/webp'}).end(await thumbnails.get(id));
  } catch {
    res.writeHead(500).end('No se pudo completar la operación local.');
  }
});
server.listen(port, '127.0.0.1', () => console.log('Editor privado local: ' + origin));
