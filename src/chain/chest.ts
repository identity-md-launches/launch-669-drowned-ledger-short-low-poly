import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  encodeAbiParameters,
  http,
  isAddress,
  keccak256,
  parseAbi,
  parseAbiParameters,
  stringToHex,
  toHex,
  type Address,
  type Chain,
  type EIP1193Provider,
  type Hex,
} from "viem";
import {
  mainnet,
  sepolia,
  base,
  arbitrum,
  optimism,
  polygon,
  bsc,
  gnosis,
  avalanche,
} from "viem/chains";

export const chestAbi = parseAbi([
  "function token() view returns (address)",
  "function dl() view returns (address)",
  "function pair() view returns (address)",
  "function winner() view returns (address)",
  "function answerHash() view returns (bytes32)",
  "function claimed() view returns (bool)",
  "function commitments(address) view returns (bytes32, uint256)",
  "function holderClaimed(uint256) view returns (bool)",
  "function commit(bytes32)",
  "function reveal(string, bytes32)",
  "function claimHolderShare(uint256[])",
  "error AlreadyClaimed()",
  "error NoCommitment()",
  "error TooEarly()",
  "error TooLate()",
  "error WrongCommitment()",
  "error WrongPhrase()",
  "error EmptyChest()",
  "error NotLaunched()",
  "error BadTokenId()",
]);
export const pairAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)",
]);
export const tokenAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);
export const identityAbi = parseAbi([
  "function ownerOf(uint256) view returns (address)",
]);
export const IDENTITY_COLLECTION: Address =
  "0x0000ec93127baa929e58e97dd0095a2bfb38ec1d";

const networks: Chain[] = [
  mainnet,
  sepolia,
  base,
  arbitrum,
  optimism,
  polygon,
  bsc,
  gnosis,
  avalanche,
];
export function chainFor(chainId: number): Chain {
  return (
    networks.find((chain) => chain.id === chainId) ??
    defineChain({
      id: chainId,
      name: `Chain ${chainId}`,
      nativeCurrency: { name: "Native token", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [] } },
    })
  );
}
export function injectedProvider(): EIP1193Provider | undefined {
  return (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
}
export function readClient(chainId: number, provider?: EIP1193Provider) {
  const chain = chainFor(chainId);
  if (!provider && !chain.rpcUrls.default.http.length) {
    throw new Error(`Connect a wallet on chain ${chainId} to read this chest.`);
  }
  return createPublicClient({
    chain,
    transport: provider
      ? custom(provider)
      : http(undefined, { retryCount: 1, timeout: 12_000 }),
  });
}
export async function connectChest(chainId: number) {
  const provider = injectedProvider();
  if (!provider)
    throw new Error(
      "No wallet was found. Install an Ethereum browser wallet, then return here. The rest of the bay needs no wallet.",
    );
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const account = (accounts as string[])[0];
  if (!account || !isAddress(account))
    throw new Error(
      "Your wallet did not share an account. Unlock it and connect again.",
    );
  const expected = toHex(chainId);
  const current = await provider.request({ method: "eth_chainId" });
  if (Number(current) !== chainId) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: expected }],
      });
    } catch (error) {
      const code = Number((error as { code?: number }).code);
      if (code === 4001) throw error;
      throw new Error(
        `Wrong network. Switch your wallet to ${chainFor(chainId).name} (chain ${chainId}), then connect again.`,
      );
    }
  }
  if (Number(await provider.request({ method: "eth_chainId" })) !== chainId) {
    throw new Error(
      `Wrong network. Switch your wallet to chain ${chainId}, then connect again.`,
    );
  }
  return {
    account: account as Address,
    provider,
    public: readClient(chainId, provider),
    wallet: createWalletClient({
      account: account as Address,
      chain: chainFor(chainId),
      transport: custom(provider),
    }),
  };
}
export type ChestConnection = Awaited<ReturnType<typeof connectChest>>;

