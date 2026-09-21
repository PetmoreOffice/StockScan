const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

module.exports = function sourceLoader(overrides = {}, globals = {}) {
  const cache = new Map();
  const context = vm.createContext({ console, Date, crypto: require("node:crypto"), ...globals });
  function load(name) {
    if (name in overrides) return overrides[name];
    if (!name.startsWith("@/")) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    let filename = path.resolve(__dirname, "../../src", `${name.slice(2)}.ts`);
    if (!existsSync(filename)) filename += "x";
    const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    cache.set(name, module);
    vm.runInContext(`(function(require, module, exports) {${compiled}\n})`, context)(load, module, module.exports);
    return module.exports;
  }
  return load;
};
