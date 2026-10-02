// Time-based one-time codes (RFC 6238, the 6-digit codes authenticator apps show), so the tests can
// "read the phone" and the fake server can check codes the way Supabase Auth does.
import { createHmac, randomBytes } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const newSecret = () => Array.from(randomBytes(20), (b) => B32[b % 32]).join('');
const decode = (s) => {
  let bits = '';
  for (const ch of s.replace(/=+$/, '').toUpperCase()) bits += B32.indexOf(ch).toString(2).padStart(5, '0');
  return Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
};
export function totp(secret, at = Date.now(), step = 30) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / step)));
  const h = createHmac('sha1', decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
/** Accept the current code or its neighbour on either side (clock drift), as servers do. */
export const checkTotp = (secret, code, at = Date.now()) => [-1, 0, 1].some((w) => totp(secret, at + w * 30_000) === String(code));
