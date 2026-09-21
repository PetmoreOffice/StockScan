import { NextResponse } from "next/server";
import { allowedEmailMessage, isAllowedInventoryEmail } from "@/lib/auth-policy";

// Ask Firebase for the account behind the token; never trust client-supplied email.
export async function rejectUnauthorizedInventoryRequest(request: Request): Promise<NextResponse | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const reject = (message: string, status: number) => NextResponse.json(
    { message }, { status, headers: { "Cache-Control": "no-store" } },
  );
  if (!token) return reject("กรุณาเข้าสู่ระบบก่อนใช้งาน", 401);
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return reject("ยังไม่ได้ตั้งค่า Firebase สำหรับตรวจสอบผู้ใช้", 503);

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json() as {
      users?: { email?: string; disabled?: boolean }[];
      error?: { message?: string };
    };
    if (!response.ok) {
      const invalidSession = ["INVALID_ID_TOKEN", "TOKEN_EXPIRED", "USER_DISABLED", "USER_NOT_FOUND"].includes(payload.error?.message ?? "");
      return invalidSession
        ? reject("เซสชันไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่", 401)
        : reject("ไม่สามารถตรวจสอบบัญชีกับ Firebase ได้ กรุณาลองใหม่", 503);
    }
    const user = payload.users?.[0];
    if (!user || user.disabled) return reject("บัญชีไม่สามารถใช้งานได้ กรุณาเข้าสู่ระบบใหม่", 401);
    if (!isAllowedInventoryEmail(user.email)) return reject(allowedEmailMessage, 403);
    return null;
  } catch {
    return reject("ไม่สามารถตรวจสอบบัญชีกับ Firebase ได้ กรุณาลองใหม่", 503);
  }
}
