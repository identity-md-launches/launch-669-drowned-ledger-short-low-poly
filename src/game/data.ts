export const ordinaryFish = [
  "Mackerel",
  "Herring",
  "Grey Cod",
  "Flounder",
  "Pollock",
  "Mullet",
];
export const strangeFish = [
  {
    id: "fish-1",
    name: "Choir Cod",
    x: 6,
    z: 5,
    spot: "The Humming Shallows",
    night: false,
    description:
      "Hums a low chord through closed gills. Three in a bucket hum in harmony.",
  },
  {
    id: "fish-2",
    name: "Glasseye Eel",
    x: 16,
    z: -12,
    spot: "Glasswater Reach",
    night: true,
    description:
      "Clear as wet glass. Its eyes keep following you after it stops moving.",
  },
  {
    id: "fish-3",
    name: "Ledger Loach",
    x: -1,
    z: -17,
    spot: "The Sunken Counting House",
    night: false,
    description:
      "Rows of tiny numbers run down its flank and change when you blink.",
  },
  {
    id: "fish-4",
    name: "Stitchback Haddock",
    x: 20,
    z: 14,
    spot: "The Seam",
    night: false,
    description:
      "A neat seam of black thread closes its belly. No one admits to sewing it.",
  },
  {
    id: "fish-5",
    name: "Gumtooth Hagfish",
    x: 28,
    z: -3,
    spot: "Widow’s Teeth",
    night: true,
    description:
      "No eyes. Rows of human molars. It breathes when you look away.",
  },
];
export const villagers = [
  {
    id: "brannock",
    name: "Brannock",
    role: "Dock master",
    fish: "fish-3",
    intro:
      "Five boats out. Four boats back. I keep counting, you see. Fetch me the little loach with numbers on its skin. Perhaps its figures agree with mine.",
    reply:
      "It says five. It always says five. You had best stop looking at it now.",
    bio: "Counts every boat that leaves, and every one that does not come back.",
  },
  {
    id: "gulla",
    name: "Mother Gulla",
    role: "Net mender",
    fish: "fish-1",
    intro:
      "Hear them? The nets know the lullaby. There’s a cod in the humming shallows that knows the rest. Bring it to me, dear.",
    reply:
      "That was my mother’s voice. No, don’t open the bucket. Let her sing.",
    bio: "Hums lullabies to the nets and says they hum back.",
  },
  {
    id: "wexley",
    name: "Wexley",
    role: "The gutter",
    fish: "fish-4",
    intro:
      "Fine day for processing! Any day is, really. Find the haddock at the Seam. Black thread, neat stitches. Do leave the belly closed.",
    reply:
      "Lovely work. Whoever did this has such steady hands. What? No, I wouldn’t know what’s inside.",
    bio: "Cheerful. Too cheerful. Never says what the processing shed is for.",
  },
  {
    id: "tadwick",
    name: "Tadwick",
    role: "Shingle collector",
    fish: "fish-5",
    intro:
      "These teeth look like mine, only older. There’s a fish out by Widow’s Teeth that wears a whole mouthful. It comes when it’s dark. Will you bring it?",
    reply: "That one’s mine. That one too. But I haven’t lost those yet.",
    bio: "Collects teeth from the shingle and is sure some of them are his.",
  },
  {
    id: "morrow",
    name: "Old Morrow",
    role: "The drowned priest",
    fish: "fish-2",
    intro:
      "They pulled me from this water twice. The second time, something came along. Bring me the clear eel from Glasswater after dark. It has seen where you left your boat.",
    reply:
      "It remembers you. The bay keeps what it takes. But sometimes, child, it takes a bargain.",
    bio: "Was pulled out of the bay twice, and speaks for it now.",
  },
];
export type Position = { x: number; z: number; heading: number };
export type GameSave = {
  position: Position;
  elapsed: number;
  dread: number;
  inventory: string[];
  caught: string[];
  accepted: string[];
  completed: string[];
  visited: string[];
  started: boolean;
  dock: boolean;
  notes: string[];
};
export const INITIAL_GAME: GameSave = {
  position: { x: -5, z: 8, heading: Math.PI / 2 },
  elapsed: 190,
  dread: 0,
  inventory: [],
  caught: [],
  accepted: [],
  completed: [],
  visited: [],
  started: false,
  dock: false,
  notes: [],
};
export const GAME_KEY = "drowned-ledger:game:v1";
export function readGame(): GameSave {
  const fresh = (): GameSave => ({
    ...INITIAL_GAME,
    position: { ...INITIAL_GAME.position },
    inventory: [],
    caught: [],
    accepted: [],
    completed: [],
    visited: [],
    notes: [],
  });
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(GAME_KEY) || "null");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fresh();
    const saved = raw as Record<string, unknown>;
    const position =
      saved.position &&
      typeof saved.position === "object" &&
      !Array.isArray(saved.position)
        ? (saved.position as Record<string, unknown>)
        : {};
    const finite = (value: unknown, fallback: number) =>
      typeof value === "number" && Number.isFinite(value) ? value : fallback;
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const strings = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
    const unique = (items: string[]) => [...new Set(items)];
    const fishIds = new Set([
      ...ordinaryFish,
      ...strangeFish.map((fish) => fish.id),
    ]);
    const workerIds = new Set(villagers.map((villager) => villager.id));
    const completed = unique(
      strings(saved.completed).filter((id) => workerIds.has(id)),
    );
    const dock = saved.dock === true;
    const heading = finite(position.heading, INITIAL_GAME.position.heading);
    return {
      position: dock
        ? { x: -8, z: 5, heading: Math.PI / 2 }
        : {
            x: clamp(finite(position.x, INITIAL_GAME.position.x), -9, 35),
            z: clamp(finite(position.z, INITIAL_GAME.position.z), -29, 27),
            heading: ((heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
          },
      // Keep corrupted huge clocks within a range where fractional ticks still work.
      elapsed: clamp(
        finite(saved.elapsed, INITIAL_GAME.elapsed),
        0,
        480 * 99999,
      ),
      dread: clamp(finite(saved.dread, 0), 0, 99),
      inventory: strings(saved.inventory).filter((id) => fishIds.has(id)),
      caught: unique(strings(saved.caught).filter((id) => fishIds.has(id))),
      accepted: unique([
        ...strings(saved.accepted).filter((id) => workerIds.has(id)),
        ...completed,
      ]),
      completed,
      visited: unique(strings(saved.visited).filter(Boolean)),
      started: saved.started === true,
      dock,
      notes: strings(saved.notes),
    };
  } catch {
    return fresh();
  }
}
export function distance(
  a: { x: number; z: number },
  b: { x: number; z: number },
) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
export function getPhase(elapsed: number) {
  return (elapsed % 480) / 480;
}
export function fishingHit(needle: number, strange: boolean) {
  const width = strange ? 0.19 : 0.32;
  return needle >= 0.5 - width / 2 && needle <= 0.5 + width / 2;
}
