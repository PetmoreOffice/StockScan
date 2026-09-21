"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, ScanBarcode, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readInventorySession, signInInventory } from "@/lib/firebase-auth";
import { allowedEmailMessage } from "@/lib/auth-policy";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (readInventorySession()) {
      router.replace("/scan");
      return;
    }
    setCheckingSession(false);
  }, [router]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    setError("");
    try {
      await signInInventory(email.trim(), password);
      router.replace("/scan");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setSigningIn(false);
    }
  }

  if (checkingSession) return <main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">กำลังตรวจสอบการเข้าสู่ระบบ…</main>;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:grid sm:place-items-center sm:p-6">
      <section className="mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-900/10">
        <div className="bg-slate-950 px-7 py-8 text-white">
          <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30"><ScanBarcode className="h-6 w-6" /></div>
          <p className="text-xs font-semibold tracking-[0.14em] text-blue-200">WAREHOUSE INTAKE</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">ระบบสแกนสินค้า</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">เข้าสู่ระบบก่อนเริ่มสแกนและบันทึกรายการรับสินค้า</p>
        </div>
        <form onSubmit={signIn} className="space-y-5 p-7">
          <div className="space-y-2"><label htmlFor="email" className="text-sm font-semibold text-slate-800">อีเมล</label><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoFocus required placeholder="name@newgenman.co.th" aria-describedby="email-policy" /><p id="email-policy" className="text-xs leading-5 text-slate-500">{allowedEmailMessage}</p></div>
          <div className="space-y-2"><label htmlFor="password" className="text-sm font-semibold text-slate-800">รหัสผ่าน</label><Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required placeholder="รหัสผ่านของคุณ" /></div>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
          <Button type="submit" size="lg" disabled={signingIn} className="w-full">{signingIn ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />กำลังเข้าสู่ระบบ</> : <>เข้าสู่ระบบ<ArrowRight className="ml-2 h-5 w-5" /></>}</Button>
        </form>
        <div className="flex items-center gap-2 border-t bg-slate-50 px-7 py-4 text-xs leading-5 text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /><span>ใช้บัญชี Firebase เดียวกับระบบตรวจเช็ค SKU</span></div>
      </section>
    </main>
  );
}
