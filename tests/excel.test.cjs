const assert = require("node:assert/strict");
const { mkdtemp, unlink, rmdir } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const ExcelJS = require("exceljs");
const sourceLoader = require("./helpers/load-source.cjs");

test("Excel appends survive reloads and queued saves without losing rows or formatting", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "scan-excel-test-"));
  const filename = path.join(dir, "test.xlsx");
  const createWriter = () => sourceLoader({}, { process: { env: { EXCEL_FILE_PATH: filename } } })("@/lib/excel").appendScanToExcel;
  const entry = (barcode) => ({ goodsKey: "1", barcode, skuCode: "001", skuName: "Test product", unitName: "piece", branchKey: "001", branchName: "Test branch", quantity: 2, expiryDate: "2027-01-02", savedBy: "tester", savedAt: "2026-09-21T03:00:00.000Z" });
  try {
    const append = createWriter();
    await append(entry("0001"));
    const before = new ExcelJS.Workbook();
    await before.xlsx.readFile(filename);
    const firstRow = before.getWorksheet("ScanData").getRow(2).values;
    await append(entry("0002"));
    // A fresh module simulates restarting the server and reading an existing file.
    const restartedAppend = createWriter();
    await Promise.all([restartedAppend(entry("0003")), restartedAppend(entry("0004"))]);
    const after = new ExcelJS.Workbook();
    await after.xlsx.readFile(filename);
    const sheet = after.getWorksheet("ScanData");
    assert.equal(sheet.rowCount, 5);
    assert.deepEqual(sheet.getRow(2).values, firstRow);
    assert.deepEqual([2, 3, 4, 5].map((r) => sheet.getRow(r).getCell(5).value), ["0001", "0002", "0003", "0004"]);
    assert.equal(new Set([2, 3, 4, 5].map((r) => sheet.getRow(r).getCell(1).value)).size, 4);
    for (const r of [2, 3, 4, 5]) {
      assert.equal(sheet.getRow(r).getCell(9).value, 2);
      assert.equal(sheet.getRow(r).getCell(10).numFmt, "dd/mm/yyyy");
      assert.equal(sheet.getRow(r).getCell(12).value.toISOString(), "2026-09-21T03:00:00.000Z");
    }
    assert.equal(sheet.getRow(1).getCell(1).value, "RecordID");
    assert.equal(sheet.getRow(1).getCell(1).font.bold, true);
  } finally {
    await unlink(filename).catch((error) => { if (error.code !== "ENOENT") throw error; });
    await rmdir(dir);
  }
});

test("report snapshot includes all users and branches and is serialized between writes", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "scan-report-test-"));
  const filename = path.join(dir, "test.xlsx");
  const excel = sourceLoader({}, { process: { env: { EXCEL_FILE_PATH: filename } } })("@/lib/excel");
  const entry = { goodsKey: "1", barcode: "001", skuName: "Product", unitName: "piece", quantity: 1, expiryDate: "2027-01-01", savedAt: "2026-09-21T03:00:00Z" };
  try {
    assert.equal(await excel.readScanReport(), null);
    const first = excel.appendScanToExcel({ ...entry, branchKey: "001", branchName: "Branch A", savedBy: "Alice" });
    const second = excel.appendScanToExcel({ ...entry, branchKey: "002", branchName: "Branch B", savedBy: "Bob" });
    const snapshot = excel.readScanReport();
    const third = excel.appendScanToExcel({ ...entry, branchKey: "003", branchName: "Branch C", savedBy: "Carol" });
    await Promise.all([first, second, third]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await snapshot);
    const sheet = workbook.getWorksheet("ScanData");
    assert.equal(sheet.rowCount, 3);
    assert.deepEqual([2, 3].map((row) => sheet.getRow(row).getCell(11).value), ["Alice", "Bob"]);
    assert.deepEqual([2, 3].map((row) => sheet.getRow(row).getCell(2).value), ["001", "002"]);
    const latest = new ExcelJS.Workbook();
    await latest.xlsx.load(await excel.readScanReport());
    assert.equal(latest.getWorksheet("ScanData").rowCount, 4);
  } finally {
    await unlink(filename).catch((error) => { if (error.code !== "ENOENT") throw error; });
    await rmdir(dir);
  }
});
