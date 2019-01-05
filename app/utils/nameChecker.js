import { SHA3 } from 'sha3';

const blacklist = new Set([
  'bit', // Namecoin
  'eth', // ENS
  'example', // ICANN reserved
  'invalid', // ICANN reserved
  'local', // mDNS
  'localhost', // ICANN reserved
  'onion', // Tor
  'test' // ICANN reserved
]);

const MAX_NAME_SIZE = 63;
const ROLLOUT_INTERVAL = 7 * (((24 * 60 * 60) / 5) * 60);
const AUCTION_START = 10 * (((24 * 60 * 60) / 5) * 60);

const CHARSET = new Uint8Array([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  4,
  0,
  0,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  2,
  0,
  0,
  0,
  0,
  4,
  0,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  3,
  0,
  0,
  0,
  0,
  0
]);

const NAME_BUFFER = Buffer.allocUnsafe(63);

function assert(cond) {
  if (!cond) {
    throw new Error('Assertion error.');
  }
}

export function hashName(name) {
  assert(verifyName(name));
  const slab = NAME_BUFFER;
  const written = slab.write(name, 0, slab.length, 'ascii');
  assert(name.length === written);
  const buf = slab.slice(0, written);
  const hash = new SHA3(256);
  hash.update(buf);
  return hash.digest();
}

export function verifyName(str) {
  if (str.length === 0) {
    return false;
  }

  if (str.length > MAX_NAME_SIZE) {
    return false;
  }

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);

    // No unicode characters.
    if (ch & 0xff80) {
      return false;
    }

    const type = CHARSET[ch];

    switch (type) {
      case 0: // non-printable
        return false;
      case 1: // 0-9
        break;
      case 2: // A-Z
        return false;
      case 3: // a-z
        break;
      case 4: // - and _
        // Do not allow at end or beginning.
        if (i === 0 || i === str.length - 1) {
          return false;
        }
        break;
    }
  }

  return !blacklist.has(str);
}

export function getRollout(hash) {
  // Modulo the hash by 52 to get week number.
  const week = modBuffer(hash, 52);

  // Multiply result by a number of blocks-per-week.
  const height = week * ROLLOUT_INTERVAL;

  // Add the auction start height to the rollout height.
  return [AUCTION_START + height, week];
}

function modBuffer(buf, num) {
  assert(Buffer.isBuffer(buf));
  assert((num & 0xff) === num);
  assert(num !== 0);

  const p = 256 % num;
  let acc = 0;
  for (let i = 0; i < buf.length; i++) {
    acc = (p * acc + buf[i]) % num;
  }

  return acc;
}
