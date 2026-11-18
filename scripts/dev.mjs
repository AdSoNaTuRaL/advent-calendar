import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createHandler } from '../src/server.mjs';
import { assets } from './assets.mjs';

const preview = process.env.LOCAL_PREVIEW_AT;
const localContent = process.env.LOCAL_PRIVATE_FILES === '1' ? {
  calendar: async () => JSON.parse(await readFile('content/calendar.private.json', 'utf8')),
  photo: day => readFile(`private/photos/ready/${day}.webp`)
} : undefined;
if (preview && !Number.isFinite(Date.parse(preview))) throw Error('LOCAL_PREVIEW_AT debe ser una fecha ISO válida.');
const handle = createHandler({local:true, localContent, clock: preview ? () => Date.parse(preview) : Date.now});
const port = Number(process.env.PORT || 3000);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://' + req.headers.host);
    const asset = Object.hasOwn(assets, url.pathname) && assets[url.pathname];
    if (asset && req.method === 'GET') {
      const [file, type] = asset;
      const bytes = await readFile('dist' + url.pathname).catch(() => readFile(file));
      res.writeHead(200, {'Content-Type':type, 'X-Robots-Tag':'noindex'});
      return res.end(bytes);
    }
    const request = new Request(url, {method:req.method, headers:req.headers,
      ...(req.method === 'POST' ? {body:Readable.toWeb(req), duplex:'half'} : {})});
    const response = await handle(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
  } catch {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
