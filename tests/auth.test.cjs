const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");

function harness(fetchImpl, overrides = {}) {
  const storage = new Map();
  const cache = new Map();
  const context = vm.createContext({
    fetch: fetchImpl, Request, Response, Headers, AbortSignal, URLSearchParams,
    process: { env: { NEXT_PUBLIC_FIREBASE_API_KEY: "test-key", DEMO_MODE: "true" } },
    window: { localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    } },
    console,
  });
  function load(name) {
    if (name in overrides) return overrides[name];
    if (!name.startsWith("@/")) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.resolve(__dirname, "../src", `${name.slice(2)}.ts`);
    const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    vm.runInContext(`(function(require, module, exports) {${compiled}\n})`, context)(load, module, module.exports);
    return module.exports;
  }
  return { load, storage };
}

const sessionKey = "inventory-firebase-session";
const account = (email) => ({ email, idToken: "token", refreshToken: "refresh", expiresIn: "3600" });
const request = () => new Request("http://localhost/api/branches", { headers: { Authorization: "Bearer test-token" } });

test("domain policy matches exactly, case insensitively", () => {
  const { isAllowedInventoryEmail } = harness().load("@/lib/auth-policy");
  for (const email of ["user@newgenman.co.th", "user@petmoregroups.com", " User@NEWGENMAN.CO.TH "]) {
    assert.equal(isAllowedInventoryEmail(email), true, email);
  }
  for (const email of ["user@gmail.com", "user@sub.newgenman.co.th", "user@newgenman.co.th.evil.com", "user@fakepetmoregroups.com", "user@@newgenman.co.th", "@newgenman.co.th", "user name@petmoregroups.com", null]) {
    assert.equal(isAllowedInventoryEmail(email), false, String(email));
  }
});

test("disallowed login does not send credentials to Firebase", async () => {
  const { load } = harness(() => assert.fail("Unexpected network request"));
  await assert.rejects(load("@/lib/firebase-auth").signInInventory("user@gmail.com", "password"), /อนุญาตเฉพาะ/);
});

test("both allowed domains can sign in and reuse their session", async () => {
  for (const email of ["user@newgenman.co.th", "user@petmoregroups.com"]) {
    const { load } = harness(async (_url, init) => {
      assert.equal(JSON.parse(init.body).email, email);
      return Response.json(account(email));
    });
    const auth = load("@/lib/firebase-auth");
    await auth.signInInventory(` ${email} `, "password");
    assert.equal(auth.readInventorySession().email, email);
    assert.equal(await auth.getInventoryToken(), "token");
  }
});

test("Firebase response and old sessions cannot introduce another domain", async () => {
  const { load, storage } = harness(async () => Response.json(account("user@gmail.com")));
  const auth = load("@/lib/firebase-auth");
  await assert.rejects(auth.signInInventory("user@newgenman.co.th", "password"), /อนุญาตเฉพาะ/);
  assert.equal(storage.has(sessionKey), false);
  storage.set(sessionKey, JSON.stringify({ ...account("user@gmail.com"), expiresAt: Date.now() + 3600000 }));
  assert.equal(auth.readInventorySession(), null);
  assert.equal(storage.has(sessionKey), false);
  await assert.rejects(auth.getInventoryToken(), /เข้าสู่ระบบ/);
});

test("API uses Firebase account identity and fails closed", async () => {
  const cases = [
    [200, { users: [{ email: "user@newgenman.co.th" }] }, null],
    [200, { users: [{ email: "user@petmoregroups.com" }] }, null],
    [200, { users: [{ email: "user@gmail.com" }] }, 403],
    [200, { users: [{ email: "user@newgenman.co.th", disabled: true }] }, 401],
    [200, { users: [] }, 401],
    [400, { error: { message: "INVALID_ID_TOKEN" } }, 401],
    [400, { error: { message: "TOKEN_EXPIRED" } }, 401],
    [503, { error: { message: "UNAVAILABLE" } }, 503],
  ];
  for (const [status, payload, expected] of cases) {
    const { load } = harness(async (url, init) => {
      assert.match(url, /accounts:lookup\?key=test-key$/);
      assert.deepEqual(JSON.parse(init.body), { idToken: "test-token" });
      assert.equal(init.cache, "no-store");
      return Response.json(payload, { status });
    });
    const result = await load("@/lib/server-auth").rejectUnauthorizedInventoryRequest(request());
    assert.equal(result?.status ?? null, expected);
  }
  const { load } = harness(async () => { throw new Error("Network down"); });
  const guard = load("@/lib/server-auth").rejectUnauthorizedInventoryRequest;
  assert.equal((await guard(request())).status, 503);
  assert.equal((await guard(new Request("http://localhost"))).status, 401);
});

test("all data routes reject unauthenticated and disallowed users before accessing data", async () => {
  for (const withToken of [false, true]) {
    const { load } = harness(async () => Response.json({ users: [{ email: "user@gmail.com" }] }), {
      "@/lib/sql-server": { listBranches: () => assert.fail("SQL must not be called") },
      "@/lib/excel": { appendScanToExcel: () => assert.fail("Excel must not be written"), readScanReport: () => assert.fail("Report must not be read") },
    });
    for (const [name, method] of [["branches", "GET"], ["products", "GET"], ["scans", "POST"], ["reports", "GET"]]) {
      const req = new Request(`http://localhost/api/${name}?barcode=123`, {
        method, headers: withToken ? { Authorization: "Bearer test-token" } : {},
      });
      req.nextUrl = new URL(req.url);
      assert.equal((await load(`@/app/api/${name}/route`)[method](req)).status, withToken ? 403 : 401);
    }
  }
});

test("scan writes require a valid Firebase token from an allowed domain", async () => {
  for (const [firebaseStatus, identity, expected] of [
    [400, { error: { message: "TOKEN_EXPIRED" } }, 401],
    [400, { error: { message: "INVALID_ID_TOKEN" } }, 401],
    [200, { users: [{ email: "user@gmail.com" }] }, 403],
    [200, { users: [{ email: "user@newgenman.co.th" }] }, 200],
    [200, { users: [{ email: "user@petmoregroups.com" }] }, 200],
  ]) {
    const writes = [];
    const { load } = harness(async () => Response.json(identity, { status: firebaseStatus }), {
      "@/lib/excel": { appendScanToExcel: async (entry) => writes.push(entry) },
    });
    const req = new Request("http://localhost/api/scans", {
      method: "POST", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      body: JSON.stringify({ goodsKey: "1", barcode: "001", skuName: "Product", unitName: "piece", branchKey: "001", branchName: "Branch", quantity: 1, expiryDate: "2027-01-01", savedBy: "Operator" }),
    });
    assert.equal((await load("@/app/api/scans/route").POST(req)).status, expected);
    assert.equal(writes.length, expected === 200 ? 1 : 0);
  }
});
