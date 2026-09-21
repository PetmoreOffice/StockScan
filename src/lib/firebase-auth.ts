import { allowedEmailMessage, isAllowedInventoryEmail } from "@/lib/auth-policy";

const sessionStorageKey = "inventory-firebase-session";

type StoredSession = {
  email: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
};

type FirebaseSignInResponse = {
  email: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  error?: { message?: string };
};

function apiKey() {
  const value = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!value) throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_FIREBASE_API_KEY");
  return value;
}

function save(session: StoredSession) {
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

export function readInventorySession(): StoredSession | null {
  try {
    const value = window.localStorage.getItem(sessionStorageKey);
    if (!value) return null;
    const session = JSON.parse(value) as StoredSession | null;
    if (!session || !isAllowedInventoryEmail(session.email)) {
      signOutInventory();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function signOutInventory() {
  window.localStorage.removeItem(sessionStorageKey);
}

export async function signInInventory(email: string, password: string): Promise<StoredSession> {
  email = email.trim();
  if (!isAllowedInventoryEmail(email)) throw new Error(allowedEmailMessage);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const payload = (await response.json()) as FirebaseSignInResponse;
  if (!response.ok || !payload.idToken) {
    throw new Error(payload.error?.message === "INVALID_LOGIN_CREDENTIALS" ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : "เข้าสู่ระบบ Firebase ไม่สำเร็จ");
  }
  if (!isAllowedInventoryEmail(payload.email)) {
    signOutInventory();
    throw new Error(allowedEmailMessage);
  }
  const session: StoredSession = {
    email: payload.email,
    idToken: payload.idToken,
    refreshToken: payload.refreshToken,
    expiresAt: Date.now() + Number(payload.expiresIn) * 1000,
  };
  save(session);
  return session;
}

export async function getInventoryToken(): Promise<string> {
  const current = readInventorySession();
  if (!current) throw new Error("กรุณาเข้าสู่ระบบก่อนค้นหาสินค้า");
  if (current.expiresAt > Date.now() + 60_000) return current.idToken;

  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: current.refreshToken }),
  });
  const payload = (await response.json()) as { id_token?: string; refresh_token?: string; expires_in?: string };
  if (!response.ok || !payload.id_token || !payload.refresh_token || !payload.expires_in) {
    signOutInventory();
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }
  const refreshed: StoredSession = {
    ...current,
    idToken: payload.id_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + Number(payload.expires_in) * 1000,
  };
  save(refreshed);
  return refreshed.idToken;
}
