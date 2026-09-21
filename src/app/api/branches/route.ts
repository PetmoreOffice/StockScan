import { NextRequest, NextResponse } from "next/server";
import { rejectUnauthorizedInventoryRequest } from "@/lib/server-auth";
import { listBranches } from "@/lib/sql-server";
import type { Branch } from "@/lib/types";

export const runtime = "nodejs";

const demoBranches: Branch[] = [
  { key: "001", name: "สำนักงานใหญ่" },
  { key: "002", name: "สาขาลาดพร้าว" },
  { key: "003", name: "สาขาบางนา" },
];

export async function GET(request: NextRequest) {
  const rejection = await rejectUnauthorizedInventoryRequest(request);
  if (rejection) return rejection;
  if (process.env.DEMO_MODE === "true") return NextResponse.json(demoBranches);
  try {
    return NextResponse.json(await listBranches());
  } catch (error) {
    console.error("Branch lookup failed", error);
    return NextResponse.json({ message: "ไม่สามารถอ่านข้อมูลสาขาจาก SQL Server ได้" }, { status: 503 });
  }
}
