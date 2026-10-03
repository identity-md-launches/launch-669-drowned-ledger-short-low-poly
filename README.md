# The Drowned Ledger

A procedural, low-poly fishing mystery in Marrow Bay. Built with Vite, React, TypeScript, React Three Fiber, Drei, Three.js and viem. Every model, texture, icon, illustration and sound is generated in code. No remote art, fonts, audio, backend or private configuration is required.

Open the [finished static export](dist/index.html) through an HTTP server. A second identical export is at `artifacts/site/index.html` for the delivery service.

## Install, run and publish

Use Node.js 22.12 or newer and npm 10.5.1 or newer.

```sh
npm ci
npm run dev
npm run typecheck
npm run build
npm run preview
npm run export
```

`build` typechecks and generates `dist/`. `export` also replaces `artifacts/site/` with the fresh build. Publish the **contents** of either export directory, including its `assets/` directory and `hunt.json`. Vite uses `base: './'`; there are no server routes. The browser inspection served the production export at `/preview/`, exercising subpath asset and hunt loading. Serve over HTTP(S); `file://` does not support the module/fetch workflow. Injected wallets normally require HTTPS or localhost.

The supplied source, lockfile and both exports are complete. Generated dependency folders, caches, source maps, archive copies and submodules are not part of this delivery. No ignore file was added or changed. During this worker run dependencies were installed in an isolated `/tmp` toolchain, and an exact source copy was built there, leaving repository `node_modules/` untouched. The published export needs no npm installation. Keep dependency folders out of any source submission at every nesting level.

## Play this chapter

- WASD or arrow keys: move and turn; drag the water to look; scroll to zoom.
- E: moor at the dock, visit the village or investigate nearby.
- Space: cast, then strike in the marked green interval. Three hits land a fish; three misses lose it.
- J / B / Q / M: journal, word bank, quests and chart. Escape closes a panel or pauses the voyage.
- Touch: steer with the stick and use the action buttons. The chart can mark a course for assisted sailing; manual steering takes over.
- Use the sound control to enable generated waves, wind, creaks, bells, drone, splashes and reel clicks.

Begin the crossing, fish the ripples and meet the five Pepe workers at the dock. A full game day lasts about eight active minutes; panels, pause and hidden tabs stop the voyage clock. The Glasseye Eel and Gumtooth Hagfish only bite at night. Dread rises at night away from shelter; at 100, you wake at the dock with an empty catch, retaining journal discoveries, quest history and words. Mooring lowers dread. The village lets you wait for night or rest until dawn.

The journal records six ordinary species and five strange fish. Every strange catch awards its source word once. Villagers first give a quest by dialogue and react when their requested fish is handed in. Seven puzzle sites are present, registered and tracked, with the requested **Coming soon** panels. They do not contain hidden solve buttons. Consequently the supplied base chapter cannot naturally collect all twelve words or finish the shrine. The 40–60 minute duration is the complete game's intended scope after the two later puzzle jobs; it has not been established for this base chapter.

Progress saves locally about every three seconds and when the page leaves; words and puzzle state save immediately. No account is needed. Clearing site data loses progress. With blocked storage, play continues in memory and the game warns where it cannot save. Commit is specifically blocked if its reveal salt cannot be saved.

## Runtime hunt data

`public/hunt.json` is the only source of deployment hunt values. The app fetches it at runtime with `fetch(import.meta.env.BASE_URL + "hunt.json")`; it is never imported into JavaScript. Vite copies it into each export.

| Field | Meaning |
| --- | --- |
| `words` | Exactly twelve single strings. The shipped values are the required numbered placeholders. Replace with the twelve game words, in any intended slot order. Lowercase real words are supported; duplicate words remain separate slots. |
| `sources` | Each of the twelve fixed source IDs maps to a unique integer slot from 0 through 11. The shipped slots follow the assignment's listed order. |
| `riddle` | Exactly twelve nonempty lines in the village's voice. Line k indirectly hints at `order[k]` through its fish or puzzle. |
| `order` | A permutation of all twelve source IDs. The intended phrase takes `words[sources[id]]` for each ID in this order. This is deployment data; the UI does not automatically reveal its solution. |
| `chest` | The chest contract address. The shipped zero address shows “The chest is not open yet” and sends no chain request. |
| `answerHash` | A bytes32 hex Keccak-256 hash of the normalized UTF-8 phrase. The shipped placeholder deliberately does not unlock a claim. |
| `chainId` | Positive integer network ID. It determines reads, wallet switching and transaction links. |

The fixed source IDs are `fish-1`, `fish-2`, `fish-3`, `fish-4`, `fish-5`, `deliveries`, `poker`, `minesweeper`, `key-lockbox`, `scale`, `fortune`, `jigsaw`.

