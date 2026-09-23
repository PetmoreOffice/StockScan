const assert = require("node:assert/strict");
const { mkdtemp, unlink, rmdir, readdir, writeFile, rm } = require("node:fs/promises");
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
      // 03:00Z is 10:00 in Bangkok, and the workbook shows Bangkok time.
      assert.equal(sheet.getRow(r).getCell(12).value.toISOString(), "2026-09-21T10:00:00.000Z");
    }
    assert.equal(sheet.getRow(1).getCell(1).value, "RecordID");
    assert.equal(sheet.getRow(1).getCell(1).font.bold, true);
  } finally {
    await unlink(filename).catch((error) => { if (error.code !== "ENOENT") throw error; });
    await rmdir(dir);
  }
});

test("dates read back as the day picked and the Bangkok time saved, whatever the server clock", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "scan-date-test-"));
  const originalTZ = process.env.TZ;
  const entry = { goodsKey: "1", barcode: "0001", skuCode: "001", skuName: "Test product", unitName: "piece", branchKey: "001", branchName: "Test branch", quantity: 1, expiryDate: "2026-09-21", savedBy: "tester", savedAt: "2026-09-21T08:41:00.000Z" };
  try {
    // A server left on UTC must not shift what operators read in the workbook.
    for (const zone of ["Asia/Bangkok", "UTC", "America/New_York"]) {
      process.env.TZ = zone;
      const filename = path.join(dir, `${zone.replace("/", "-")}.xlsx`);
      await sourceLoader({}, { process: { env: { EXCEL_FILE_PATH: filename } } })("@/lib/excel").appendScanToExcel(entry);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filename);
      const row = workbook.getWorksheet("ScanData").getRow(2);
      assert.equal(row.getCell(10).value.toISOString(), "2026-09-21T00:00:00.000Z", `expiry drifted under ${zone}`);
      assert.equal(row.getCell(12).value.toISOString(), "2026-09-21T15:41:00.000Z", `saved time drifted under ${zone}`);
      assert.equal(row.getCell(10).numFmt, "dd/mm/yyyy");
    }
  } finally {
    if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ;
    await rm(dir, { recursive: true, force: true });
  }
});

test("saves publish a copy to the share and survive one that cannot be written", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "scan-mirror-test-"));
  const master = path.join(dir, "master.xlsx");
  const mirror = path.join(dir, "share", "ScanData.xlsx");
  const entry = { goodsKey: "1", barcode: "0001", skuCode: "001", skuName: "Test product", unitName: "piece", branchKey: "001", branchName: "Test branch", quantity: 2, expiryDate: "2027-01-02", savedBy: "tester", savedAt: "2026-09-21T03:00:00.000Z" };
  const writerFor = (env, globals = {}) => sourceLoader({}, { ...globals, process: { env: { EXCEL_FILE_PATH: master, ...env } } })("@/lib/excel").appendScanToExcel;
  try {
    const append = writerFor({ EXCEL_MIRROR_PATH: mirror });
    assert.equal(await append(entry), true);
    assert.equal(await append({ ...entry, barcode: "0002" }), true);
    const published = new ExcelJS.Workbook();
    await published.xlsx.readFile(mirror);
    const sheet = published.getWorksheet("ScanData");
    assert.equal(sheet.rowCount, 3);
    assert.deepEqual([2, 3].map((row) => sheet.getRow(row).getCell(5).value), ["0001", "0002"]);
    // Readers must never find a half-copied staging file sitting in the share.
    assert.deepEqual(await readdir(path.dirname(mirror)), ["ScanData.xlsx"]);

    const blocker = path.join(dir, "blocked");
    await writeFile(blocker, "a file where a folder would have to be");
    const blockedAppend = writerFor({ EXCEL_MIRROR_PATH: path.join(blocker, "ScanData.xlsx") }, { console: { ...console, error() {} } });
    assert.equal(await blockedAppend({ ...entry, barcode: "0003" }), false);
    const kept = new ExcelJS.Workbook();
    await kept.xlsx.readFile(master);
    assert.deepEqual([2, 3, 4].map((row) => kept.getWorksheet("ScanData").getRow(row).getCell(5).value), ["0001", "0002", "0003"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
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
