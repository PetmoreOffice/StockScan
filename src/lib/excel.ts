import ExcelJS from "exceljs";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ScanEntry } from "@/lib/types";

const worksheetName = "ScanData";
let writeQueue: Promise<void> = Promise.resolve();

function workbookPath() {
  return resolve(process.env.EXCEL_FILE_PATH ?? "./data/ScanData.xlsx");
}

function mirrorPath() {
  const configured = process.env.EXCEL_MIRROR_PATH?.trim();
  return configured ? resolve(configured) : null;
}

// Publish a copy other departments can open. The master workbook stays local, so a
// share that is offline or locked by a reader must never fail a scan already saved.
async function mirrorWorkbook(source: string) {
  const target = mirrorPath();
  if (!target) return true;
  const staging = `${target}.tmp`;
  try {
    await mkdir(dirname(target), { recursive: true });
    // Copy aside then rename, so a reader never opens a half-written workbook.
    await copyFile(source, staging);
    await rename(staging, target);
    return true;
  } catch (error) {
    console.error("Excel mirror failed", target, error);
    await rm(staging, { force: true }).catch(() => undefined);
    return false;
  }
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

// Excel stores no timezone; it displays whatever the serial says, and ExcelJS builds
// that serial from a Date's UTC parts. So put Bangkok wall-clock time in those parts,
// or a save at 15:41 reads back as 08:41 wherever the workbook is opened.
function bangkokWallClock(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant).reduce<Record<string, string>>((all, part) => {
    all[part.type] = part.value;
    return all;
  }, {});
  return new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
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
    // A calendar date carries no time of day, so pin it to UTC midnight and let the
    // date-only format show it. Local midnight would shift it a day in either direction.
    expiryDate: entry.expiryDate ? new Date(`${entry.expiryDate}T00:00:00Z`) : null,
    savedBy: entry.savedBy,
    savedAt: bangkokWallClock(new Date(entry.savedAt)),
  });
  row.getCell("expiryDate").numFmt = "dd/mm/yyyy";
  row.getCell("savedAt").numFmt = "dd/mm/yyyy hh:mm:ss";
  row.alignment = { vertical: "middle" };

  await workbook.xlsx.writeFile(filePath);
  return mirrorWorkbook(filePath);
}

export function appendScanToExcel(entry: ScanEntry): Promise<boolean> {
  const task = writeQueue.then(() => appendScan(entry));
  writeQueue = task.then(() => undefined, () => undefined);
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
