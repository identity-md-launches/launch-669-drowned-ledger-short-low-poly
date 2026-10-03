import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const require = createRequire(
  process.env.DROWNED_LEDGER_TOOLCHAIN
    ? resolve(process.env.DROWNED_LEDGER_TOOLCHAIN, "package.json")
    : import.meta.url,
);
const ts = require("typescript");
const shipped = JSON.parse(
  readFileSync(new URL("../public/hunt.json", import.meta.url), "utf8"),
);
let source = ts.transpileModule(
  readFileSync(new URL("../src/hunt/words.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;
// Load the real React module; the non-React snapshot reader tests the same store
// used by useHunt without needing a browser renderer.
source = source.replace(
  /\bfrom\s+(["'])react\1/g,
  "from " + JSON.stringify(pathToFileURL(require.resolve("react")).href),
);
source = source.replace(
  /import\.meta\.env\.BASE_URL\s*\+\s*(["'])hunt\.json\1/g,
  JSON.stringify("/a/subpath/hunt.json"),
);
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};
let served = shipped;
let requested = "";
globalThis.fetch = async (url) => {
  requested = url;
  return { ok: true, json: async () => structuredClone(served) };
};
async function freshModule() {
  return import(
    "data:text/javascript;base64," +
      Buffer.from(source + `\n// ${Math.random()}`).toString("base64")
  );
}

const hunt = await freshModule();
await hunt.initializeHunt();
assert.equal(requested, "/a/subpath/hunt.json");
assert.equal(hunt.getHuntSnapshot().config.words.length, 12);
assert.equal(Object.keys(shipped.sources).length, 12);
assert.equal(hunt.foundWord("unlisted-source"), false);
assert.equal(hunt.foundWord("__proto__"), false);
assert.equal(hunt.foundWord("fish-3"), true);
assert.equal(hunt.foundWord("fish-3"), false);
assert.equal(hunt.isFound("fish-3"), true);
assert.deepEqual(hunt.getHuntSnapshot().words, [
  shipped.words[shipped.sources["fish-3"]],
]);
assert.equal(hunt.getHuntSnapshot().toast.message, "You found a word");
assert.equal(
  hunt.getHuntSnapshot().entries[0].word,
  shipped.words[shipped.sources["fish-3"]],
);
assert.equal(hunt.foundWord("fish-1"), true);
assert.deepEqual(hunt.getHuntSnapshot().words, [
  shipped.words[shipped.sources["fish-3"]],
  shipped.words[shipped.sources["fish-1"]],
]);
assert.equal(hunt.getHuntSnapshot().entries.length, 2);
const save = JSON.parse([...memory.values()][0]);
assert.deepEqual(Object.keys(save[0]).sort(), ["date", "sourceId"]);
hunt.getHuntSnapshot().dismissToast();
assert.equal(hunt.getHuntSnapshot().toast, null);

served = {
  ...structuredClone(shipped),
  words: [
    "cinder",
    "damp",
    "gull",
    "moss",
    "hollow",
    "silt",
    "keel",
    "moth",
    "weed",
    "brine",
    "wake",
    "ash",
  ],
};
[served.sources["fish-3"], served.sources.jigsaw] = [
  served.sources.jigsaw,
  served.sources["fish-3"],
];
const reload = await freshModule();
await reload.initializeHunt();
assert.deepEqual(reload.getHuntSnapshot().words, [
  served.words[served.sources["fish-3"]],
  served.words[served.sources["fish-1"]],
]);
assert.equal(reload.foundWord("fish-3"), false);
assert.equal(reload.foundWord("jigsaw"), true);
assert.deepEqual(reload.getHuntSnapshot().words, [
  served.words[served.sources["fish-3"]],
  served.words[served.sources["fish-1"]],
  served.words[served.sources.jigsaw],
]);
reload.getHuntSnapshot().dismissToast();

assert.throws(
  () =>
    hunt.validateHuntConfig({
      ...shipped,
      order: [...shipped.order.slice(1), shipped.order[1]],
    }),
  /every hunt source once/,
);
assert.throws(
  () =>
    hunt.validateHuntConfig({
      ...shipped,
      sources: { ...shipped.sources, jigsaw: shipped.sources["fish-1"] },
    }),
  /valid word slot/,
);
assert.throws(
  () =>
    hunt.validateHuntConfig({ ...shipped, riddle: shipped.riddle.slice(1) }),
  /twelve lines/,
);
assert.throws(
  () => hunt.validateHuntConfig({ ...shipped, chainId: -1 }),
  /network/,
);
assert.throws(
  () =>
    hunt.validateHuntConfig({
      ...shipped,
      words: ["two words", ...shipped.words.slice(1)],
    }),
  /single words/,
);

memory.clear();
const early = await freshModule();
early.foundWord("fish-5");
early.foundWord("unknown");
await early.initializeHunt();
assert.deepEqual(early.getHuntSnapshot().foundIds, ["fish-5"]);
early.getHuntSnapshot().dismissToast();

globalThis.localStorage = {
  getItem: () => {
    throw new Error("unavailable");
  },
  setItem: () => {
    throw new Error("unavailable");
  },
};
const privateMode = await freshModule();
await privateMode.initializeHunt();
assert.equal(privateMode.foundWord("fish-2"), true);
assert.equal(privateMode.isFound("fish-2"), true);
assert.match(privateMode.getHuntSnapshot().error, /could not save/);
privateMode.getHuntSnapshot().dismissToast();
console.log(
  "PASS: runtime subpath load, twelve configured words, unknown/duplicate awards, discovery order, source-only save, config remapping, invalid schema, pending awards, and denied storage.",
);