To launch a real hunt, edit **only** `public/hunt.json`, with words, slot map, corresponding riddle/order, deployed chest, answer hash and chain ID. Generate the hash with viem's `keccak256(stringToHex(normalizePhrase(phrase)))`, where normalization trims, lowercases and collapses whitespace to one space; `src/chain/chest.ts` exports these helpers. Set the same hash in the deployed chest. Run validation and `npm run export` again, then publish. A static host can also replace the exported `hunt.json` directly, but keep source and both exports in sync. Refresh the game to load changed configuration. Saves contain source IDs rather than copies of old words, so remapped configuration resolves correctly.

`src/hunt/words.ts` exports `foundWord(sourceId)`, `isFound(sourceId)` and `useHunt()`. The latter exposes configuration, discovery-order bank, journal entries, toast and loading/error state. `initializeHunt()` fetches once and allows retry after a load failure. `foundWord` ignores unknown IDs and repeated finds, adds the configured word, creates a highlighted journal entry through the UI, shows the word toast and persists. No other game subsystem awards words.

## Plug in a puzzle

1. Create `src/puzzles/<id>/` and export a React component accepting `{ onSolved: () => void }`.
2. Use `usePuzzleState(id, initial)` from `src/puzzles/registry.ts` to store serializable progress. Its API is the same two-element state/setter tuple as React state and supports functional updates and lazy initial values. The helper isolates storage by puzzle ID; validate saved puzzle-specific data inside the future puzzle when necessary.
3. Call `onSolved()` only after the puzzle validates success. The host calls `foundWord(id)`; repeated callbacks are safe.
4. Import the component and replace that entry's `component` in **`src/puzzles/registry.ts`**, the only puzzle wiring point. Each entry also owns the title, site name, world `x/y/z`, and `nightOnly` flag. Both world markers and quest/site lists derive from this registry. The existing physical site scenery is already present.
5. Rebuild and check the marker, panel, save/resume and word award. Puzzle styles can reuse the modal, button, notice and field patterns described in `DESIGN.md`.

Keep hunt words, answer ordering, hash and chest values out of puzzle code. Do not add a separate word award path.

## Shrine and Ledger

The stone shrine appears on the far shore only with all twelve words and at night. Approach it or investigate its marker to read the twelve-line riddle, arrange words with earlier/later buttons, or type a phrase. The local hash check must pass before committing. The optional chain sequence is:

1. Connect an injected EIP-1193 wallet and switch to configured `chainId`.
2. Generate a cryptographically random 32-byte salt and persist it before any send. Commit `keccak256(abi.encode(normalizedPhrase, account, salt))` with `(string,address,bytes32)` encoding.
3. Wait for mining and at least one more block. Reveal is allowed through commit block +256; afterward recommit.
4. Reveal the normalized phrase with the saved salt. Reconnect after reload to recover an existing commitment. Never clear site data between commit and reveal.

The panel retains transaction links and maps all nine specified chest errors, wallet rejection, wrong network and transport errors into readable text. Transaction signing remains in the wallet.

After `claimed()` is true, both shrine and word-bank Ledger show winner, `dl()`, `pair()` and its token reserves. Each identity NFT ID 0–1999 can receive 50,000 DL once, paid to its current owner; anyone can trigger payment. “Claim holder shares” connects, scans all 2,000 `ownerOf` calls using batched multicalls when the field is empty, filters to the wallet's unclaimed IDs, and sends batches of at most 100. Manually entered IDs work and pay their owners. Earlier confirmed batches are preserved if a later batch fails.

Nine common networks have viem public RPC defaults. Other valid chain IDs can use the injected provider; the wallet must know that network. Holder scanning requires Multicall3 and the fixed identity collection to exist on that chain. Public RPC availability, real transaction gas, contract deployment and browser-wallet compatibility require deployment-specific verification.

## Checks and evidence

```sh
node test/check-hunt.mjs
node test/check-game.mjs
node test/check-chain.mjs
```

The worker ran the production build, independent TypeScript check and these tests successfully. The tests use real React/viem modules with in-memory storage and mocked RPC boundaries. Browser inspection and interaction checks exercised the actual production export at 1440×900, 820×1000, 390×844 and 320×740. See `artifacts/validation.md` for exact coverage, corrected findings, screenshots and limitations.

Live wallet approvals, public-chain transactions, a real deployed chest, physical devices, manual screen-reader use and a timed 40–60 minute playthrough were not tested. The supplied zero deployment and seven placeholder puzzles are intentional. Chain fixtures are test-only and never bundled in the website.

Design guidance and documentation attribution are in `docs/THIRD_PARTY_NOTICES.md` and `docs/INTERFACE-LICENSES.txt`.
