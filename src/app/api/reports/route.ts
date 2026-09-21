import { NextRequest, NextResponse } from "next/server";
import { readScanReport } from "@/lib/excel";
import { rejectUnauthorizedInventoryRequest } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rejection = await rejectUnauthorizedInventoryRequest(request);
  if (rejection) return rejection;
  try {
    const report = await readScanReport();
    if (!report) {
      return NextResponse.json({ message: "ยังไม่มีรายงาน กรุณาบันทึกรายการแรกก่อนดาวน์โหลด" }, {
        status: 404, headers: { "Cache-Control": "no-store" },
      });
    }
    return new NextResponse(new Uint8Array(report), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="ScanData.xlsx"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Report download failed", error);
    return NextResponse.json({ message: "ไม่สามารถอ่านรายงานได้ กรุณาลองใหม่อีกครั้ง" }, {
      status: 500, headers: { "Cache-Control": "no-store" },
    });
  }
}
