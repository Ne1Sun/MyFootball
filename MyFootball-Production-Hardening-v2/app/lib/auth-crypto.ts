const AUTH_SECRET = process.env.AUTH_SECRET || "myfootball-secret-salt-2026-bharat-sports";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

export async function signSession(payload: object): Promise<string> {
  const enc = new TextEncoder();
  const data = JSON.stringify(payload);
  const dataBytes = enc.encode(data);
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, dataBytes);
  return `${toHex(dataBytes.buffer)}.${toHex(signature)}`;
}

export async function verifySession<T = any>(token: string): Promise<T | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [dataHex, sigHex] = parts;
    const dataBytes = fromHex(dataHex);
    const sigBytes = fromHex(sigHex);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(AUTH_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as unknown as BufferSource,
      dataBytes as unknown as BufferSource
    );
    if (!isValid) return null;
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(dataBytes)) as T;
  } catch {
    return null;
  }
}

/**
 * Constant-time byte array comparison preventing timing side-channel attacks.
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

/**
 * Hashes a plaintext password using PBKDF2-HMAC-SHA256 with CSPRNG salt.
 * Format: pbkdf2$iterations$saltHex$hashHex
 */
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));

  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    KEY_BITS
  );

  const saltHex = toHex(salt.buffer);
  const hashHex = toHex(derivedBits);

  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

/**
 * Verifies a plaintext password against a serialized PBKDF2 hash.
 */
export async function verifyPassword(password: string, serializedHash: string): Promise<boolean> {
  try {
    if (!password || !serializedHash) return false;
    const parts = serializedHash.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

    const iterations = parseInt(parts[1], 10);
    const saltBytes = fromHex(parts[2]);
    const expectedHashBytes = fromHex(parts[3]);

    if (iterations <= 0 || saltBytes.length === 0 || expectedHashBytes.length === 0) {
      return false;
    }

    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes as unknown as BufferSource,
        iterations,
        hash: "SHA-256",
      },
      baseKey,
      expectedHashBytes.length * 8
    );

    const computedHashBytes = new Uint8Array(derivedBits);
    return timingSafeEqual(computedHashBytes, expectedHashBytes);
  } catch {
    return false;
  }
}
