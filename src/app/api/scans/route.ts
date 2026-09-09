import { NextRequest, NextResponse } from "next/server";
import { appendScanToExcel } from "@/lib/excel";
import type { ScanEntry } from "@/lib/types";

export const runtime = "nodejs";

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ScanEntry>;
    const quantity = Number(body.quantity);
    if (!body.branchKey || !body.branchName || !body.barcode || !body.savedBy || !body.goodsKey || !body.skuName || !body.unitName) {
      return NextResponse.json({ message: "ข้อมูลรายการไม่ครบถ้วน" }, { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ message: "จำนวนต้องมากกว่า 0" }, { status: 400 });
    }
    if (!isValidDate(body.expiryDate)) {
      return NextResponse.json({ message: "กรุณาระบุวันหมดอายุ" }, { status: 400 });
    }

    const entry: ScanEntry = {
      goodsKey: String(body.goodsKey),
      barcode: String(body.barcode),
      skuKey: String(body.skuKey ?? ""),
      skuCode: String(body.skuCode ?? ""),
      skuName: String(body.skuName),
      unitKey: String(body.unitKey ?? ""),
      unitName: String(body.unitName),
      branchKey: String(body.branchKey),
      branchName: String(body.branchName),
      quantity,
      expiryDate: body.expiryDate,
      savedBy: String(body.savedBy).trim(),
      savedAt: new Date().toISOString(),
    };

    await appendScanToExcel(entry);
    return NextResponse.json({ ok: true, savedAt: entry.savedAt });
  } catch (error) {
    console.error("Scan save failed", error);
    return NextResponse.json({ message: "ไม่สามารถบันทึกรายการลง Excel ได้" }, { status: 500 });
  }
}
