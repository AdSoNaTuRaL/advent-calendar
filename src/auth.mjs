import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest();
export const matches = (left, right) => timingSafeEqual(digest(left), digest(right));
const lifetime = 7 * 86400;
const signature = (expires, env) => createHmac('sha256', env.SESSION_SECRET)
  .update(expires + ':' + digest(env.ACCESS_CODE).toString('hex')).digest('base64url');

export function session(env, now, secure, clear = false) {
  const expires = String(Math.floor(now / 1000) + lifetime);
  const name = secure ? '__Host-advent' : 'advent';
  const value = clear ? '' : expires + '.' + signature(expires, env);
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : lifetime}${secure ? '; Secure' : ''}`;
}

export function authorized(cookie, env, now, secure) {
  const name = secure ? '__Host-advent' : 'advent';
  const value = cookie?.split(/;\s*/).find(item => item.startsWith(name + '='))?.slice(name.length + 1);
  const [expires, mac, extra] = value?.split('.') || [];
  return Boolean(!extra && mac && /^\d{10}$/.test(expires) &&
    Number(expires) * 1000 > now && matches(mac, signature(expires, env)));
}

const attempts = new Map();
export function attempt(ip, now) {
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  let entry = attempts.get(ip);
  if (!entry) {
    if (attempts.size >= 2048) return false;
    entry = {count: 0, until: now + 10 * 60000};
    attempts.set(ip, entry);
  }
  return entry.count++ < 8;
}
