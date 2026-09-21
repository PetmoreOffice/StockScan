const assert = require("node:assert/strict");
const test = require("node:test");
const sourceLoader = require("./helpers/load-source.cjs");

test("report route returns an attachment, handles no data and read failures", async () => {
  for (const expected of [200, 404, 500]) {
    const load = sourceLoader({
      "@/lib/server-auth": { rejectUnauthorizedInventoryRequest: async () => null },
      "@/lib/excel": { readScanReport: async () => {
        if (expected === 500) throw new Error("File unavailable");
        return expected === 404 ? null : Buffer.from("report-bytes");
      } },
    }, { console: { error() {} } });
    const response = await load("@/app/api/reports/route").GET(new Request("http://localhost/api/reports"));
    assert.equal(response.status, expected);
    assert.match(response.headers.get("Cache-Control"), /no-store/);
    if (expected === 200) {
      assert.equal(response.headers.get("Content-Disposition"), 'attachment; filename="ScanData.xlsx"');
      assert.match(response.headers.get("Content-Type"), /spreadsheetml.sheet/);
      assert.equal(await response.text(), "report-bytes");
    } else {
      assert.equal(typeof (await response.json()).message, "string");
    }
  }
});

test("download sends auth, downloads the blob and releases the temporary URL", async () => {
  const actions = [];
  let cleanup;
  const link = { click() { actions.push("click"); }, remove() { actions.push("remove"); } };
  const load = sourceLoader({}, {
    fetch: async (url, options) => {
      assert.equal(url, "/api/reports");
      assert.equal(options.headers.Authorization, "Bearer valid-token");
      assert.equal(options.cache, "no-store");
      return new Response("report-bytes");
    },
    URL: {
      createObjectURL(blob) { assert.equal(blob.size, 12); return "blob:report"; },
      revokeObjectURL(url) { assert.equal(url, "blob:report"); actions.push("revoke"); },
    },
    document: { createElement: () => link, body: { appendChild(node) { assert.equal(node, link); actions.push("append"); } } },
    window: { setTimeout(callback) { cleanup = callback; } },
  });
  await load("@/lib/report-client").downloadScanReport("valid-token");
  assert.equal(link.download, "ScanData.xlsx");
  assert.equal(link.href, "blob:report");
  assert.deepEqual(actions, ["append", "click", "remove"]);
  cleanup();
  assert.equal(actions.at(-1), "revoke");
});

test("download errors show the API message without creating a file", async () => {
  const load = sourceLoader({}, {
    fetch: async () => Response.json({ message: "ยังไม่มีรายงาน" }, { status: 404 }),
    document: { createElement() { assert.fail("Should not start a download"); } },
  });
  await assert.rejects(load("@/lib/report-client").downloadScanReport("token"), /ยังไม่มีรายงาน/);
});
