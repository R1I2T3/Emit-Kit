import { describe, it, expect } from "vitest";

// Ensure a valid 64-char hex key is set for the test run if not present
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

import { encrypt, decrypt } from "./crypto";

describe("crypto encryption utility", () => {
  it("should encrypt and decrypt correctly", () => {
    const originalText = "hello-world-emitkit";
    const encrypted = encrypt(originalText);
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe("string");
    
    // Format should be iv:authTag:encryptedText
    const parts = encrypted.split(":");
    expect(parts.length).toBe(3);
    
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(originalText);
  });

  it("should produce different ciphertexts for the same input (random IV)", () => {
    const text = "same-input-text";
    const encrypted1 = encrypt(text);
    const encrypted2 = encrypt(text);
    expect(encrypted1).not.toBe(encrypted2);
    
    // But they should both decrypt back to the same text
    expect(decrypt(encrypted1)).toBe(text);
    expect(decrypt(encrypted2)).toBe(text);
  });

  it("should throw an error if the encrypted format is invalid", () => {
    expect(() => decrypt("invalidformat")).toThrow("Invalid encrypted format");
    expect(() => decrypt("iv:tag")).toThrow("Invalid encrypted format");
  });

  it("should throw an error if ciphertext is tampered with", () => {
    const originalText = "sensitive-information";
    const encrypted = encrypt(originalText);
    const [ivHex, authTagHex, cipherTextHex] = encrypted.split(":");
    
    // Tamper with the last character of the ciphertext hex
    const lastChar = cipherTextHex[cipherTextHex.length - 1];
    const newLastChar = lastChar === "0" ? "1" : "0";
    const tamperedCipherTextHex = cipherTextHex.slice(0, -1) + newLastChar;
    
    const tamperedEncrypted = `${ivHex}:${authTagHex}:${tamperedCipherTextHex}`;
    
    expect(() => decrypt(tamperedEncrypted)).toThrow();
  });

  it("should throw an error if auth tag is tampered with", () => {
    const originalText = "sensitive-information";
    const encrypted = encrypt(originalText);
    const [ivHex, authTagHex, cipherTextHex] = encrypted.split(":");
    
    // Tamper with the auth tag
    const tamperedAuthTagHex = authTagHex.slice(0, -2) + "00";
    
    const tamperedEncrypted = `${ivHex}:${tamperedAuthTagHex}:${cipherTextHex}`;
    
    expect(() => decrypt(tamperedEncrypted)).toThrow();
  });
});