export function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, " ");
}
export function hashPhrase(phrase: string): Hex {
  return keccak256(stringToHex(normalizePhrase(phrase)));
}
export function commitmentHash(
  phrase: string,
  account: Address,
  salt: Hex,
): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("string, address, bytes32"), [
      normalizePhrase(phrase),
      account,
      salt,
    ]),
  );
}
export function revealWindow(
  commitBlock: bigint,
  currentBlock: bigint,
): "waiting" | "ready" | "expired" {
  if (currentBlock <= commitBlock) return "waiting";
  if (currentBlock > commitBlock + 256n) return "expired";
  return "ready";
}
export function randomSalt(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
export function isClosed(address: string): boolean {
  return /^0x0{40}$/i.test(address);
}
export function explorerUrl(
  chainId: number,
  kind: "tx" | "address",
  value: string,
): string {
  const origin = chainFor(chainId).blockExplorers?.default.url;
  return origin
    ? `${origin}/${kind}/${encodeURIComponent(value)}`
    : `https://blockscan.com/${kind}/${encodeURIComponent(value)}`;
}
export function parseHolderIds(value: string): bigint[] {
  if (!value.trim())
    throw new Error("Enter at least one identity id between 0 and 1999.");
  const tokens = value.trim().split(/[\s,]+/);
  if (tokens.some((token) => !/^\d+$/.test(token) || Number(token) > 1999)) {
    throw new Error(
      "Identity ids must be whole numbers from 0 to 1999, separated by commas or spaces.",
    );
  }
  return [...new Set(tokens.map((token) => BigInt(token)))];
}

export interface PendingCommitment {
  account: Address;
  chest: Address;
  chainId: number;
  phrase: string;
  salt: Hex;
  commitment: Hex;
  commitTx?: Hex;
  commitBlock?: string;
  revealTx?: Hex;
}
function pendingKey(chainId: number, chest: string, account: string): string {
  return `drowned-ledger:commit:${chainId}:${chest.toLowerCase()}:${account.toLowerCase()}`;
}
export function savePending(value: PendingCommitment): void {
  // This must succeed before a transaction can leave the browser.
  try {
    localStorage.setItem(
      pendingKey(value.chainId, value.chest, value.account),
      JSON.stringify(value),
    );
  } catch {
    throw new Error(
      "This browser cannot save your reveal salt. Allow local storage before committing; otherwise your claim could be lost.",
    );
  }
}
export function loadPending(
  chainId: number,
  chest: string,
  account: string,
): PendingCommitment | null {
  try {
    const raw = localStorage.getItem(pendingKey(chainId, chest, account));
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingCommitment;
    if (
      value.chainId !== chainId ||
      value.chest.toLowerCase() !== chest.toLowerCase() ||
      value.account.toLowerCase() !== account.toLowerCase()
    )
      return null;
    if (
      !/^0x[0-9a-f]{64}$/i.test(value.salt) ||
      typeof value.phrase !== "string"
    )
      return null;
    if (
      commitmentHash(value.phrase, value.account, value.salt) !==
      value.commitment
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function clearPending(value: PendingCommitment): void {
  // Clearing a stale record is best-effort after a confirmed successful reveal.
  try {
    localStorage.removeItem(
      pendingKey(value.chainId, value.chest, value.account),
    );
  } catch {
    /* Keep the confirmed chain result. */
  }
}

const errors: Record<string, string> = {
  AlreadyClaimed:
    "The chest has already been opened. Refresh the Ledger to see the winner.",
  NoCommitment:
    "There is no commitment for this account. Commit your phrase first.",
  TooEarly:
    "The sea is still settling. Wait until one block after your commitment, then reveal.",
  TooLate:
    "The 256-block reveal window has passed. Make a new commitment, then reveal it.",
  WrongCommitment:
    "This phrase and salt do not match this account’s commitment. Reconnect the original account or make a new commitment.",
  WrongPhrase: "The bay does not answer. Check the word order and try again.",
  EmptyChest: "The chest is empty. No claim can be paid right now.",
  NotLaunched:
    "DL has not launched yet. Holder shares become available after the chest opens.",
  BadTokenId:
    "One identity id is outside the allowed range. Use ids from 0 to 1999.",
};
export function plainError(error: unknown): string {
  const parts: string[] = [];
  let current = error as
    | {
        message?: string;
        shortMessage?: string;
        name?: string;
        code?: number;
        data?: { errorName?: string };
        cause?: unknown;
      }
    | undefined;
  for (let depth = 0; current && depth < 8; depth++) {
    if (current.code === 4001)
      return "You declined the wallet request. Nothing was sent. Try again when you are ready.";
    parts.push(
      current.data?.errorName ?? "",
      current.name ?? "",
      current.shortMessage ?? "",
      current.message ?? "",
    );
    current = current.cause as typeof current;
  }
  const detail = parts.join(" ");
  for (const [name, message] of Object.entries(errors))
    if (detail.includes(name)) return message;
  if (/UserRejected|user rejected|denied|rejected the request/i.test(detail))
    return "You declined the wallet request. Nothing was sent. Try again when you are ready.";
  if (/insufficient funds/i.test(detail))
    return "Your wallet needs enough native currency to pay the network fee. Add funds and try again.";
  if (
    /chain mismatch|does not match the target chain|wrong network/i.test(detail)
  )
    return "Wrong network. Switch your wallet to the configured chain, then connect again.";
  if (
    /timeout|timed out|fetch failed|failed to fetch|HTTP request failed/i.test(
      detail,
    )
  )
    return "The chain could not be reached. Check your connection and refresh. If a transaction was sent, keep its link and saved salt.";
  if (
    error instanceof Error &&
    !/ContractFunction|CallExecution|TransactionExecution|RpcRequest|HTTP request|Details:|Version:/i.test(
      detail,
    )
  )
    return error.message;
  return "The chain could not complete this request. Your saved commitment is kept. Check your wallet and transaction link, then try again.";
}
