import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserKeyRecord } from '../types/connectx';

const DB_NAME = 'connectx_e2ee';
const STORE_NAME = 'keys';
const PRIVATE_KEY_ID = 'local_device_private_key';
const PUBLIC_KEY_ID = 'local_device_public_key';

/**
 * Open or create IndexedDB for non-extractable cryptographic key storage
 */
function openKeyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in current environment.'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store CryptoKey in IndexedDB
 */
async function storeKeyInIDB(id: string, key: CryptoKey): Promise<void> {
  const idb = await openKeyDatabase();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(key, id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve CryptoKey from IndexedDB
 */
async function getKeyFromIDB(id: string): Promise<CryptoKey | null> {
  const idb = await openKeyDatabase();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as CryptoKey) || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Converts ArrayBuffer to Base64
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 to Uint8Array
 */
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Formats a SHA-256 hash into an audible Safety Number fingerprint (e.g. CX-1234-5678-...)
 */
export async function generateSafetyNumber(publicKeyJwk: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(publicKeyJwk);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashBytes = new Uint8Array(hashBuffer);

  const chunks: string[] = [];
  for (let i = 0; i < 6; i++) {
    const val = (hashBytes[i * 4] << 8) | hashBytes[i * 4 + 1];
    chunks.push(String(val % 10000).padStart(4, '0'));
  }
  return `CX-${chunks.join('-')}`;
}

/**
 * Initializes or loads local ECDH cryptographic keypair for the authenticated user.
 * Non-extractable private key stays permanently on the device in IndexedDB.
 */
export async function getOrGenerateLocalKeyPair(uid: string): Promise<{
  publicKeyJwk: string;
  safetyNumber: string;
}> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Cryptography API is unavailable.');
  }

  // Check if keys already exist in IndexedDB
  const existingPrivateKey = await getKeyFromIDB(PRIVATE_KEY_ID);
  const existingPublicKey = await getKeyFromIDB(PUBLIC_KEY_ID);

  if (existingPrivateKey && existingPublicKey) {
    const exportedPublic = await crypto.subtle.exportKey('jwk', existingPublicKey);
    const jwkString = JSON.stringify(exportedPublic);
    const safetyNumber = await generateSafetyNumber(jwkString);
    return { publicKeyJwk: jwkString, safetyNumber };
  }

  // Generate new Curve P-256 ECDH KeyPair (Private key is non-extractable)
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // extractable public key
    ['deriveKey', 'deriveBits']
  );

  // Store locally
  await storeKeyInIDB(PRIVATE_KEY_ID, keyPair.privateKey);
  await storeKeyInIDB(PUBLIC_KEY_ID, keyPair.publicKey);

  const exportedPublic = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const jwkString = JSON.stringify(exportedPublic);
  const safetyNumber = await generateSafetyNumber(jwkString);

  // Publish public key to Cloud Firestore so other users can derive shared secrets
  if (uid) {
    try {
      const record: UserKeyRecord = {
        uid,
        publicKeyJwk: jwkString,
        safetyNumber,
        algorithm: 'ECDH-P256-AES-GCM-256',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'user_keys', uid), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Failed to publish public E2EE key to Firestore:', err);
    }
  }

  return { publicKeyJwk: jwkString, safetyNumber };
}

// In-memory cache for peer public keys to minimize Firestore reads
const peerKeyCache = new Map<string, CryptoKey>();

/**
 * Fetch and import peer user's public key from Firestore
 */
export async function getPeerPublicKey(peerUid: string): Promise<CryptoKey | null> {
  if (peerKeyCache.has(peerUid)) {
    return peerKeyCache.get(peerUid)!;
  }

  try {
    const snap = await getDoc(doc(db, 'user_keys', peerUid));
    if (!snap.exists()) return null;

    const data = snap.data();
    const jwk = JSON.parse(data.publicKeyJwk);

    const importedKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      []
    );

    peerKeyCache.set(peerUid, importedKey);
    return importedKey;
  } catch (err) {
    console.warn(`Could not load E2EE public key for peer ${peerUid}:`, err);
    return null;
  }
}

/**
 * Derives a shared AES-256-GCM symmetric key between sender private key and recipient public key
 */
async function deriveSharedKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: peerPublicKey,
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext message for a recipient using standard AES-256-GCM with random 96-bit IV
 */
export async function encryptDirectMessage(
  plaintext: string,
  recipientUid: string
): Promise<{
  ciphertext: string;
  iv: string;
  isEncrypted: boolean;
}> {
  try {
    const localPrivateKey = await getKeyFromIDB(PRIVATE_KEY_ID);
    if (!localPrivateKey) {
      return { ciphertext: plaintext, iv: '', isEncrypted: false };
    }

    const peerPublicKey = await getPeerPublicKey(recipientUid);
    if (!peerPublicKey) {
      // Peer has not yet published an E2EE public key
      return { ciphertext: plaintext, iv: '', isEncrypted: false };
    }

    const sharedKey = await deriveSharedKey(localPrivateKey, peerPublicKey);

    // Generate random 12-byte (96-bit) IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encodedText = encoder.encode(plaintext);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      sharedKey,
      encodedText
    );

    return {
      ciphertext: bufferToBase64(ciphertextBuffer),
      iv: bufferToBase64(iv.buffer),
      isEncrypted: true,
    };
  } catch (err) {
    console.warn('Encryption failed:', err);
    return { ciphertext: plaintext, iv: '', isEncrypted: false };
  }
}

/**
 * Decrypts an encrypted message using recipient's private key and sender's public key
 */
export async function decryptDirectMessage(
  ciphertextBase64: string,
  ivBase64: string,
  senderUid: string
): Promise<string> {
  try {
    const localPrivateKey = await getKeyFromIDB(PRIVATE_KEY_ID);
    if (!localPrivateKey) return '[Encrypted message - Key unavailable on this device]';

    const senderPublicKey = await getPeerPublicKey(senderUid);
    if (!senderPublicKey) return '[Encrypted message - Sender public key not found]';

    const sharedKey = await deriveSharedKey(localPrivateKey, senderPublicKey);
    const iv = base64ToBuffer(ivBase64);
    const ciphertext = base64ToBuffer(ciphertextBase64);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as ArrayBufferView,
      },
      sharedKey,
      ciphertext as unknown as ArrayBufferView
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.warn('Decryption failed:', err);
    return '[Decryption failed - Message key mismatch]';
  }
}
