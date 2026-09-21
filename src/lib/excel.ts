import ExcelJS from "exceljs";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ScanEntry } from "@/lib/types";

const worksheetName = "ScanData";
let writeQueue: Promise<void> = Promise.resolve();

function workbookPath() {
  return resolve(process.env.EXCEL_FILE_PATH ?? "./data/ScanData.xlsx");
}

function setupWorksheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet(worksheetName) ?? workbook.addWorksheet(worksheetName);
  const columns = [
      { header: "RecordID", key: "recordId", width: 38 },
      { header: "BR_KEY", key: "branchKey", width: 14 },
      { header: "BR_THAIDESC", key: "branchName", width: 26 },
      { header: "GOODS_KEY", key: "goodsKey", width: 16 },
      { header: "GOODS_CODE", key: "barcode", width: 20 },
      { header: "SKU_CODE", key: "skuCode", width: 16 },
      { header: "SKU_NAME", key: "skuName", width: 32 },
      { header: "UTQ_NAME", key: "unitName", width: 16 },
      { header: "Quantity", key: "quantity", width: 12 },
      { header: "ExpiryDate", key: "expiryDate", width: 16 },
      { header: "SavedBy", key: "savedBy", width: 22 },
      { header: "SavedAt", key: "savedAt", width: 22 },
  ];
  if (sheet.rowCount === 0) {
    sheet.columns = columns;
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    header.alignment = { vertical: "middle" };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = "A1:L1";
  }
  // Excel files preserve cells and formatting, but not ExcelJS's object keys.
  // Rebind keys after every read without replacing existing headers or data.
  columns.forEach((column, index) => {
    sheet.getColumn(index + 1).key = column.key;
  });
  return sheet;
}

async function appendScan(entry: ScanEntry) {
  const filePath = workbookPath();
  await mkdir(dirname(filePath), { recursive: true });

  const workbook = new ExcelJS.Workbook();
  if (existsSync(filePath)) {
    await workbook.xlsx.readFile(filePath);
  }

  const sheet = setupWorksheet(workbook);
  const row = sheet.addRow({
    recordId: crypto.randomUUID(),
    branchKey: entry.branchKey,
    branchName: entry.branchName,
    goodsKey: entry.goodsKey,
    barcode: entry.barcode,
    skuCode: entry.skuCode,
    skuName: entry.skuName,
    unitName: entry.unitName,
    quantity: entry.quantity,
    expiryDate: entry.expiryDate ? new Date(`${entry.expiryDate}T00:00:00`) : null,
    savedBy: entry.savedBy,
    savedAt: new Date(entry.savedAt),
  });
  row.getCell("expiryDate").numFmt = "dd/mm/yyyy";
  row.getCell("savedAt").numFmt = "dd/mm/yyyy hh:mm:ss";
  row.alignment = { vertical: "middle" };

  await workbook.xlsx.writeFile(filePath);
}

export function appendScanToExcel(entry: ScanEntry) {
  const task = writeQueue.then(() => appendScan(entry));
  writeQueue = task.catch(() => undefined);
  return task;
}

export function readScanReport(): Promise<Buffer | null> {
  // Serialize the snapshot with writes so downloads never read a partial XLSX.
  const task = writeQueue.then(async () => {
    try {
      return await readFile(workbookPath());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  });
  writeQueue = task.then(() => undefined, () => undefined);
  return task;
}
