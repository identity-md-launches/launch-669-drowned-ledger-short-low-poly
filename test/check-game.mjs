import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(
  process.env.DROWNED_LEDGER_TOOLCHAIN
    ? resolve(process.env.DROWNED_LEDGER_TOOLCHAIN, "package.json")
    : import.meta.url,
);
const ts = require("typescript");
const source = ts.transpileModule(
  readFileSync(new URL("../src/game/data.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;
const game = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
let stored = null;
globalThis.localStorage = { getItem: () => stored };
const read = (value) => {
  stored = JSON.stringify(value);
  return game.readGame();
};

assert.deepEqual(read(null), game.INITIAL_GAME);
const first = game.readGame();
first.position.x = 100;
first.notes.push("mutation");
assert.deepEqual(read(null), game.INITIAL_GAME);
assert.notEqual(game.readGame().position, game.INITIAL_GAME.position);
assert.deepEqual(read([]), game.INITIAL_GAME);
assert.deepEqual(read("broken shape"), game.INITIAL_GAME);
stored = "{bad json";
assert.deepEqual(game.readGame(), game.INITIAL_GAME);

const recovered = read({
  position: { x: "Infinity", z: null, heading: "wrong" },
  elapsed: "Infinity",
  dread: "99",
  started: "true",
  dock: "false",
  inventory: [{}, null, 42, "fish-2", "fish-2", "unknown", "Mackerel"],
  caught: ["fish-1", {}, "fish-1", "Herring", "unknown"],
  accepted: [{}, "brannock", "brannock"],
  completed: ["gulla", "gulla", "unknown"],
  visited: ["poker", "poker", {}, ""],
  notes: ["one", {}, 12, "two"],
});
assert.deepEqual(recovered.position, game.INITIAL_GAME.position);
assert.equal(recovered.elapsed, game.INITIAL_GAME.elapsed);
assert.equal(recovered.dread, 0);
assert.equal(recovered.started, false);
assert.equal(recovered.dock, false);
assert.deepEqual(recovered.inventory, ["fish-2", "fish-2", "Mackerel"]);
assert.deepEqual(recovered.caught, ["fish-1", "Herring"]);
assert.deepEqual(recovered.accepted, ["brannock", "gulla"]);
assert.deepEqual(recovered.completed, ["gulla"]);
assert.deepEqual(recovered.visited, ["poker"]);
assert.deepEqual(recovered.notes, ["one", "two"]);
assert.equal(read({ elapsed: 0 }).elapsed, 0);
const bounded = read({
  position: { x: -999, z: 999, heading: -Math.PI },
  elapsed: 1e300,
  dread: 999,
});
assert.equal(bounded.position.x, -9);
assert.equal(bounded.position.z, 27);
assert.equal(bounded.position.heading, Math.PI);
assert.equal(bounded.dread, 99);
assert.ok(bounded.elapsed + 0.1 > bounded.elapsed);
assert.deepEqual(
  read({ dock: true, position: { x: 30, z: -20, heading: 0 } }).position,
  { x: -8, z: 5, heading: Math.PI / 2 },
);
globalThis.localStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
};
assert.deepEqual(game.readGame(), game.INITIAL_GAME);
assert.equal(game.getPhase(0), 0);
assert.equal(game.getPhase(480), 0);
assert.equal(game.getPhase(264), 0.55);
assert.equal(game.fishingHit(0.5, true), true);
assert.equal(game.fishingHit(0.5, false), true);
assert.equal(game.fishingHit(0.38, true), false);
assert.equal(game.fishingHit(0.38, false), true);
assert.equal(game.fishingHit(0.1, false), false);
assert.equal(game.distance({ x: 0, z: 0 }, { x: 3, z: 4 }), 5);
console.log(
  "PASS: malformed and denied game saves, fresh fallback isolation, numeric/boolean guards, world bounds, inventory/quest cleanup, zero clock, timing zones and day cycle.",
);

// React's real server renderer provides a hook dispatcher without a DOM package.
// Setters write to the real module store; subsequent renders observe that store.
const { createElement } = require("react");
const { renderToString } = require("react-dom/server");
const puzzleSource = readFileSync(
  new URL("../src/puzzles/usePuzzleState.ts", import.meta.url),
  "utf8",
);
const puzzleOutput = ts.transpileModule(puzzleSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;
const loadPuzzleModule = () => {
  const loaded = { exports: {} };
  new Function("require", "module", "exports", puzzleOutput)(
    require,
    loaded,
    loaded.exports,
  );
  return loaded.exports;
};
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
};
const puzzles = loadPuzzleModule();
const renderState = (module, id, initial) => {
  let result;
  function Probe() {
    result = module.usePuzzleState(id, initial);
    return createElement("output", null, JSON.stringify(result[0]));
  }
  const html = renderToString(createElement(Probe));
  assert(html.startsWith("<output>"));
  return result;
};

let initialCalls = 0;
const [alpha, setAlpha] = renderState(puzzles, "alpha", () => {
  initialCalls++;
  return { moves: 0 };
});
assert.deepEqual(alpha, { moves: 0 });
assert.equal(initialCalls, 1);
setAlpha((previous) => ({ moves: previous.moves + 1 }));
setAlpha((previous) => ({ moves: previous.moves + 1 }));
assert.deepEqual(
  renderState(puzzles, "alpha", () => {
    initialCalls++;
    return { moves: 99 };
  })[0],
  { moves: 2 },
);
assert.equal(initialCalls, 1);
const [beta, setBeta] = renderState(puzzles, "beta", { moves: 10 });
assert.deepEqual(beta, { moves: 10 });
setBeta({ moves: 12 });
assert.deepEqual(renderState(puzzles, "alpha", { moves: 99 })[0], { moves: 2 });
assert.deepEqual(renderState(puzzles, "beta", { moves: 99 })[0], { moves: 12 });
assert.equal(
  renderState(puzzles, "alpha", { moves: 99 })[0],
  renderState(puzzles, "alpha", { moves: 1 })[0],
);
assert.equal(
  memory.get("drowned-ledger:puzzle:alpha"),
  JSON.stringify({ moves: 2 }),
);
assert.equal(
  memory.get("drowned-ledger:puzzle:beta"),
  JSON.stringify({ moves: 12 }),
);
assert(
  [...memory.keys()].every((key) => key.startsWith("drowned-ledger:puzzle:")),
);

const reloadedPuzzles = loadPuzzleModule();
assert.deepEqual(renderState(reloadedPuzzles, "alpha", { moves: 0 })[0], {
  moves: 2,
});
assert.deepEqual(renderState(reloadedPuzzles, "beta", { moves: 0 })[0], {
  moves: 12,
});
memory.set("drowned-ledger:puzzle:malformed", "{bad json");
assert.deepEqual(renderState(reloadedPuzzles, "malformed", { moves: 3 })[0], {
  moves: 3,
});
globalThis.localStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};
const [blocked, setBlocked] = renderState(reloadedPuzzles, "blocked", {
  moves: 1,
});
assert.deepEqual(blocked, { moves: 1 });
setBlocked((previous) => ({ moves: previous.moves + 1 }));
assert.deepEqual(renderState(reloadedPuzzles, "blocked", { moves: 0 })[0], {
  moves: 2,
});
console.log(
  "PASS: actual React hook renders verify isolated/shared puzzle stores, lazy initialization, functional/direct updates, source-specific storage, reload, malformed storage and in-memory fallback.",
);
console.log(
  "LIMITATION: server-rendered hook snapshots; client subscription rerenders and browser storage events were not exercised by this test.",
);
