import type { Product } from "@/lib/types";

type CentralProduct = {
  goodsKey: string | number;
  goodsCode: string;
  barcode: string;
  skuKey: string | number;
  sku: string;
  name: string;
  unitKey?: string | number;
  scannedUnit: string;
};

function apiBaseUrl() {
  const value = process.env.NEXT_PUBLIC_INVENTORY_API_URL?.replace(/\/$/, "");
  if (!value) throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_INVENTORY_API_URL");
  return value;
}

export async function lookupInventoryProduct(barcode: string, token: string): Promise<Product> {
  const response = await fetch(`${apiBaseUrl()}/products/scan/${encodeURIComponent(barcode)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json()) as CentralProduct & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? "ค้นหาสินค้าจาก API กลางไม่สำเร็จ");

  return {
    goodsKey: String(payload.goodsKey),
    // goodsCode is the barcode/unit code that matched the scan.
    barcode: String(payload.goodsCode ?? barcode),
    skuKey: String(payload.skuKey),
    skuCode: String(payload.sku),
    skuName: String(payload.name),
    unitKey: String(payload.unitKey ?? ""),
    unitName: String(payload.scannedUnit),
  };
}
