import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
// The optional toolchain path keeps validation dependencies outside the submission.
const require = createRequire(
  process.env.DROWNED_LEDGER_TOOLCHAIN
    ? resolve(process.env.DROWNED_LEDGER_TOOLCHAIN, "package.json")
    : import.meta.url,
);
const ts = require("typescript");
const source = await readFile(
  new URL("../src/chain/chest.ts", import.meta.url),
  "utf8",
);
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const compiledModule = { exports: {} };
new Function("require", "module", "exports", output)(
  require,
  compiledModule,
  compiledModule.exports,
);
const c = compiledModule.exports;
const {
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  stringToHex,
} = require("viem");
const data = new Map();
globalThis.localStorage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
  removeItem: (key) => data.delete(key),
};
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
const address = "0x1111111111111111111111111111111111111111";
const chest = "0x2222222222222222222222222222222222222222";
assert.equal(c.normalizePhrase("  ONE\n TwO   three\t"), "one two three");
assert.equal(c.hashPhrase(" ONE  two "), keccak256(stringToHex("one two")));
assert.equal(c.revealWindow(100n, 99n), "waiting");
assert.equal(c.revealWindow(100n, 100n), "waiting");
assert.equal(c.revealWindow(100n, 101n), "ready");
assert.equal(c.revealWindow(100n, 356n), "ready");
assert.equal(c.revealWindow(100n, 357n), "expired");
const salt = c.randomSalt();
assert.match(salt, /^0x[0-9a-f]{64}$/);
assert.notEqual(salt, c.randomSalt());
const hash = c.commitmentHash(" ONE\n two ", address, salt);
assert.equal(
  hash,
  keccak256(
    encodeAbiParameters(parseAbiParameters("string,address,bytes32"), [
      "one two",
      address,
      salt,
    ]),
  ),
);
const pending = {
  account: address,
  chest,
  chainId: 1,
  phrase: "one two",
  salt,
  commitment: hash,
  commitTx: "0x" + "ab".repeat(32),
  commitBlock: "123",
};
c.savePending(pending);
assert.deepEqual(c.loadPending(1, chest, address), pending);
assert.equal(c.loadPending(2, chest, address), null);
assert.equal(
  c.loadPending(1, chest, "0x3333333333333333333333333333333333333333"),
  null,
);
data.set(
  [...data.keys()][0],
  JSON.stringify({ ...pending, salt: "0x" + "00".repeat(32) }),
);
assert.equal(c.loadPending(1, chest, address), null);
c.savePending(pending);
c.clearPending(pending);
assert.equal(c.loadPending(1, chest, address), null);
const setter = localStorage.setItem;
localStorage.setItem = () => {
  throw new Error("blocked");
};
assert.throws(() => c.savePending(pending), /cannot save your reveal salt/);
localStorage.setItem = setter;
assert.deepEqual(c.parseHolderIds("0, 1  1999,01,1"), [0n, 1n, 1999n]);
for (const bad of ["", "2000", "-1", "2.3", "2x", "1e2"])
  assert.throws(() => c.parseHolderIds(bad));
assert.equal(c.isClosed("0x" + "0".repeat(40)), true);
assert.equal(c.isClosed(address), false);
for (const name of [
  "AlreadyClaimed",
  "NoCommitment",
  "TooEarly",
  "TooLate",
  "WrongCommitment",
  "WrongPhrase",
  "EmptyChest",
  "NotLaunched",
  "BadTokenId",
]) {
  const message = c.plainError({ cause: { data: { errorName: name } } });
  assert(!message.includes(name), `${name} should have plain-language text`);
  assert(message.length > 25);
}
assert.match(c.plainError({ code: 4001 }), /declined/);
assert.match(c.plainError(new Error("insufficient funds")), /network fee/);
assert.match(c.plainError(new Error("wrong network")), /Wrong network/);
let chain = "0x1";
const calls = [];
globalThis.window = {
  ethereum: {
    request: async (args) => {
      calls.push(args);
      if (args.method === "eth_requestAccounts") return [address];
      if (args.method === "eth_chainId") return chain;
      if (args.method === "wallet_switchEthereumChain") {
        chain = args.params[0].chainId;
        return null;
      }
      throw new Error("unexpected RPC " + args.method);
    },
  },
};
const connection = await c.connectChest(10);
assert.equal(connection.account, address);
assert.equal(chain, "0xa");
assert(calls.some((call) => call.method === "wallet_switchEthereumChain"));
window.ethereum.request = async (args) => {
  if (args.method === "eth_requestAccounts") return [address];
  if (args.method === "eth_chainId") return "0x1";
  if (args.method === "wallet_switchEthereumChain") throw { code: 4001 };
};
await assert.rejects(c.connectChest(10), (error) => error.code === 4001);
window.ethereum = undefined;
await assert.rejects(c.connectChest(1), /No wallet was found/);
console.log(
  "PASS: normalization, ABI commitment, random salt, reveal window boundaries (0/1/256/257), account/chain-bound persistence, corruption/storage-block guards, holder ID parsing, all 9 contract errors, wallet rejection, network switch, and no-wallet recovery.",
);
console.log(
  "LIMITATION: mocked provider only; no deployed chest, mined transactions, public RPC, or real wallet approval was tested.",
);
