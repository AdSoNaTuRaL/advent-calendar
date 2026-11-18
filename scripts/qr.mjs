import { mkdir } from 'node:fs/promises';
import QRCode from 'qrcode';

const url = new URL(process.argv[2] || 'invalid');
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
  throw Error('Usa una URL HTTPS sin credenciales, parámetros ni fragmentos.');
}
await mkdir('private', {recursive:true});
await QRCode.toFile('private/qr.png', url.href, {width:1024, margin:4, errorCorrectionLevel:'M'});
console.log('Código QR guardado en private/qr.png.');
