import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt do próprio Node: sem dependência nativa (bcrypt/argon2) para compilar
// no Windows ou na imagem Docker. Parâmetros = recomendação OWASP (N=2^17).
const PARAMS: ScryptOptions = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEY_LEN = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, PARAMS, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** Devolve "salt:hash" em hex, pronto para `User.passwordHash`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await derive(password, Buffer.from(saltHex, "hex"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
