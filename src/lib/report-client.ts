export async function downloadScanReport(token: string): Promise<void> {
  const response = await fetch("/api/reports", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? "ดาวน์โหลดรายงานไม่สำเร็จ กรุณาลองใหม่");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = "ScanData.xlsx";
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Give the browser time to start reading the download before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
