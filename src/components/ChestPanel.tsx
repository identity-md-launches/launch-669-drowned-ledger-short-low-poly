import { useEffect, useRef, useState } from "react";
import { formatUnits, isAddress, type Address, type Hex } from "viem";
import type { HuntConfig } from "../hunt/words";
import {
  chestAbi,
  clearPending,
  commitmentHash,
  connectChest,
  explorerUrl,
  hashPhrase,
  IDENTITY_COLLECTION,
  identityAbi,
  injectedProvider,
  isClosed,
  loadPending,
  normalizePhrase,
  pairAbi,
  parseHolderIds,
  plainError,
  randomSalt,
  readClient,
  revealWindow,
  savePending,
  tokenAbi,
  type ChestConnection,
  type PendingCommitment,
} from "../chain/chest";
import "./chest.css";

interface ChestPanelProps {
  config: HuntConfig;
  words: string[];
  shrine?: boolean;
}
interface LaunchInfo {
  winner: Address;
  dl: Address;
  pair: Address;
  reserves?: {
    values: readonly [bigint, bigint, number];
    tokens: readonly [Address, Address];
    decimals: number[];
    symbols: string[];
  };
}
type Transaction = { hash: Hex; label: string };

export function ChestPanel({ config, words, shrine = false }: ChestPanelProps) {
  const chest = config.chest as Address;
  const closed = isClosed(chest);
  const [phrase, setPhrase] = useState(words.join(" "));
  const [arrangement, setArrangement] = useState(words);
  const [verified, setVerified] = useState(false);
  const [connection, setConnection] = useState<ChestConnection | null>(null);
  const [pending, setPending] = useState<PendingCommitment | null>(null);
  const [block, setBlock] = useState<bigint | null>(null);
  const [launched, setLaunched] = useState(false);
  const [info, setInfo] = useState<LaunchInfo | null>(null);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [holderIds, setHolderIds] = useState("");
  const [holderError, setHolderError] = useState("");
  const [eligible, setEligible] = useState<bigint[] | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const phraseField = useRef<HTMLTextAreaElement>(null);
  const holderField = useRef<HTMLTextAreaElement>(null);
  const bankSignature = JSON.stringify(words);

  useEffect(() => {
    // Preserve an arrangement as more bank entries arrive, including repeated words.
    setArrangement((previous) => {
      const remaining = [...words];
      const kept = previous.filter((word) => {
        const index = remaining.indexOf(word);
        if (index < 0) return false;
        remaining.splice(index, 1);
        return true;
      });
      return [...kept, ...remaining];
    });
  }, [bankSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTransaction = (hash: Hex, label: string) =>
    setTransactions((previous) =>
      previous.some((tx) => tx.hash === hash)
        ? previous
        : [...previous, { hash, label }],
    );

  async function refresh(using = connection) {
    if (closed) return;
    if (!isAddress(chest))
      throw new Error(
        "The chest address in hunt.json is invalid. The village keeper must update it.",
      );
    const client = using?.public ?? readClient(config.chainId);
    const claimed = await client.readContract({
      address: chest,
      abi: chestAbi,
      functionName: "claimed",
    });
    setLaunched(claimed);
    if (!claimed) return;
    const [winner, dl, pair] = await Promise.all([
      client.readContract({
        address: chest,
        abi: chestAbi,
        functionName: "winner",
      }),
      client.readContract({
        address: chest,
        abi: chestAbi,
        functionName: "dl",
      }),
      client.readContract({
        address: chest,
        abi: chestAbi,
        functionName: "pair",
      }),
    ]);
    const next: LaunchInfo = { winner, dl, pair };
    setInfo(next);
    if (!isClosed(pair)) {
      const [values, token0, token1] = await Promise.all([
        client.readContract({
          address: pair,
          abi: pairAbi,
          functionName: "getReserves",
        }),
        client.readContract({
          address: pair,
          abi: pairAbi,
          functionName: "token0",
        }),
        client.readContract({
          address: pair,
          abi: pairAbi,
          functionName: "token1",
        }),
      ]);
      const metadata = await Promise.allSettled([
        client.readContract({
          address: token0,
          abi: tokenAbi,
          functionName: "decimals",
        }),
        client.readContract({
          address: token1,
          abi: tokenAbi,
          functionName: "decimals",
        }),
        client.readContract({
          address: token0,
          abi: tokenAbi,
          functionName: "symbol",
        }),
        client.readContract({
          address: token1,
          abi: tokenAbi,
          functionName: "symbol",
        }),
      ]);
      const decimals = metadata
        .slice(0, 2)
        .map((item) => (item.status === "fulfilled" ? Number(item.value) : 0));
      const symbols = metadata
        .slice(2)
        .map((item, index) =>
          item.status === "fulfilled"
            ? String(item.value)
            : `token ${index} (raw units)`,
        );
      setInfo({
        ...next,
        reserves: { values, tokens: [token0, token1], decimals, symbols },
      });
    }
  }

  useEffect(() => {
    if (closed) return;
    void refresh(null).catch((reason) => setError(plainError(reason)));
    const timer = window.setInterval(() => {
      void refresh(null).catch((reason) => setError(plainError(reason)));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [config.chainId, chest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const provider = injectedProvider() as unknown as
      | {
          on?: (event: string, callback: () => void) => void;
          removeListener?: (event: string, callback: () => void) => void;
        }
      | undefined;
    const changed = () => {
      setConnection(null);
      setPending(null);
      setEligible(null);
      setBlock(null);
      setStatus(
        "Your wallet account or network changed. Connect again before the next transaction.",
      );
    };
    provider?.on?.("accountsChanged", changed);
    provider?.on?.("chainChanged", changed);
    return () => {
      provider?.removeListener?.("accountsChanged", changed);
      provider?.removeListener?.("chainChanged", changed);
    };
  }, []);

  useEffect(() => {
    if (!connection || !pending?.commitBlock) return;
    let active = true;
    const update = () =>
      connection.public
        .getBlockNumber({ cacheTime: 0 })
        .then((value) => {
          if (active) setBlock(value);
        })
        .catch((reason) => {
          if (active) setError(plainError(reason));
        });
    void update();
    const timer = window.setInterval(() => {
      void update();
    }, 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [connection, pending?.commitBlock]);

  async function run(label: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setError("");
    setStatus("");
    try {
      await action();
    } catch (reason) {
      setError(plainError(reason));
    } finally {
      setBusy("");
    }
  }

  async function connect() {
    const next = await connectChest(config.chainId);
    setConnection(next);
    const saved = loadPending(config.chainId, chest, next.account);
    if (saved) {
      setPending(saved);
      setPhrase(saved.phrase);
      setVerified(
        hashPhrase(saved.phrase).toLowerCase() ===
          config.answerHash.toLowerCase(),
      );
      if (saved.commitTx) addTransaction(saved.commitTx, "Commitment");
      if (saved.revealTx) addTransaction(saved.revealTx, "Reveal");
      const [onChainHash, onChainBlock] = await next.public.readContract({
        address: chest,
        abi: chestAbi,
        functionName: "commitments",
        args: [next.account],
      });
      if (
        onChainHash.toLowerCase() === saved.commitment.toLowerCase() &&
        onChainBlock > 0n
      ) {
        const recovered = { ...saved, commitBlock: onChainBlock.toString() };
        savePending(recovered);
        setPending(recovered);
        setBlock(await next.public.getBlockNumber({ cacheTime: 0 }));
        setStatus(
          "Your saved commitment is restored. Keep this browser’s data until the reveal is complete.",
        );
      } else {
        setStatus(
          "Your reveal salt is saved. If your transaction is still pending, wait and recover it before sending another.",
        );
      }
    } else setStatus("Wallet connected. Your account is ready.");
    await refresh(next);
    return next;
  }

  function editPhrase(value: string) {
    setPhrase(value);
    setVerified(false);
    setError("");
  }
  function moveWord(index: number, direction: number) {
    const next = [...arrangement];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setArrangement(next);
    editPhrase(next.join(" "));
  }
  function checkPhrase() {
    setError("");
    setStatus("");
    if (hashPhrase(phrase).toLowerCase() !== config.answerHash.toLowerCase()) {
      setVerified(false);
      setError("the bay does not answer");
      phraseField.current?.focus();
      return;
    }
    setPhrase(normalizePhrase(phrase));
    setVerified(true);
    setStatus(
      "The stone remembers. Your phrase is correct. Connect a wallet to open the chest.",
    );
  }

  async function commit() {
    if (!connection) throw new Error("Connect your wallet first.");
    if (closed) throw new Error("The chest is not open yet.");
    const normalized = normalizePhrase(phrase);
    if (
      hashPhrase(normalized).toLowerCase() !== config.answerHash.toLowerCase()
    )
      throw new Error("the bay does not answer");
    if (pending?.commitTx && !pending.commitBlock) {
      // Never replace a salt while its accepted transaction may still be pending.
      let receipt;
      try {
        receipt = await connection.public.getTransactionReceipt({
          hash: pending.commitTx,
        });
      } catch {
        throw new Error(
          "Your commitment may still be pending. Use Recover / check block and check its transaction link before sending again.",
        );
      }
      if (receipt.status === "success") {
        await recover();
        return;
      }
    }
    // Recover the same hash/salt after a dropped request. A retry never silently destroys a pending reveal.
    const reusable =
      pending && pending.phrase === normalized && !pending.commitBlock;
    const salt = reusable ? pending.salt : randomSalt();
    const value: PendingCommitment = {
      account: connection.account,
      chest,
      chainId: config.chainId,
      phrase: normalized,
      salt,
      commitment: commitmentHash(normalized, connection.account, salt),
    };
    savePending(value);
    setPending(value);
    setStatus(
      "Salt saved in this browser. Confirm the commitment in your wallet.",
    );
    await connection.public.simulateContract({
      account: connection.account,
      address: chest,
      abi: chestAbi,
      functionName: "commit",
      args: [value.commitment],
    });
    const hash = await connection.wallet.writeContract({
      address: chest,
      abi: chestAbi,
      functionName: "commit",
      args: [value.commitment],
    });
    value.commitTx = hash;
    addTransaction(hash, "Commitment");
    setPending({ ...value });
    savePending(value);
    setStatus("Commitment sent. Waiting for it to be mined…");
    const receipt = await connection.public.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success")
      throw new Error(
        "Your commitment transaction reverted. No commitment was accepted. Check the transaction and try again.",
      );
    value.commitBlock = receipt.blockNumber.toString();
    savePending(value);
    setPending({ ...value });
    setBlock(receipt.blockNumber);
    setStatus(
      "Commitment mined. Wait at least one more block, then reveal within 256 blocks.",
    );
  }

  async function recover() {
    if (!connection || !pending)
      throw new Error("Connect the wallet that made your commitment first.");
    const [hash, mined] = await connection.public.readContract({
      address: chest,
      abi: chestAbi,
      functionName: "commitments",
      args: [connection.account],
    });
    if (
      hash.toLowerCase() !== pending.commitment.toLowerCase() ||
      mined === 0n
    ) {
      if (pending.commitTx) {
        const receipt = await connection.public.getTransactionReceipt({
          hash: pending.commitTx,
        });
        if (receipt.status === "reverted")
          throw new Error(
            "The commitment transaction reverted. You can send the commitment again.",
          );
      }
      throw new Error(
        "Your saved commitment is not mined yet, or a different commitment is on-chain. Check its transaction link before trying again.",
      );
    }
    const value = { ...pending, commitBlock: mined.toString() };
    savePending(value);
    setPending(value);
    setBlock(await connection.public.getBlockNumber({ cacheTime: 0 }));
    setStatus("Commitment recovered. Its reveal window is shown below.");
  }

  async function reveal() {
    if (!connection || !pending)
      throw new Error("Connect the wallet with the saved commitment first.");
    const [hash, mined] = await connection.public.readContract({
      address: chest,
      abi: chestAbi,
      functionName: "commitments",
      args: [connection.account],
    });
    if (hash.toLowerCase() !== pending.commitment.toLowerCase())
      throw new Error("WrongCommitment");
    if (mined === 0n) throw new Error("NoCommitment");
    const current = await connection.public.getBlockNumber({ cacheTime: 0 });
    setBlock(current);
    if (revealWindow(mined, current) === "waiting") throw new Error("TooEarly");
    if (revealWindow(mined, current) === "expired") throw new Error("TooLate");
    setStatus(
      "Confirm the reveal in your wallet. The normalized phrase and saved salt will be sent.",
    );
    await connection.public.simulateContract({
      account: connection.account,
      address: chest,
      abi: chestAbi,
      functionName: "reveal",
      args: [normalizePhrase(pending.phrase), pending.salt],
    });
    const tx = await connection.wallet.writeContract({
      address: chest,
      abi: chestAbi,
      functionName: "reveal",
      args: [normalizePhrase(pending.phrase), pending.salt],
    });
    const value = { ...pending, revealTx: tx };
    addTransaction(tx, "Reveal");
    setPending(value);
    savePending(value);
    const receipt = await connection.public.waitForTransactionReceipt({
      hash: tx,
    });
    if (receipt.status !== "success")
      throw new Error(
        "The reveal transaction reverted. Your salt is still saved. Check its transaction link and the reveal window.",
      );
    clearPending(value);
    setPending(null);
    setStatus("The chest is open. The Ledger now records the launch.");
    await refresh(connection);
  }

  async function scanHolders(existing?: ChestConnection) {
    const using = existing ?? connection ?? (await connect());
    setEligible(null);
    setScanProgress(0);
    const owned: bigint[] = [];
    for (let start = 0; start < 2000; start += 100) {
      const ids = Array.from(
        { length: Math.min(100, 2000 - start) },
        (_, index) => BigInt(start + index),
      );
      // Individual ownerOf reverts are expected for unminted identities.
      const results = await using.public.multicall({
        allowFailure: true,
        contracts: ids.map((id) => ({
          address: IDENTITY_COLLECTION,
          abi: identityAbi,
          functionName: "ownerOf" as const,
          args: [id] as const,
        })),
      });
      if (results.every((result) => result.status === "failure")) {
        const code = await using.public.getCode({
          address: IDENTITY_COLLECTION,
        });
        if (!code || code === "0x")
          throw new Error(
            "The identity collection is not deployed on this network. Check the hunt’s chain configuration.",
          );
      }
      results.forEach((result, index) => {
        if (
          result.status === "success" &&
          result.result.toLowerCase() === using.account.toLowerCase()
        )
          owned.push(ids[index]);
      });
      setScanProgress(start + ids.length);
    }
    const unclaimed: bigint[] = [];
    for (let start = 0; start < owned.length; start += 100) {
      const batch = owned.slice(start, start + 100);
      const results = await using.public.multicall({
        allowFailure: false,
        contracts: batch.map((id) => ({
          address: chest,
          abi: chestAbi,
          functionName: "holderClaimed" as const,
          args: [id] as const,
        })),
      });
      results.forEach((claimed, index) => {
        if (!claimed) unclaimed.push(batch[index]);
      });
    }
    setEligible(unclaimed);
    setHolderIds(unclaimed.join(", "));
    setStatus(
      unclaimed.length
        ? `Found ${unclaimed.length} unclaimed ${unclaimed.length === 1 ? "identity" : "identities"} owned by this wallet. Review the ids, then claim.`
        : "No unclaimed identity shares were found for this wallet. You can also enter ids to trigger payment to their owners.",
    );
    return unclaimed;
  }

  async function claimShares() {
    setHolderError("");
    let ids: bigint[] | null = null;
    if (holderIds.trim()) {
      try {
        ids = parseHolderIds(holderIds);
      } catch (reason) {
        setHolderError(plainError(reason));
        holderField.current?.focus();
        throw reason;
      }
    }
    const using = connection ?? (await connect());
    if (
      !(await using.public.readContract({
        address: chest,
        abi: chestAbi,
        functionName: "claimed",
      }))
    )
      throw new Error("NotLaunched");
    if (!ids) ids = await scanHolders(using);
    if (!ids.length) return;
    const ready: bigint[] = [];
    for (let start = 0; start < ids.length; start += 100) {
      const batch = ids.slice(start, start + 100);
      const claimed = await using.public.multicall({
        allowFailure: false,
        contracts: batch.map((id) => ({
          address: chest,
          abi: chestAbi,
          functionName: "holderClaimed" as const,
          args: [id] as const,
        })),
      });
      claimed.forEach((done, index) => {
        if (!done) ready.push(batch[index]);
      });
    }
    if (!ready.length)
      throw new Error(
        "All of these identity ids have already claimed their shares.",
      );
    for (let start = 0; start < ready.length; start += 100) {
      const batch = ready.slice(start, start + 100);
      setStatus(
        `Confirm batch ${Math.floor(start / 100) + 1} of ${Math.ceil(ready.length / 100)}. Shares go to each identity’s owner; the sending wallet pays the network fee.`,
      );
      await using.public.simulateContract({
        account: using.account,
        address: chest,
        abi: chestAbi,
        functionName: "claimHolderShare",
        args: [batch],
      });
      const hash = await using.wallet.writeContract({
        address: chest,
        abi: chestAbi,
        functionName: "claimHolderShare",
        args: [batch],
      });
      addTransaction(
        hash,
        `Holder shares · batch ${Math.floor(start / 100) + 1}`,
      );
      const receipt = await using.public.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success")
        throw new Error(
          "This holder-share transaction reverted. Earlier confirmed batches remain paid. Retry to skip ids already claimed.",
        );
      setEligible(
        (previous) => previous?.filter((id) => !batch.includes(id)) ?? null,
      );
      setHolderIds((previous) =>
        previous.trim()
          ? parseHolderIds(previous)
              .filter((id) => !batch.includes(id))
              .join(", ")
          : "",
      );
    }
    setStatus(
      `Shares claimed for ${ready.length} ${ready.length === 1 ? "identity" : "identities"}. Each owner received 50,000 DL per id.`,
    );
    await refresh(using);
  }

  const commitBlock = pending?.commitBlock ? BigInt(pending.commitBlock) : null;
  const elapsed =
    block !== null && commitBlock !== null ? block - commitBlock : null;
  const windowState =
    commitBlock !== null && block !== null
      ? revealWindow(commitBlock, block)
      : null;
  const canReveal = windowState === "ready";
  const expired = windowState === "expired";

  return (
    <div className="chest-panel">
      <p className="eyebrow">
        {launched
          ? "The Ledger has opened"
          : shrine
            ? "The drowned shrine"
            : "A record beneath the water"}
      </p>
      <h2>
        {launched
          ? "What the bay gave back"
          : shrine
            ? "Open the chest"
            : "The Ledger"}
      </h2>
      {closed && (
        <p className="notice">
          The chest is not open yet. The village keeper has not set its address.
        </p>
      )}
      {!closed && (
        <div className="chest-actions">
          <button
            type="button"
            className="secondary-btn"
            disabled={!!busy}
            onClick={() => void run("Refreshing the Ledger…", () => refresh())}
          >
            Refresh Ledger
          </button>
          {!shrine && (
            <button
              type="button"
              className="secondary-btn"
              disabled={!!busy}
              onClick={() =>
                void run("Connecting wallet…", async () => {
                  await connect();
                })
              }
            >
              {connection ? "Reconnect wallet" : "Connect wallet"}
            </button>
          )}
          {connection && (
            <span className="chest-account" title={connection.account}>
              Connected: {connection.account.slice(0, 6)}…
              {connection.account.slice(-4)}
            </span>
          )}
        </div>
      )}

      {!launched && !shrine && (
        <p className="muted">
          Twelve words. One night. The stone shrine waits across the bay. When
          the chest opens, its winner and holder shares will be recorded here.
        </p>
      )}

      {!launched && shrine && (
        <>
          <section
            className="panel-section"
            aria-labelledby="shrine-riddle-title"
          >
            <h3 id="shrine-riddle-title">The stone’s instructions</h3>
            <ol className="shrine-riddle">
              {config.riddle.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ol>
          </section>
          <section className="panel-section" aria-labelledby="phrase-title">
            <h3 id="phrase-title">1. Put the words in order</h3>
            <p className="muted">
              Read the twelve lines, then move the words or type your phrase.
              The bank does not remember their order.
            </p>
            <ol
              className="phrase-arrangement"
              aria-label="Arrange recovered words"
            >
              {arrangement.map((word, index) => (
                <li key={`${word}-${index}`}>
                  <span className="word-position">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="arranged-word">{word}</span>
                  <button
                    type="button"
                    aria-label={`Move ${word}, position ${index + 1}, earlier`}
                    disabled={index === 0 || !!busy}
                    onClick={() => moveWord(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${word}, position ${index + 1}, later`}
                    disabled={index === arrangement.length - 1 || !!busy}
                    onClick={() => moveWord(index, 1)}
                  >
                    ↓
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="secondary-btn"
              disabled={!!busy}
              onClick={() => editPhrase(arrangement.join(" "))}
            >
              Use this word order
            </button>
            <label className="chest-label" htmlFor="chest-phrase">
              The twelve-word phrase
            </label>
            <textarea
              ref={phraseField}
              className="field chest-phrase"
              id="chest-phrase"
              rows={3}
              value={phrase}
              disabled={!!busy}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="none"
              onChange={(event) => editPhrase(event.target.value)}
              aria-invalid={error === "the bay does not answer"}
              aria-describedby={
                error === "the bay does not answer"
                  ? "phrase-help chest-error"
                  : "phrase-help"
              }
            />
            <p className="muted" id="phrase-help">
              Only use words from this game. Never enter a real wallet’s
              recovery phrase. Case and extra spaces are ignored.
            </p>
            <button
              type="button"
              className="primary-btn"
              disabled={!!busy}
              onClick={checkPhrase}
            >
              {verified ? "Phrase verified" : "Check the phrase"}
            </button>
          </section>
          <section className="panel-section" aria-labelledby="commit-title">
            <h3 id="commit-title">2. Connect and commit</h3>
            <p className="muted">
              A commitment hides your answer until the next block. Your wallet
              pays the network fee. The reveal salt is saved in this browser
              before sending.
            </p>
            <div className="chest-actions">
              <button
                type="button"
                className="secondary-btn"
                disabled={closed || !!busy}
                onClick={() =>
                  void run("Connecting wallet…", async () => {
                    await connect();
                  })
                }
              >
                {connection
                  ? "Reconnect / restore commitment"
                  : "Connect wallet / restore commitment"}
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={
                  closed ||
                  !verified ||
                  !connection ||
                  !!busy ||
                  (!!pending?.commitBlock && !expired)
                }
                onClick={() => void run("Sending commitment…", commit)}
              >
                {expired ? "Commit again" : "Commit phrase"}
              </button>
            </div>
            {pending && (
              <p className="muted">
                A reveal salt is saved for this account. Keep this browser’s
                site data until your reveal is confirmed.
              </p>
            )}
          </section>
          <section className="panel-section" aria-labelledby="reveal-title">
            <h3 id="reveal-title">3. Let one block pass. Reveal.</h3>
            <p className="muted">
              Reveal at least one block after your commitment is mined, and
              within 256 blocks.
            </p>
            {elapsed !== null && (
              <p className="notice">
                {expired
                  ? "Your reveal window expired. Commit again above."
                  : elapsed < 1n
                    ? "Waiting for the next block…"
                    : `Ready to reveal · ${256n - elapsed} blocks remain.`}
              </p>
            )}
            <div className="chest-actions">
              <button
                type="button"
                className="primary-btn"
                disabled={!!busy || !canReveal || !connection}
                onClick={() => void run("Revealing the phrase…", reveal)}
              >
                Reveal and open the chest
              </button>
              {pending && (
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={!!busy || !connection}
                  onClick={() => void run("Recovering commitment…", recover)}
                >
                  Recover / check block
                </button>
              )}
            </div>
          </section>
        </>
      )}

      {launched && info && (
        <>
          <section
            className="panel-section"
            aria-labelledby="launch-record-title"
          >
            <h3 id="launch-record-title">The launch record</h3>
            <dl className="launch-record">
              <dt>Winner</dt>
              <dd>
                <AddressLink address={info.winner} chainId={config.chainId} />
              </dd>
              <dt>DL token</dt>
              <dd>
                <AddressLink address={info.dl} chainId={config.chainId} />
              </dd>
              <dt>Uniswap V2 pool</dt>
              <dd>
                <AddressLink address={info.pair} chainId={config.chainId} />
              </dd>
            </dl>
            {info.reserves && (
              <div className="pool-reserves">
                <h4>Pool reserves</h4>
                {info.reserves.tokens.map((token, index) => (
                  <p key={token}>
                    <span className="reserve-value">
                      {formatUnits(
                        info.reserves!.values[index as 0 | 1],
                        info.reserves!.decimals[index],
                      )}
                    </span>{" "}
                    {info.reserves!.symbols[index]}
                    <br />
                    <AddressLink address={token} chainId={config.chainId} />
                  </p>
                ))}
              </div>
            )}
          </section>
          <section className="panel-section" aria-labelledby="holder-title">
            <h3 id="holder-title">Claim holder shares</h3>
            <p>
              Each identity NFT id from 0 to 1999 can claim{" "}
              <strong>50,000 DL once</strong>. DL is paid to the NFT’s owner.
              Anyone may trigger the claim and pay the network fee.
            </p>
            <p className="muted">
              Identity collection:{" "}
              <AddressLink
                address={IDENTITY_COLLECTION}
                chainId={config.chainId}
              />
            </p>
            <button
              type="button"
              className="secondary-btn"
              disabled={!!busy}
              onClick={() =>
                void run("Looking for your identities…", async () => {
                  await scanHolders();
                })
              }
            >
              Find my unclaimed identities
            </button>
            {busy === "Looking for your identities…" && (
              <p role="status">
                Checked {scanProgress.toLocaleString()} / 2,000 identity ids…
              </p>
            )}
            {eligible !== null && (
              <p className="muted">
                {eligible.length} unclaimed{" "}
                {eligible.length === 1
                  ? "identity belongs"
                  : "identities belong"}{" "}
                to the connected wallet.
              </p>
            )}
            <label className="chest-label" htmlFor="holder-ids">
              Identity ids to claim
            </label>
            <textarea
              ref={holderField}
              id="holder-ids"
              className="field"
              value={holderIds}
              rows={3}
              placeholder="For example: 4, 19, 208"
              disabled={!!busy}
              onChange={(event) => {
                setHolderIds(event.target.value);
                setHolderError("");
              }}
              aria-invalid={!!holderError}
              aria-describedby={
                holderError ? "holder-help holder-error" : "holder-help"
              }
            />
            <p className="muted" id="holder-help">
              Leave blank to find and claim your wallet’s identities, or enter
              ids separated by commas or spaces. Already claimed ids are
              skipped. Claims use batches of at most 100; each batch needs
              wallet approval.
            </p>
            <p
              id="holder-error"
              className={holderError ? "chest-error" : undefined}
            >
              {holderError}
            </p>
            <button
              type="button"
              className="primary-btn"
              disabled={!!busy}
              onClick={() => void run("Claiming holder shares…", claimShares)}
            >
              Claim holder shares
            </button>
          </section>
        </>
      )}

      <div role="status" className={busy || status ? "notice" : undefined}>
        {busy && <p>{busy}</p>}
        {status && <p>{status}</p>}
      </div>
      <div
        id="chest-error"
        role="alert"
        className={error ? "notice chest-error" : undefined}
      >
        {error}
      </div>
      {transactions.length > 0 && (
        <section className="panel-section" aria-label="Transaction links">
          <h3>Transactions</h3>
          <ul className="transaction-list">
            {transactions.map((tx) => (
              <li key={tx.hash}>
                <a
                  href={explorerUrl(config.chainId, "tx", tx.hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tx.label} ↗
                  <span className="transaction-hash">{tx.hash}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AddressLink({
  address,
  chainId,
}: {
  address: Address;
  chainId: number;
}) {
  return (
    <a
      className="chain-address"
      href={explorerUrl(chainId, "address", address)}
      target="_blank"
      rel="noreferrer"
    >
      {address}
    </a>
  );
}

export default ChestPanel;
