/**
 * Password-based E2EE utilities for collab sessions.
 *
 * Uses Web Crypto API:
 * - PBKDF2 key derivation (100k iterations, SHA-256)
 * - AES-256-GCM encryption with 12-byte random IV
 * - Wire format: base64(IV || ciphertext || authTag)
 */

const PBKDF2_ITERATIONS = 100_000;
const IV_LENGTH = 12; // AES-GCM standard
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Derive an AES-256-GCM key from a password and salt (sessionId).
 * Deterministic: same password + salt always produces the same key.
 */
export async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a plaintext string. Returns base64(IV || ciphertext || authTag).
 */
export async function encryptPayload(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );
  // Combine IV + ciphertext (GCM appends authTag to ciphertext automatically)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return uint8ToBase64(combined);
}

/**
 * Decrypt a base64(IV || ciphertext || authTag) string.
 * Throws on wrong key (GCM auth tag mismatch).
 */
export async function decryptPayload(key: CryptoKey, ciphertext: string): Promise<string> {
  const combined = base64ToUint8(ciphertext);
  const iv = combined.slice(0, IV_LENGTH);
  const data = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Generate a random password. 16 chars, base62 charset, using crypto.getRandomValues.
 */
export function generatePassword(length: number = 16): string {
  const values = crypto.getRandomValues(new Uint8Array(length));
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[values[i] % BASE62_CHARS.length];
  }
  return result;
}

// ─── Base64 helpers (browser-compatible, no Node Buffer) ───

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
