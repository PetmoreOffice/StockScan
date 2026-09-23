const assert = require("node:assert/strict");
const test = require("node:test");
const sourceLoader = require("./helpers/load-source.cjs");

const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const product = (barcode) => ({ barcode, skuName: `Product ${barcode}`, goodsKey: barcode, unitName: "piece" });

// Drive the real page's event handlers with controlled hooks and network timing.
// Rendering is explicit so tests can also trigger two events before a re-render.
async function pageHarness() {
  const hooks = [];
  let cursor = 0;
  let effects = [];
  let tree;
  const lookups = [];
  const saves = [];
  const saveResponse = deferred();
  const router = { replace() {} };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], (value) => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect(effect) {
      const index = cursor++;
      if (!(index in hooks)) { hooks[index] = true; effects.push(effect); }
    },
  };
  const overrides = {
    react,
    "next/navigation": { useRouter: () => router },
    "@/lib/firebase-auth": { readInventorySession: () => ({ email: "user@newgenman.co.th" }), getInventoryToken: async () => "token", signOutInventory() {} },
    "@/lib/inventory-client": { lookupInventoryProduct: (barcode) => {
      const result = deferred(); lookups.push({ barcode, ...result }); return result.promise;
    } },
  };
  for (const [file, names] of Object.entries({ button: ["Button"], card: ["Card", "CardContent", "CardHeader", "CardTitle"], input: ["Input"], label: ["Label"], select: ["Select"] })) {
    overrides[`@/components/ui/${file}`] = Object.fromEntries(names.map((name) => [name, name]));
  }
  const Page = sourceLoader(overrides, {
    window: { localStorage: { getItem: () => null, setItem() {} }, setTimeout() {} },
    fetch: async (url, init) => {
      if (url === "/api/branches") return Response.json([{ key: "001", name: "Branch" }]);
      assert.equal(url, "/api/scans");
      saves.push({ body: JSON.parse(init.body), headers: init.headers });
      return saveResponse.promise;
    },
  })("@/app/scan/page").default;
  function render() {
    cursor = 0; tree = Page();
    const pending = effects; effects = []; pending.forEach((effect) => effect());
  }
  function find(predicate, node = tree) {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) return node.map((child) => find(predicate, child)).find(Boolean);
    if (predicate(node)) return node;
    return find(predicate, node.props?.children ?? null);
  }
  const barcodeInput = () => find((node) => node.props?.inputMode === "numeric");
  const saveButton = () => find((node) => node.props?.type === "submit");
  function change(value) { barcodeInput().props.onChange({ target: { value } }); render(); }
  function enter() { barcodeInput().props.onKeyDown({ key: "Enter", preventDefault() {} }); render(); }
  function submit() { return find((node) => node.type === "form").props.onSubmit({ preventDefault() {} }); }
  render(); await tick(); render();
  for (const [id, value] of [["branch", "001"], ["nickname", "อาย"], ["fullName", "กฤติยาภรณ์"], ["expiryDate", "2027-01-01"]]) {
    find((node) => node.props?.id === id).props.onChange({ target: { value } }); render();
  }
  return { render, find, lookups, saves, saveResponse, barcodeInput, saveButton, change, enter, submit };
}

test("editing a barcode clears the old product and blocks saving until the current lookup completes", async () => {
  const page = await pageHarness();
  page.change("A"); page.enter(); await tick();
  page.lookups[0].resolve(product("A")); await tick(); page.render();
  assert.equal(page.saveButton().props.disabled, false);
  page.change("B");
  assert.equal(page.saveButton().props.disabled, true);
  await page.submit();
  assert.equal(page.saves.length, 0);
  page.enter(); await tick();
  await page.submit();
  assert.equal(page.saves.length, 0);
  page.lookups[1].resolve(product("B")); await tick(); page.render();
  const save = page.submit();
  const duplicateSave = page.submit();
  await tick(); page.render();
  assert.equal(page.saves.length, 1);
  assert.equal(page.saves[0].body.barcode, "B");
  assert.equal(page.saves[0].body.savedBy, "อาย-กฤติยาภรณ์");
  assert.equal(page.saves[0].headers.Authorization, "Bearer token");
  assert.equal(page.barcodeInput().props.disabled, true);
  page.change("C"); page.enter(); await tick();
  assert.equal(page.lookups.length, 2);
  page.saveResponse.resolve(Response.json({ ok: true }));
  await Promise.all([save, duplicateSave]); page.render();
  assert.equal(page.barcodeInput().props.value, "");
  assert.equal(page.saveButton().props.disabled, true);
});

test("repeated Enter starts one request and a late old result cannot replace the latest product", async () => {
  const page = await pageHarness();
  page.change("A"); page.enter(); page.enter(); await tick();
  assert.equal(page.lookups.length, 1);
  page.change("B"); page.enter(); await tick();
  page.lookups[1].resolve(product("B")); await tick(); page.render();
  page.lookups[0].resolve(product("A")); await tick(); page.render();
  assert.equal(page.barcodeInput().props.value, "B");
  const save = page.submit(); await tick();
  assert.equal(page.saves[0].body.barcode, "B");
  page.saveResponse.resolve(Response.json({ ok: true })); await save;
});

test("a stale failure does not finish the newer lookup and clearing input invalidates pending results", async () => {
  const page = await pageHarness();
  page.change("A"); page.enter(); await tick();
  page.change("B"); page.enter(); await tick();
  page.lookups[0].reject(new Error("Old lookup failed")); await tick(); page.render();
  assert.equal(page.saveButton().props.disabled, true);
  assert.equal(page.find((node) => node.props?.type === "button" && node.type === "Button").props.disabled, true);
  page.change("");
  page.lookups[1].resolve(product("B")); await tick(); page.render();
  assert.equal(page.barcodeInput().props.value, "");
  assert.equal(page.saveButton().props.disabled, true);
  await page.submit();
  assert.equal(page.saves.length, 0);
});
