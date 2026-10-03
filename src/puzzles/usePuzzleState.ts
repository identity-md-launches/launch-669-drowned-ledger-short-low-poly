import {
  useCallback,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";

interface PuzzleStore<T> {
  value: T;
  listeners: Set<() => void>;
}
const stores = new Map<string, PuzzleStore<unknown>>();

function getStore<T>(key: string, initial: T | (() => T)): PuzzleStore<T> {
  const existing = stores.get(key);
  if (existing) return existing as PuzzleStore<T>;
  let value: T;
  try {
    const raw = localStorage.getItem(key);
    value =
      raw === null
        ? initial instanceof Function
          ? initial()
          : initial
        : (JSON.parse(raw) as T);
  } catch {
    value = initial instanceof Function ? initial() : initial;
  }
  const store: PuzzleStore<T> = { value, listeners: new Set() };
  stores.set(key, store as PuzzleStore<unknown>);
  return store;
}

/** A puzzle owns only its own namespaced save. Never awards words. */
export function usePuzzleState<T>(
  id: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const key = `drowned-ledger:puzzle:${id}`;
  const store = getStore(key, initial);
  const state = useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store.value,
    () => store.value,
  );
  const setSavedState: Dispatch<SetStateAction<T>> = useCallback(
    (value) => {
      const next = value instanceof Function ? value(store.value) : value;
      store.value = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* Continue in memory. */
      }
      store.listeners.forEach((listener) => listener());
    },
    [key, store],
  );
  return [state, setSavedState];
}
