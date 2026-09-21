"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleUserRound, Download, Loader2, LogOut, ScanBarcode, UserRound, Wifi, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getInventoryToken, readInventorySession, signOutInventory } from "@/lib/firebase-auth";
import { lookupInventoryProduct } from "@/lib/inventory-client";
import { downloadScanReport } from "@/lib/report-client";
import type { Branch, Product } from "@/lib/types";

type Notice = { type: "success" | "error"; text: string } | null;

export default function ScanPage() {
  const router = useRouter();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const lookupVersion = useRef(0);
  const pendingBarcode = useRef<string | null>(null);
  const matchedBarcode = useRef<string | null>(null);
  const savingRef = useRef(false);
  const downloadingRef = useRef(false);
  const [downloading, setDownloading] = useState(false);
  const [reportNotice, setReportNotice] = useState<Notice>(null);
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
    void getInventoryToken()
      .then((token) => fetch("/api/branches", { headers: { Authorization: `Bearer ${token}` } }))
      .then(async (response) => { if (!response.ok) throw new Error((await response.json()).message); return response.json() as Promise<Branch[]>; })
      .then(setBranches)
      .catch((error: Error) => {
        setNotice({ type: "error", text: error.message });
        if (!readInventorySession()) router.replace("/");
      });
  }, [router]);

  useEffect(() => () => { lookupVersion.current += 1; }, []);

  function signOut() { lookupVersion.current += 1; signOutInventory(); router.replace("/"); }

  function changeBarcode(value: string) {
    if (savingRef.current) return;
    lookupVersion.current += 1;
    pendingBarcode.current = null;
    matchedBarcode.current = null;
    setBarcode(value);
    setProduct(null);
    setLoadingProduct(false);
    setNotice(null);
  }

  async function lookupProduct(value = barcode) {
    const trimmed = value.trim();
    if (!trimmed || savingRef.current || pendingBarcode.current === trimmed) return;
    const version = ++lookupVersion.current;
    pendingBarcode.current = trimmed;
    matchedBarcode.current = null;
    setProduct(null);
    setLoadingProduct(true);
    setNotice(null);
    try {
      const token = await getInventoryToken();
      if (version !== lookupVersion.current) return;
      const foundProduct = await lookupInventoryProduct(trimmed, token);
      if (version !== lookupVersion.current) return;
      matchedBarcode.current = trimmed;
      setProduct(foundProduct);
      setBarcode(trimmed);
      setNotice({ type: "success", text: "พบสินค้าแล้ว กรุณากรอกจำนวนและวันหมดอายุ" });
    } catch (error) {
      if (version !== lookupVersion.current) return;
      setProduct(null);
      setNotice({ type: "error", text: error instanceof Error ? error.message : "ค้นหาสินค้าไม่สำเร็จ" });
      if (!readInventorySession()) router.replace("/");
    } finally {
      if (version === lookupVersion.current) {
        pendingBarcode.current = null;
        setLoadingProduct(false);
      }
    }
  }

  async function saveScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || pendingBarcode.current !== null) return;
    if (matchedBarcode.current !== barcode.trim()) { setNotice({ type: "error", text: "กรุณาค้นหาบาร์โค้ดปัจจุบันก่อนบันทึก" }); return; }
    if (!selectedBranch || !product || !savedBy.trim()) { setNotice({ type: "error", text: "กรุณาเลือกสาขา สแกนสินค้า และระบุชื่อผู้บันทึก" }); return; }
    savingRef.current = true;
    setSaving(true);
    setNotice(null);
    try {
      window.localStorage.setItem("scan-saved-by", savedBy.trim());
      const token = await getInventoryToken();
      const response = await fetch("/api/scans", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...product, branchKey, branchName: selectedBranch.name, quantity, expiryDate, savedBy: savedBy.trim() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "บันทึกไม่สำเร็จ");
      setNotice({ type: "success", text: "บันทึกลง Excel สำเร็จ พร้อมสแกนรายการถัดไป" });
      lookupVersion.current += 1;
      matchedBarcode.current = null;
      setBarcode(""); setProduct(null); setQuantity("1"); setExpiryDate("");
      window.setTimeout(() => barcodeRef.current?.focus(), 50);
    } catch (error) { setNotice({ type: "error", text: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ" }); } finally { savingRef.current = false; setSaving(false); }
  }

  async function downloadReport() {
    if (downloadingRef.current || savingRef.current) return;
    downloadingRef.current = true;
    setDownloading(true);
    setReportNotice(null);
    try {
      await downloadScanReport(await getInventoryToken());
      setReportNotice({ type: "success", text: "เริ่มดาวน์โหลดรายงาน ScanData.xlsx แล้ว" });
    } catch (error) {
      setReportNotice({ type: "error", text: error instanceof Error ? error.message : "ดาวน์โหลดรายงานไม่สำเร็จ" });
      if (!readInventorySession()) router.replace("/");
    } finally {
      downloadingRef.current = false;
      setDownloading(false);
    }
  }

  if (!ready) return <main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-500">กำลังเปิดหน้าสแกน…</main>;

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6"><div className="mx-auto max-w-xl space-y-4">
      <header className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-lg shadow-slate-950/15"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-blue-200">WAREHOUSE INTAKE</p><h1 className="mt-1 text-xl font-bold">ระบบสแกนสินค้า</h1></div><div className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-200"><Wifi className="h-3.5 w-3.5" /> Online</div></div><div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs text-slate-200"><span className="flex min-w-0 items-center gap-1.5"><UserRound className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{accountEmail}</span></span><button type="button" onClick={signOut} className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"><LogOut className="h-3.5 w-3.5" />ออกจากระบบ</button></div></header>
      {notice && <div className={`flex items-start gap-2 rounded-xl border px-3 py-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`} role="status">{notice.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}<span>{notice.text}</span></div>}
      <Card><CardHeader><CardTitle>ข้อมูลการบันทึก</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="branch">สาขา</Label><Select id="branch" value={branchKey} onChange={(event) => setBranchKey(event.target.value)}><option value="">เลือกสาขา</option>{branches.map((branch) => <option key={branch.key} value={branch.key}>{branch.name}</option>)}</Select></div><div className="space-y-2"><Label htmlFor="savedBy">ผู้บันทึก</Label><div className="relative"><CircleUserRound className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" /><Input id="savedBy" value={savedBy} onChange={(event) => setSavedBy(event.target.value)} placeholder="ชื่อหรือรหัสพนักงาน" className="pl-10" /></div></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ScanBarcode className="h-5 w-5 text-primary" />สแกนบาร์โค้ด</CardTitle></CardHeader><CardContent><div className="flex gap-2"><Input ref={barcodeRef} value={barcode} disabled={saving} onChange={(event) => changeBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void lookupProduct(); } }} placeholder="กดปุ่ม Scan ที่เครื่อง แล้วกด Enter" inputMode="numeric" autoFocus /><Button type="button" onClick={() => void lookupProduct()} disabled={loadingProduct || saving} className="shrink-0">{loadingProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : "ค้นหา"}</Button></div></CardContent></Card>
      <form onSubmit={saveScan} className="space-y-4"><Card className={product ? "border-blue-200" : "opacity-80"}><CardHeader><CardTitle>ข้อมูลสินค้า</CardTitle></CardHeader><CardContent>{product ? <div className="grid gap-3 rounded-xl bg-blue-50 p-4 sm:grid-cols-2"><div className="sm:col-span-2"><p className="text-xs text-slate-500">ชื่อสินค้า</p><p className="mt-1 text-lg font-bold text-slate-900">{product.skuName}</p></div><div><p className="text-xs text-slate-500">บาร์โค้ด</p><p className="mt-1 font-mono text-sm">{product.barcode}</p></div><div><p className="text-xs text-slate-500">หน่วยนับ</p><p className="mt-1 font-semibold">{product.unitName}</p></div></div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">รอสแกนสินค้าเพื่อแสดงข้อมูล</p>}</CardContent></Card><Card><CardHeader><CardTitle>รายละเอียดรายการ</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="quantity">จำนวน</Label><Input id="quantity" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="expiryDate">วันหมดอายุ</Label><Input id="expiryDate" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></div><Button type="submit" size="lg" disabled={saving || loadingProduct || !product} className="sm:col-span-2">{saving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />กำลังบันทึก</> : "บันทึกรายการลง Excel"}</Button></CardContent></Card></form>
      <Card>
        <CardHeader><CardTitle>รายงานรวมทุกคน</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-6 text-slate-600">ดาวน์โหลด Excel รวมรายการที่บันทึกแล้วของทุกคน ทุกสาขา และทุกวัน พร้อมชื่อผู้บันทึกและเวลาบันทึก</p>
          <Button type="button" variant="outline" className="w-full" disabled={downloading || saving} onClick={() => void downloadReport()}>
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {downloading ? "กำลังดึงรายงาน…" : "ดาวน์โหลดรายงานทั้งหมด (.xlsx)"}
          </Button>
          {reportNotice && <p role="status" className={`text-sm ${reportNotice.type === "error" ? "text-red-700" : "text-emerald-700"}`}>{reportNotice.text}</p>}
        </CardContent>
      </Card>
      <p className="pb-4 text-center text-xs text-slate-500">ข้อมูลสินค้าอ่านจาก API กลาง และรายการใหม่บันทึกลง Excel ไฟล์กลาง</p>
    </div></main>
  );
}
