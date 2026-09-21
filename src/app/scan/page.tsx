"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleUserRound, Loader2, LogOut, ScanBarcode, UserRound, Wifi, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getInventoryToken, readInventorySession, signOutInventory } from "@/lib/firebase-auth";
import { lookupInventoryProduct } from "@/lib/inventory-client";
import type { Branch, Product } from "@/lib/types";

type Notice = { type: "success" | "error"; text: string } | null;

export default function ScanPage() {
  const router = useRouter();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchKey, setBranchKey] = useState("");
  const [savedBy, setSavedBy] = useState("");
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [expiryDate, setExpiryDate] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const selectedBranch = branches.find((branch) => branch.key === branchKey);

  useEffect(() => {
    const session = readInventorySession();
    if (!session) { router.replace("/"); return; }
    setAccountEmail(session.email);
    setReady(true);
    const storedUser = window.localStorage.getItem("scan-saved-by");
    if (storedUser) setSavedBy(storedUser);
    void fetch("/api/branches")
      .then(async (response) => { if (!response.ok) throw new Error((await response.json()).message); return response.json() as Promise<Branch[]>; })
      .then(setBranches)
      .catch((error: Error) => setNotice({ type: "error", text: error.message }));
  }, [router]);

  function signOut() { signOutInventory(); router.replace("/"); }

  async function lookupProduct(value = barcode) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLoadingProduct(true);
    setNotice(null);
    try {
      const foundProduct = await lookupInventoryProduct(trimmed, await getInventoryToken());
      setProduct(foundProduct);
      setBarcode(trimmed);
      setNotice({ type: "success", text: "พบสินค้าแล้ว กรุณากรอกจำนวนและวันหมดอายุ" });
    } catch (error) {
      setProduct(null);
      setNotice({ type: "error", text: error instanceof Error ? error.message : "ค้นหาสินค้าไม่สำเร็จ" });
      if (!readInventorySession()) router.replace("/");
    } finally { setLoadingProduct(false); }
  }

  async function saveScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBranch || !product || !savedBy.trim()) { setNotice({ type: "error", text: "กรุณาเลือกสาขา สแกนสินค้า และระบุชื่อผู้บันทึก" }); return; }
    setSaving(true);
    setNotice(null);
    window.localStorage.setItem("scan-saved-by", savedBy.trim());
    try {
      const response = await fetch("/api/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...product, branchKey, branchName: selectedBranch.name, quantity, expiryDate, savedBy: savedBy.trim() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "บันทึกไม่สำเร็จ");
      setNotice({ type: "success", text: "บันทึกลง Excel สำเร็จ พร้อมสแกนรายการถัดไป" });
      setBarcode(""); setProduct(null); setQuantity("1"); setExpiryDate("");
      window.setTimeout(() => barcodeRef.current?.focus(), 50);
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ" }); } finally { setSaving(false); }
  }

  if (!ready) return <main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">กำลังเปิดหน้าสแกน…</main>;

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6"><div className="mx-auto max-w-xl space-y-4">
      <header className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-lg shadow-slate-950/15"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-blue-200">WAREHOUSE INTAKE</p><h1 className="mt-1 text-xl font-bold">ระบบสแกนสินค้า</h1></div><div className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-200"><Wifi className="h-3.5 w-3.5" /> Online</div></div><div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs text-slate-200"><span className="flex min-w-0 items-center gap-1.5"><UserRound className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{accountEmail}</span></span><button type="button" onClick={signOut} className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"><LogOut className="h-3.5 w-3.5" />ออกจากระบบ</button></div></header>
      {notice && <div className={`flex items-start gap-2 rounded-xl border px-3 py-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`} role="status">{notice.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}<span>{notice.text}</span></div>}
      <Card><CardHeader><CardTitle>ข้อมูลการบันทึก</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="branch">สาขา</Label><Select id="branch" value={branchKey} onChange={(event) => setBranchKey(event.target.value)}><option value="">เลือกสาขา</option>{branches.map((branch) => <option key={branch.key} value={branch.key}>{branch.name}</option>)}</Select></div><div className="space-y-2"><Label htmlFor="savedBy">ผู้บันทึก</Label><div className="relative"><CircleUserRound className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" /><Input id="savedBy" value={savedBy} onChange={(event) => setSavedBy(event.target.value)} placeholder="ชื่อหรือรหัสพนักงาน" className="pl-10" /></div></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ScanBarcode className="h-5 w-5 text-primary" />สแกนบาร์โค้ด</CardTitle></CardHeader><CardContent><div className="flex gap-2"><Input ref={barcodeRef} value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void lookupProduct(); } }} placeholder="กดปุ่ม Scan ที่เครื่อง แล้วกด Enter" inputMode="numeric" autoFocus /><Button type="button" onClick={() => void lookupProduct()} disabled={loadingProduct} className="shrink-0">{loadingProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : "ค้นหา"}</Button></div></CardContent></Card>
      <form onSubmit={saveScan} className="space-y-4"><Card className={product ? "border-blue-200" : "opacity-80"}><CardHeader><CardTitle>ข้อมูลสินค้า</CardTitle></CardHeader><CardContent>{product ? <div className="grid gap-3 rounded-xl bg-blue-50 p-4 sm:grid-cols-2"><div className="sm:col-span-2"><p className="text-xs text-slate-500">ชื่อสินค้า</p><p className="mt-1 text-lg font-bold text-slate-900">{product.skuName}</p></div><div><p className="text-xs text-slate-500">บาร์โค้ด</p><p className="mt-1 font-mono text-sm">{product.barcode}</p></div><div><p className="text-xs text-slate-500">หน่วยนับ</p><p className="mt-1 font-semibold">{product.unitName}</p></div></div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">รอสแกนสินค้าเพื่อแสดงข้อมูล</p>}</CardContent></Card><Card><CardHeader><CardTitle>รายละเอียดรายการ</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="quantity">จำนวน</Label><Input id="quantity" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="expiryDate">วันหมดอายุ</Label><Input id="expiryDate" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></div><Button type="submit" size="lg" disabled={saving || !product} className="sm:col-span-2">{saving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />กำลังบันทึก</> : "บันทึกรายการลง Excel"}</Button></CardContent></Card></form>
      <p className="pb-4 text-center text-xs text-slate-500">ข้อมูลสินค้าอ่านจาก API กลาง และรายการใหม่บันทึกลง Excel ไฟล์กลาง</p>
    </div></main>
  );
}
