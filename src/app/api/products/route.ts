import { NextRequest, NextResponse } from "next/server";
import { findProductByBarcode } from "@/lib/sql-server";
import type { Product } from "@/lib/types";

export const runtime = "nodejs";

const demoProduct: Product = {
  goodsKey: "10001",
  barcode: "8850000000012",
  skuKey: "501",
  skuCode: "WATER-600",
  skuName: "น้ำดื่มตัวอย่าง 600 มล.",
  unitKey: "1",
  unitName: "ขวด",
};

export async function GET(request: NextRequest) {
  const barcode = request.nextUrl.searchParams.get("barcode")?.trim();
  if (!barcode) return NextResponse.json({ message: "กรุณาระบุบาร์โค้ด" }, { status: 400 });
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json(barcode === demoProduct.barcode ? demoProduct : { ...demoProduct, barcode });
  }
  try {
    const product = await findProductByBarcode(barcode);
    if (!product) return NextResponse.json({ message: "ไม่พบรหัสสินค้าในฐานข้อมูล" }, { status: 404 });
    return NextResponse.json(product);
  } catch (error) {
    console.error("Product lookup failed", error);
    return NextResponse.json({ message: "ไม่สามารถค้นหาสินค้าจาก SQL Server ได้" }, { status: 503 });
  }
}
