import { NextRequest, NextResponse } from "next/server";
import { rejectUnauthorizedInventoryRequest } from "@/lib/server-auth";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const barcode = request.nextUrl.searchParams.get("barcode")?.trim();
  if (!barcode || barcode.length > 100) return NextResponse.json({ message: "กรุณาระบุบาร์โค้ดที่ถูกต้อง" }, { status: 400 });
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || !authorization.slice(7).trim()) {
    return NextResponse.json({ message: "กรุณาเข้าสู่ระบบก่อนค้นหาสินค้า" }, { status: 401 });
  }
  const base = (process.env.INVENTORY_API_URL || "http://127.0.0.1:3001/api/v1").replace(/\/+$/, "");
  const rejection = await rejectUnauthorizedInventoryRequest(request);
  if (rejection) return rejection;
  try {
    const upstream = await fetch(`${base}/products/scan/${encodeURIComponent(barcode)}`, {
      headers: { Authorization: authorization },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    return NextResponse.json(await upstream.json(), {
      status: upstream.status, headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ message: "เว็บเชื่อมต่อ API กลางไม่ได้ กรุณาตรวจ INVENTORY_API_URL และสถานะ API" }, { status: 502 });
  }
}
