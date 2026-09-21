"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, ScanBarcode, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readInventorySession, signInInventory } from "@/lib/firebase-auth";

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

  if (checkingSession) return <main className="grid min-h-screen place-items-center bg-background text-sm font-semibold text-muted-foreground">กำลังตรวจสอบการเข้าสู่ระบบ…</main>;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-8 sm:p-6">
      <section className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-cyan-100/15 bg-card shadow-[0_30px_80px_rgba(0,0,0,.45)]">
        <div className="scan-field scan-sweep relative overflow-hidden border-b border-primary/25 bg-[#071721] px-7 py-9 text-white">
          <div className="relative z-10"><div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_0_hsl(77_72%_38%)]"><ScanBarcode className="h-7 w-7" /></div><p className="text-xs font-bold tracking-[.16em] text-primary">SCAN SIGNAL / SECURE ACCESS</p><h1 className="mt-3 text-3xl font-black tracking-tight">ระบบสแกนสินค้า</h1><p className="mt-3 max-w-xs text-sm leading-6 text-cyan-50/70">เข้าสู่ระบบเพื่อเริ่มรับสินค้า และบันทึกรายการเข้าไฟล์กลาง</p></div>
        </div>
        <form onSubmit={signIn} className="space-y-5 p-7">
          <div className="space-y-2"><label htmlFor="email" className="text-sm font-bold text-foreground">อีเมลสำหรับเข้าใช้งาน</label><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoFocus required placeholder="กรุณากรอกอีเมล" /></div>
          <div className="space-y-2"><label htmlFor="password" className="text-sm font-bold text-foreground">รหัสผ่าน</label><Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required placeholder="กรอกรหัสผ่าน" /></div>
          {error && <p role="alert" className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm font-semibold text-red-100">{error}</p>}
          <Button type="submit" size="lg" disabled={signingIn} className="w-full">{signingIn ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />กำลังตรวจสอบ…</> : <>เข้าสู่ระบบและเริ่มสแกน<ArrowRight className="ml-2 h-5 w-5" /></>}</Button>
        </form>
        <div className="flex items-center gap-3 border-t border-border bg-black/10 px-7 py-4 text-xs leading-5 text-muted-foreground"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /><span>ข้อมูลสินค้าและรายงานได้รับการปกป้องด้วยบัญชีที่อนุญาต</span></div>
      </section>
    </main>
  );
}
