import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.MFA_ENCRYPTION_KEY
  if (!key) {
    throw new Error("MFA_ENCRYPTION_KEY environment variable is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"")
  }
  const decoded = Buffer.from(key, "base64")
  if (decoded.length !== 32) {
    throw new Error("MFA_ENCRYPTION_KEY must be 32 bytes (base64-encoded).")
  }
  return decoded
}

export function encryptMfaSecret(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`
}

export function decryptMfaSecret(encrypted: string): string {
  const key = getEncryptionKey()
  const parts = encrypted.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted MFA secret format.")
  }

  const iv = Buffer.from(parts[0], "base64")
  const authTag = Buffer.from(parts[1], "base64")
  const ciphertext = Buffer.from(parts[2], "base64")

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString("utf8")
}

export function isEncrypted(value: string | null): boolean {
  if (!value) return false
  // Encrypted values have the format iv:authTag:ciphertext (3 base64 segments)
  const parts = value.split(":")
  return parts.length === 3 && parts.every(p => /^[A-Za-z0-9+/]+=*$/.test(p))
}
