import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assets } from './assets.mjs';
import { validate } from '../src/calendar.mjs';
import sample from '../content/calendar.example.json' with { type: 'json' };

validate(sample);
await rm('dist', {recursive:true, force:true});
for (const [route, [source]] of Object.entries(assets)) {
  const target = 'dist' + route;
  await mkdir(dirname(target), {recursive:true});
  await copyFile(source, target);
}
console.log('Compilación pública lista en dist/.');
