// Local PIN/biometric lock utilities (client-side only)

const PIN_HASH_KEY = "ff-pin-hash";
const BIO_CRED_KEY = "ff-bio-cred-id";
const UNLOCKED_SESSION_KEY = "ff-unlocked";

export async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasPin(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(PIN_HASH_KEY);
}

export async function setPin(pin: string) {
  const hash = await sha256(pin);
  localStorage.setItem(PIN_HASH_KEY, hash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return true;
  const hash = await sha256(pin);
  return hash === stored;
}

export function removePin() {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(BIO_CRED_KEY);
}

export function isUnlockedThisSession(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(UNLOCKED_SESSION_KEY) === "1";
}

export function markUnlocked() {
  sessionStorage.setItem(UNLOCKED_SESSION_KEY, "1");
}

export function clearUnlocked() {
  sessionStorage.removeItem(UNLOCKED_SESSION_KEY);
}

// --- Biometric (WebAuthn) ---

export function biometricSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export function hasBiometric(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(BIO_CRED_KEY);
}

function randomBytes(len = 32) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return arr;
}

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

export async function registerBiometric(): Promise<boolean> {
  if (!biometricSupported()) return false;
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(),
        rp: { name: "Finance Flow" },
        user: {
          id: randomBytes(16),
          name: "user@finance-flow",
          displayName: "Finance Flow User",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(BIO_CRED_KEY, bufToB64(cred.rawId));
    return true;
  } catch (e) {
    console.warn("Biometric registration failed", e);
    return false;
  }
}

export async function authenticateBiometric(): Promise<boolean> {
  if (!biometricSupported() || !hasBiometric()) return false;
  try {
    const credId = localStorage.getItem(BIO_CRED_KEY)!;
    const result = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(),
        allowCredentials: [
          { type: "public-key", id: b64ToBuf(credId) },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!result;
  } catch (e) {
    console.warn("Biometric auth failed", e);
    return false;
  }
}

export function removeBiometric() {
  localStorage.removeItem(BIO_CRED_KEY);
}
