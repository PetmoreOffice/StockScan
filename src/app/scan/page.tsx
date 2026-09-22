"use client";
/*
THESIS: A handheld receiving instrument with the scan action as the entire first-viewport event.
OWN-WORLD: Ink navy fields, lime operational signal, coral attention states, shipping-label density.
STORY: Operator identifies themselves, scans, verifies the exact product, and records it without losing pace.
FIRST VIEWPORT: Identity strip, setup controls, then a full-width scan dock with the primary scan action at its base.
FORM: Single task lane for handhelds; Scan Signal direction, seeded 051afc03.
*/

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, CircleUserRound, Download, Loader2, LogOut, MapPin, PackageCheck, ScanBarcode, UserRound, Wifi, XCircle } from "lucide-react";
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
  const expiryDateRef = useRef<HTMLInputElement>(null);
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
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesUnavailable, setBranchesUnavailable] = useState(false);
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
    void loadBranches();
  }, [router]);

  useEffect(() => () => { lookupVersion.current += 1; }, []);

  function signOut() { lookupVersion.current += 1; signOutInventory(); router.replace("/"); }

  async function loadBranches() {
    setBranchesLoading(true);
    setBranchesUnavailable(false);
    try {
      const token = await getInventoryToken();
      const response = await fetch("/api/branches", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error((await response.json()).message);
      setBranches(await response.json() as Branch[]);
    } catch (error) {
      setBranchesUnavailable(true);
      setNotice({ type: "error", text: error instanceof Error ? error.message : "ไม่สามารถอ่านข้อมูลสาขาได้" });
      if (!readInventorySession()) router.replace("/");
    } finally {
      setBranchesLoading(false);
    }
  }

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

  function openExpiryDatePicker() {
    const input = expiryDateRef.current;
    if (!input || saving) return;
    input.focus();
    input.showPicker?.();
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
      // Saved either way: never imply failure, or staff rescan and duplicate the row.
      setNotice({ type: "success", text: payload.mirrored === false ? "บันทึกสำเร็จ แต่คัดลอกไปโฟลเดอร์ส่วนกลางไม่ได้ กรุณาแจ้ง MIS" : "บันทึกลง Excel สำเร็จ พร้อมสแกนรายการถัดไป" });
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

  if (!ready) return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">กำลังเปิดหน้าสแกน…</main>;

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-3 py-3 sm:px-6 sm:py-6"><div className="mx-auto max-w-3xl space-y-4">
      <header className="relative overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#071721] px-5 py-5 shadow-[0_20px_55px_rgba(0,0,0,.32)] sm:px-7">
        <div className="absolute inset-y-0 right-0 w-1/3 bg-primary/10 [clip-path:polygon(38%_0,100%_0,100%_100%,0_100%)]" />
        <div className="relative flex items-start justify-between gap-4"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold tracking-[.16em] text-primary"><span className={`h-2.5 w-2.5 rounded-full ${branchesUnavailable ? "bg-accent" : branchesLoading ? "bg-cyan-100/60" : "bg-primary shadow-[0_0_16px_hsl(77_100%_62%)]"}`} />SCAN SIGNAL</div><h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">ระบบสแกนสินค้า</h1><p className="mt-1 text-sm text-cyan-100/65">รับเข้าเร็ว ตรวจสอบชัด บันทึกได้ทันที</p></div><div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${branchesUnavailable ? "border-accent/40 bg-accent/10 text-orange-100" : branchesLoading ? "border-white/15 bg-white/5 text-cyan-100" : "border-primary/25 bg-primary/10 text-primary"}`}><Wifi className="h-4 w-4" />{branchesUnavailable ? "ต้องตรวจสอบ" : branchesLoading ? "กำลังเตรียม" : "พร้อมสแกน"}</div></div>
        <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm"><span className="flex min-w-0 items-center gap-2 text-cyan-50"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10"><UserRound className="h-4 w-4" /></span><span className="truncate">{accountEmail}</span></span><button type="button" onClick={signOut} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><LogOut className="h-4 w-4" />ออกจากระบบ</button></div>
      </header>
      {notice && <div className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm font-semibold ${notice.type === "success" ? "border-primary/40 bg-primary/10 text-primary" : "border-destructive/50 bg-destructive/10 text-red-100"}`} role={notice.type === "error" ? "alert" : "status"}>{notice.type === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}<span>{notice.text}</span>{branchesUnavailable && <button type="button" onClick={() => void loadBranches()} className="ml-auto shrink-0 rounded-lg border border-accent/45 px-2 py-1 text-xs font-bold text-orange-100">ลองใหม่</button>}</div>}
      <section className="relative overflow-hidden rounded-3xl border border-primary/40 bg-[#081c27] p-4 shadow-[0_20px_55px_rgba(0,0,0,.32)] sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-[.14em] text-primary">STEP 01 / SCAN</p><h2 className="mt-1 text-xl font-black text-white">สแกนบาร์โค้ดสินค้า</h2></div><ScanBarcode className="h-8 w-8 text-primary" /></div><div className="scan-field scan-sweep relative overflow-hidden rounded-2xl border border-primary/35 p-4 sm:p-6"><div className="relative z-10"><p className="mb-4 text-sm font-semibold text-cyan-50/80">วางเคอร์เซอร์ในช่อง แล้วกดปุ่ม Scan บนเครื่อง</p><Input ref={barcodeRef} value={barcode} disabled={saving} onChange={(event) => changeBarcode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void lookupProduct(); } }} placeholder="สแกน หรือกรอกบาร์โค้ด" inputMode="numeric" autoFocus className="h-16 border-primary/40 bg-slate-950/60 text-lg font-bold placeholder:text-cyan-50/35" /><Button type="button" size="lg" onClick={() => void lookupProduct()} disabled={loadingProduct || saving} className="mt-4 w-full text-lg">{loadingProduct ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />กำลังค้นหาสินค้า…</> : <><ScanBarcode className="mr-2 h-5 w-5" />ค้นหาจากบาร์โค้ด</>}</Button></div></div></section>
      <Card className="overflow-hidden"><CardHeader className="border-b border-border/70 bg-white/[.025]"><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />ตั้งค่ารายการรับเข้า</CardTitle><p className="text-sm text-muted-foreground">เลือกข้อมูลนี้หนึ่งครั้ง แล้วสแกนต่อเนื่องได้เลย</p></CardHeader><CardContent className="grid gap-4 pt-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="branch">สาขาปลายทาง</Label><Select id="branch" value={branchKey} disabled={branchesLoading} onChange={(event) => setBranchKey(event.target.value)}><option value="">{branchesLoading ? "กำลังโหลดสาขา…" : "เลือกสาขา"}</option>{branches.map((branch) => <option key={branch.key} value={branch.key}>{branch.name}</option>)}</Select></div><div className="space-y-2"><Label htmlFor="savedBy">ผู้บันทึกรายการ</Label><div className="relative"><CircleUserRound className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-primary" /><Input id="savedBy" value={savedBy} onChange={(event) => setSavedBy(event.target.value)} placeholder="ชื่อหรือรหัสพนักงาน" className="pl-12" /></div></div></CardContent></Card>
      <form onSubmit={saveScan} className="space-y-4"><Card className={product ? "border-primary/50" : "border-border/70"}><CardHeader className="border-b border-border/70"><CardTitle className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-primary" />ผลการสแกน</CardTitle></CardHeader><CardContent className="pt-5">{product ? <div className="grid gap-4 rounded-2xl bg-primary/[.09] p-5 sm:grid-cols-[1fr_auto]"><div><p className="text-xs font-bold tracking-[.12em] text-primary">พบสินค้าแล้ว</p><p className="mt-2 text-xl font-black text-white">{product.skuName}</p><p className="mt-3 font-mono text-sm text-cyan-100/80">{product.barcode}</p></div><div className="grid content-start gap-2 text-sm"><div className="rounded-xl bg-black/20 px-3 py-2"><span className="block text-xs text-muted-foreground">หน่วยนับ</span><strong>{product.unitName}</strong></div><div className="rounded-xl bg-black/20 px-3 py-2"><span className="block text-xs text-muted-foreground">รหัสสินค้า</span><strong>{product.skuCode || product.goodsKey}</strong></div></div></div> : <div className="rounded-2xl border border-dashed border-border bg-black/10 p-5 text-sm text-muted-foreground">รอข้อมูลสินค้า — ผลการสแกนจะแสดงตรงนี้ทันที</div>}</CardContent></Card><Card><CardHeader><CardTitle>รายละเอียดการรับเข้า</CardTitle></CardHeader><CardContent className="grid gap-4 pt-2 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="quantity">จำนวน</Label><Input id="quantity" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="expiryDate">วันหมดอายุ</Label><div className="relative"><Input ref={expiryDateRef} id="expiryDate" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} className="date-input" /><button type="button" aria-label="เลือกวันหมดอายุ" onClick={openExpiryDatePicker} disabled={saving} className="absolute inset-y-0 right-0 grid w-14 place-items-center text-white transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"><CalendarDays className="h-5 w-5" /></button></div></div><Button type="submit" size="lg" disabled={saving || loadingProduct || !product} className="mt-2 w-full sm:col-span-2">{saving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />กำลังบันทึกรายการ…</> : <><CheckCircle2 className="mr-2 h-5 w-5" />ยืนยันและบันทึกรายการ</>}</Button></CardContent></Card></form>
      <Card className="bg-[#0a202c]"><CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-white">รายงานรวมทุกคน</p><p className="mt-1 text-sm leading-6 text-muted-foreground">ดาวน์โหลด Excel ที่รวมทุกสาขา ทุกผู้บันทึก และทุกวัน</p></div><Button type="button" variant="outline" className="shrink-0" disabled={downloading || saving} onClick={() => void downloadReport()}>{downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{downloading ? "กำลังดึงรายงาน…" : "ดาวน์โหลด .xlsx"}</Button></CardContent>{reportNotice && <p role={reportNotice.type === "error" ? "alert" : "status"} className={`px-5 pb-5 text-sm font-semibold ${reportNotice.type === "error" ? "text-red-300" : "text-primary"}`}>{reportNotice.text}</p>}</Card>
      <p className="pb-4 text-center text-xs font-medium text-cyan-100/45">ข้อมูลสินค้าเชื่อมต่อ API กลาง • รายการใหม่บันทึกลง Excel ไฟล์กลาง</p>
    </div></main>
  );
}
