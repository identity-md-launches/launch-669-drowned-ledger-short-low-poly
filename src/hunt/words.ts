import { useSyncExternalStore } from "react";

export interface HuntConfig {
  words: string[];
  sources: Record<string, number>;
  riddle: string[];
  order: string[];
  chest: `0x${string}`;
  answerHash: `0x${string}`;
  chainId: number;
}

export interface HuntEntry {
  sourceId: string;
  word: string;
  date: number;
}
export interface WordToast {
  sourceId: string;
  word: string;
  message: string;
}
interface SavedEntry {
  sourceId: string;
  date: number;
}
interface HuntSnapshot {
  config: HuntConfig | null;
  foundIds: string[];
  words: string[];
  entries: HuntEntry[];
  toast: WordToast | null;
  error: string | null;
  loading: boolean;
  dismissToast: () => void;
}

const SAVE_KEY = "drowned-ledger:hunt:v1";
const listeners = new Set<() => void>();
const pending = new Set<string>();
let initializing: Promise<void> | null = null;
let saved: SavedEntry[] = [];
let toastTimeout: ReturnType<typeof setTimeout> | undefined;

/** Validate the replaceable deployment data without assuming its words or slot order. */
export function validateHuntConfig(value: unknown): HuntConfig {
  if (!value || typeof value !== "object")
    throw new Error("The hunt data is missing.");
  const data = value as Record<string, unknown>;
  const words = data.words;
  if (
    !Array.isArray(words) ||
    words.length !== 12 ||
    words.some(
      (word) => typeof word !== "string" || !word.trim() || /\s/.test(word),
    )
  ) {
    throw new Error("The hunt needs twelve single words.");
  }
  if (
    !data.sources ||
    typeof data.sources !== "object" ||
    Array.isArray(data.sources)
  ) {
    throw new Error("The hunt word sources are missing.");
  }
  const sources = data.sources as Record<string, unknown>;
  const ids = Object.keys(sources);
  const slots = Object.values(sources);
  if (
    ids.length !== 12 ||
    slots.some(
      (slot) =>
        !Number.isInteger(slot) ||
        Number(slot) < 0 ||
        Number(slot) >= words.length,
    ) ||
    new Set(slots).size !== 12
  ) {
    throw new Error(
      "Each of the twelve hunt sources needs its own valid word slot.",
    );
  }
  if (
    !Array.isArray(data.riddle) ||
    data.riddle.length !== 12 ||
    data.riddle.some((line) => typeof line !== "string" || !line.trim())
  ) {
    throw new Error("The shrine riddle needs twelve lines.");
  }
  if (
    !Array.isArray(data.order) ||
    data.order.length !== 12 ||
    new Set(data.order).size !== 12 ||
    data.order.some(
      (id) => typeof id !== "string" || !Object.hasOwn(sources, id),
    )
  ) {
    throw new Error("The shrine order must name every hunt source once.");
  }
  if (typeof data.chest !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(data.chest))
    throw new Error("The chest address is not valid.");
  if (
    typeof data.answerHash !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(data.answerHash)
  )
    throw new Error("The answer hash is not valid.");
  if (!Number.isSafeInteger(data.chainId) || Number(data.chainId) < 1)
    throw new Error("The hunt network number is not valid.");
  return data as unknown as HuntConfig;
}

function dismissToast() {
  if (toastTimeout) clearTimeout(toastTimeout);
  update({ toast: null });
}

let snapshot: HuntSnapshot = {
  config: null,
  foundIds: [],
  words: [],
  entries: [],
  toast: null,
  error: null,
  loading: true,
  dismissToast,
};

function update(patch: Partial<HuntSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

function refreshProgress(config: HuntConfig) {
  // Resolve saved source ids through the currently fetched data. No old words or
  // answer ordering are duplicated in a source file or in the progress format.
  const entries = saved
    .filter((entry) => Object.hasOwn(config.sources, entry.sourceId))
    .map((entry) => ({
      ...entry,
      word: config.words[config.sources[entry.sourceId]],
    }));
  update({
    foundIds: entries.map((entry) => entry.sourceId),
    words: entries.map((entry) => entry.word),
    entries,
  });
}

function readProgress(): SavedEntry[] {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((entry): entry is SavedEntry => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Partial<SavedEntry>;
      if (
        typeof candidate.sourceId !== "string" ||
        !Number.isFinite(candidate.date) ||
        seen.has(candidate.sourceId)
      )
        return false;
      seen.add(candidate.sourceId);
      return true;
    });
  } catch {
    update({
      error:
        "Your browser could not read saved words. You can still play this session.",
    });
    return [];
  }
}

/** Fetch once at runtime. Failed requests can be retried by calling this again. */
export function initializeHunt(): Promise<void> {
  if (snapshot.config) return Promise.resolve();
  if (initializing) return initializing;
  update({ loading: true, error: null });
  initializing = (async () => {
    try {
      const response = await fetch(import.meta.env.BASE_URL + "hunt.json");
      if (!response.ok)
        throw new Error(
          `The hunt data could not be loaded (${response.status}).`,
        );
      const config = validateHuntConfig(await response.json());
      saved = readProgress();
      update({ config, loading: false });
      refreshProgress(config);
      const waiting = [...pending];
      pending.clear();
      waiting.forEach(foundWord);
    } catch (error) {
      update({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "The hunt data could not be loaded. Try again.",
      });
    } finally {
      initializing = null;
    }
  })();
  return initializing;
}

/** The only entry point that awards a word; duplicate and unknown sources do nothing. */
export function foundWord(sourceId: string): boolean {
  const config = snapshot.config;
  if (!config) {
    pending.add(sourceId);
    void initializeHunt();
    return false;
  }
  if (!Object.hasOwn(config.sources, sourceId) || isFound(sourceId))
    return false;
  const word = config.words[config.sources[sourceId]];
  saved.push({ sourceId, date: Date.now() });
  refreshProgress(config);
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch {
    update({
      error:
        "Your browser could not save this word. Keep this tab open to keep your progress.",
    });
  }
  update({ toast: { sourceId, word, message: "You found a word" } });
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(dismissToast, 6500);
  return true;
}

export function isFound(sourceId: string): boolean {
  return snapshot.foundIds.includes(sourceId);
}

/** Read-only access for non-React hosts and deterministic store validation. */
export function getHuntSnapshot(): HuntSnapshot {
  return snapshot;
}

export function useHunt(): HuntSnapshot {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getHuntSnapshot,
    getHuntSnapshot,
  );
}
