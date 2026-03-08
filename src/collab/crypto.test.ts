import { describe, it, expect } from 'vitest';
import { deriveKey, encryptPayload, decryptPayload, generatePassword } from './crypto';

describe('crypto', () => {
  describe('deriveKey', () => {
    it('produces consistent key for same password+salt', async () => {
      const key1 = await deriveKey('test-password', 'session-123');
      const key2 = await deriveKey('test-password', 'session-123');
      // CryptoKey objects aren't directly comparable, but encrypting
      // the same plaintext with both should produce decryptable results
      const ct = await encryptPayload(key1, 'hello');
      const pt = await decryptPayload(key2, ct);
      expect(pt).toBe('hello');
    });

    it('produces different key for different passwords', async () => {
      const key1 = await deriveKey('password-a', 'session-123');
      const key2 = await deriveKey('password-b', 'session-123');
      const ct = await encryptPayload(key1, 'hello');
      await expect(decryptPayload(key2, ct)).rejects.toThrow();
    });

    it('produces different key for different salts', async () => {
      const key1 = await deriveKey('same-password', 'session-1');
      const key2 = await deriveKey('same-password', 'session-2');
      const ct = await encryptPayload(key1, 'hello');
      await expect(decryptPayload(key2, ct)).rejects.toThrow();
    });
  });

  describe('encryptPayload / decryptPayload', () => {
    it('round-trips correctly', async () => {
      const key = await deriveKey('pw', 'salt');
      const plaintext = '{"elements":[{"id":"abc","data":"test"}]}';
      const ct = await encryptPayload(key, plaintext);
      expect(ct).not.toBe(plaintext); // should be different
      const result = await decryptPayload(key, ct);
      expect(result).toBe(plaintext);
    });

    it('handles empty string', async () => {
      const key = await deriveKey('pw', 'salt');
      const ct = await encryptPayload(key, '');
      const result = await decryptPayload(key, ct);
      expect(result).toBe('');
    });

    it('handles unicode content', async () => {
      const key = await deriveKey('pw', 'salt');
      const text = 'Hello 世界 🌍';
      const ct = await encryptPayload(key, text);
      const result = await decryptPayload(key, ct);
      expect(result).toBe(text);
    });

    it('produces different ciphertext each time (random IV)', async () => {
      const key = await deriveKey('pw', 'salt');
      const ct1 = await encryptPayload(key, 'same text');
      const ct2 = await encryptPayload(key, 'same text');
      expect(ct1).not.toBe(ct2);
    });

    it('throws on wrong key', async () => {
      const key1 = await deriveKey('correct', 'salt');
      const key2 = await deriveKey('wrong', 'salt');
      const ct = await encryptPayload(key1, 'secret');
      await expect(decryptPayload(key2, ct)).rejects.toThrow();
    });

    it('throws on tampered ciphertext', async () => {
      const key = await deriveKey('pw', 'salt');
      const ct = await encryptPayload(key, 'hello');
      // Tamper with the base64 string
      const tampered = ct.slice(0, -4) + 'XXXX';
      await expect(decryptPayload(key, tampered)).rejects.toThrow();
    });
  });

  describe('generatePassword', () => {
    it('produces string of correct length', () => {
      expect(generatePassword().length).toBe(16);
      expect(generatePassword(8).length).toBe(8);
      expect(generatePassword(32).length).toBe(32);
    });

    it('uses only base62 characters', () => {
      const pw = generatePassword(100);
      expect(pw).toMatch(/^[0-9A-Za-z]+$/);
    });

    it('produces different passwords each call', () => {
      const passwords = new Set(Array.from({ length: 10 }, () => generatePassword()));
      expect(passwords.size).toBe(10);
    });
  });
});
