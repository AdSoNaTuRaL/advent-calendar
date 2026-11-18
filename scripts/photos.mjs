import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { put, get } from '@vercel/blob';
import sharp from 'sharp';
import { escape } from '../src/view.mjs';
import { manifestPath, validate } from '../src/calendar.mjs';

const base = 'private/photos';
const originals = base + '/originals';
const ready = base + '/ready';
const orderPath = base + '/order.json';
const reviewPath = base + '/review.html';
const preparedPath = base + '/prepared.json';
const approvalPath = base + '/approval.json';
const [command, flag] = process.argv.slice(2);

const hash = data => createHash('sha256').update(data).digest('hex');
const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const names = async folder => (await readdir(folder, {withFileTypes:true}))
  .filter(entry => entry.isFile() && /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(entry.name))
  .map(entry => entry.name).sort();
const ignoreExisting = error => { if (error.code !== 'EEXIST') throw error; };

async function snapshot() {
  const source = validate(await readJSON('content/calendar.private.json'));
  const calendar = {year:source.year, timezone:source.timezone, language:source.language,
    days:source.days.map(({day,title,message,alt}) => ({day,title,message,...(typeof alt === 'string' && {alt})}))};
  const order = await readJSON(orderPath);
  const photos = await Promise.all(calendar.days.map(({day}) => readFile(`${ready}/${day}.webp`)));
  const revision = hash(JSON.stringify({calendar,order,photos:photos.map(hash)}));
  return {calendar, order, photos, revision};
}

async function prepare() {
  const order = await readJSON(orderPath);
  const imported = await names(originals);
  if (!Array.isArray(order) || order.length !== 24 || new Set(order).size !== 24 ||
      !order.every(file => typeof file === 'string' && basename(file) === file && imported.includes(file))) {
    throw Error('order.json debe contener 24 nombres distintos de la carpeta originals, en orden.');
  }
  validate(await readJSON('content/calendar.private.json'));
  await mkdir(ready, {recursive:true});
  for (const [index, file] of order.entries()) {
    try {
      const image = await sharp(join(originals, file)).autoOrient().resize(1600, 1600, {
        fit:'inside', withoutEnlargement:true
      }).webp({quality:82}).toBuffer();
      await writeFile(`${ready}/${index + 1}.webp`, image);
    } catch {
      throw Error(`No se pudo convertir la foto del día ${index + 1}. Expórtala como JPEG y revisa order.json.`);
    }
  }
  const {calendar, photos, revision} = await snapshot();
  const cards = calendar.days.map(({day,title,message,alt}, index) =>
    `<article><h2>${day}. ${escape(title)}</h2><img width="320" src="data:image/webp;base64,${photos[index].toString('base64')}" alt="${escape(alt || '')}"><p>${escape(order[index])}</p><p>${escape(message)}</p></article>`);
  await writeFile(reviewPath, `<!doctype html><html lang="es"><meta charset="utf-8"><title>Revisión privada</title><style>body{font:1rem system-ui;margin:2rem}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem}img{max-width:100%;height:auto}p{white-space:pre-wrap}</style><h1>Revisión privada</h1><main>${cards.join('')}</main></html>`);
  await save(preparedPath, {revision});
}

async function publish() {
  const {calendar, photos, revision} = await snapshot();
  if ((await readJSON(approvalPath)).revision !== revision) throw Error('La versión cambió. Prepara, revisa y aprueba de nuevo.');
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw Error('Falta BLOB_READ_WRITE_TOKEN.');
  const path = manifestPath();
  if (!/^calendar\/[a-zA-Z0-9_-]+\.json$/.test(path)) throw Error('Usa una ruta como calendar/manifest.json.');
  const options = {token, access:'private'};
  const prior = await get(path, options);
  if (prior && (prior.statusCode !== 200 || !prior.blob.etag)) throw Error('No se pudo verificar la versión activa.');
  await prior?.stream?.cancel();
  for (const entry of calendar.days) {
    entry.photo = `calendar/photos/${revision}/${entry.day}.webp`;
    const existing = await get(entry.photo, options);
    if (existing?.statusCode === 200) {
      await existing.stream.cancel();
      continue;
    }
    await put(entry.photo, photos[entry.day - 1], {...options, contentType:'image/webp'});
  }
  await put(path, JSON.stringify(calendar), {...options, contentType:'application/json',cacheControlMaxAge:60,
    ...(prior ? {allowOverwrite:true,ifMatch:prior.blob.etag} : {})});
}

async function run() {
  if (command === 'import' && flag) {
    const files = await names(flag);
    if (!files.length) throw Error('La carpeta no contiene imágenes compatibles.');
    await mkdir(originals, {recursive:true});
    for (const file of files) {
      await copyFile(join(flag, file), join(originals, file), constants.COPYFILE_EXCL).catch(ignoreExisting);
    }
    await writeFile(orderPath, JSON.stringify(await names(originals), null, 2), {flag:'wx'}).catch(ignoreExisting);
    console.log('Edita private/photos/order.json para dejar exactamente 24 nombres en orden.');
  } else if (command === 'prepare') {
    await prepare();
    console.log('Abre private/photos/review.html y revisa las 24 fotos y sus mensajes.');
  } else if (command === 'approve' && flag === '--reviewed') {
    const {revision} = await snapshot();
    if ((await readJSON(preparedPath)).revision !== revision) throw Error('La revisión está desactualizada. Ejecuta prepare de nuevo.');
    await save(approvalPath, {revision});
    console.log('Versión aprobada localmente.');
  } else if (command === 'publish' && flag === '--confirm-upload') {
    await publish();
    console.log('Versión publicada en el almacén privado.');
  } else {
    throw Error('Usa import <carpeta>, prepare, approve --reviewed o publish --confirm-upload.');
  }
}

run().catch(error => {
  console.error(error.name.startsWith('Blob') ? 'Error de Blob. Revisa el token, el almacén y la versión activa.' : error.message);
  process.exitCode = 1;
});
