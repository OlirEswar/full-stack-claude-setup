import { randomBytes, scrypt, timingSafeEqual, type BinaryLike, type ScryptOptions } from 'node:crypto';

const KEY_LEN = 64;
const SALT_BYTES = 16;
const SCRYPT_OPTS: ScryptOptions = { N: 16384, r: 8, p: 1 };

function scryptAsync(password: BinaryLike, salt: BinaryLike): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, SCRYPT_OPTS, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export interface PasswordHash {
  /** hex-encoded scrypt derived key */
  hash: string;
  /** hex-encoded random 16-byte salt */
  salt: string;
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt);
  return { hash: key.toString('hex'), salt: salt.toString('hex') };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const expected = Buffer.from(hash, 'hex');
  const actual = await scryptAsync(password, Buffer.from(salt, 'hex'));
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

const DUMMY_SALT = randomBytes(SALT_BYTES).toString('hex');

/** Spend the same work as a real verification; used when the user doesn't exist. */
export async function dummyVerify(password: string): Promise<false> {
  await scryptAsync(password, Buffer.from(DUMMY_SALT, 'hex'));
  return false;
}
