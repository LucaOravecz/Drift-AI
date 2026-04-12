import { createHmac, randomBytes } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateMfaSecret(length = 20) {
  const bytes = randomBytes(length);
  return encodeBase32(bytes);
}

export function buildOtpAuthUrl(email: string, issuer: string, secret: string) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotp(secret: string, code: string, window = 1) {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  const currentStep = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -window; offset <= window; offset += 1) {
    if (generateTotp(secret, currentStep + offset) === normalized) {
      return true;
    }
  }

  return false;
}

function generateTotp(secret: string, step: number) {
  const key = decodeBase32(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function encodeBase32(buffer: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(input: string) {
  const normalized = input.toUpperCase().replace(/=+$/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 secret.");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}
