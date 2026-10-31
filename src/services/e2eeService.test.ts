import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bufferToBase64,
  base64ToBuffer,
  generateSafetyNumber,
} from './e2eeService';

test('base64 encoding and decoding roundtrips binary buffers accurately', () => {
  const original = new Uint8Array([0, 255, 128, 42, 99, 17, 240]);
  const base64 = bufferToBase64(original.buffer);
  const recovered = base64ToBuffer(base64);

  assert.equal(recovered.length, original.length);
  for (let i = 0; i < original.length; i++) {
    assert.equal(recovered[i], original[i]);
  }
});

test('safety number generator creates standard CX-formatted 24-digit fingerprint', async () => {
  const mockJwk = JSON.stringify({
    kty: 'EC',
    crv: 'P-256',
    x: 'f83OJ3D2xFmT4vGLPJ-z34RiHiT9ndqJEC4GAE-zkKQ',
    y: 'x_daQauIfLHo35-dAgJSEu0DBDTN0HSgg5P5ct77WCA',
  });

  const safetyNumber = await generateSafetyNumber(mockJwk);
  assert.match(safetyNumber, /^CX(-\d{4}){6}$/);

  // Determinism check: same key produces identical safety number
  const safetyNumber2 = await generateSafetyNumber(mockJwk);
  assert.equal(safetyNumber, safetyNumber2);
});

test('Web Cryptography ECDH key agreement and AES-256-GCM cipher roundtrip', async () => {
  // Generate Alice's KeyPair
  const aliceKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  // Generate Bob's KeyPair
  const bobKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  // Alice derives shared AES-GCM key with Bob's public key
  const aliceSharedKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: bobKeyPair.publicKey },
    aliceKeyPair.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Bob derives shared AES-GCM key with Alice's public key
  const bobSharedKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: aliceKeyPair.publicKey },
    bobKeyPair.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Alice encrypts message
  const secretMessage = 'Secret message with ConnectX E2EE.';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aliceSharedKey,
    encoder.encode(secretMessage)
  );

  // Bob decrypts message using his derived key
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    bobSharedKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  const recoveredMessage = decoder.decode(decryptedBuffer);

  assert.equal(recoveredMessage, secretMessage);
});
