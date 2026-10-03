import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon, PepePortrait } from "./components/Icon";
import { Modal } from "./components/Modal";
import { Fishing } from "./components/Fishing";
import { bayAudio } from "./game/audio";
import {
  distance,
  GAME_KEY,
  getPhase,
  ordinaryFish,
  readGame,
  strangeFish,
  villagers,
  type GameSave,
} from "./game/data";
import { foundWord, initializeHunt, useHunt } from "./hunt/words";
import { puzzleRegistry } from "./puzzles/registry";
const World = lazy(() => import("./game/World"));
const ChestPanel = lazy(() => import("./components/ChestPanel"));
type Panel =
  | "journal"
  | "bank"
  | "quests"
  | "chart"
  | "dock"
  | "help"
  | "ledger"
  | "shrine"
  | `npc:${string}`
  | `puzzle:${string}`
  | null;
type Target = { id: string; name: string; x: number; z: number };

export default function App() {
  const [game, setGame] = useState<GameSave>(readGame);
  const [panel, setPanel] = useState<Panel>(null);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(false);
  const [selected, setSelected] = useState<Target | null>(null);
  const [autopilot, setAutopilot] = useState(false);
  const [notice, setNotice] = useState("");
  const [fishing, setFishing] = useState<{
    name: string;
    id: string;
    strange: boolean;
  } | null>(null);
  const [journalTab, setJournalTab] = useState<"fish" | "notes">("fish");
  const [saveError, setSaveError] = useState("");
  const [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const hunt = useHunt();
  const keys = useRef(new Set<string>());
  const gameRef = useRef(game);
  gameRef.current = game;
  const stateRef = useRef({
    panel,
    paused,
    hidden,
    fishing,
    selected,
    autopilot,
  });
  stateRef.current = { panel, paused, hidden, fishing, selected, autopilot };
  const phase = getPhase(game.elapsed);
  const night = phase >= 0.55;
  const day = Math.floor(game.elapsed / 480) + 1;
  const nearby = strangeFish.find((s) => distance(s, game.position) < 4.4);
  const nearDock = distance(game.position, { x: -9, z: 5 }) < 10;
  const allWords = hunt.foundIds.length === 12;
  const actions = useRef({ interact: () => {}, cast: () => {} });
  useEffect(() => {
    void initializeHunt();
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    const visibility = () => {
      setHidden(document.hidden);
      keys.current.clear();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(GAME_KEY, JSON.stringify(gameRef.current));
        setSaveError("");
      } catch {
        setSaveError(
          "Saving is unavailable. Keep this tab open to preserve this session.",
        );
      }
    };
    const timer = setInterval(save, 3000);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, []);
  useEffect(() => {
    bayAudio.night(night);
  }, [night]);
  useEffect(() => {
    bayAudio.pause(paused || hidden);
  }, [paused, hidden]);
  useEffect(() => {
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        dt = Math.min((now - last) / 1000, 0.2);
      last = now;
      const s = stateRef.current;
      if (s.paused || s.panel || s.hidden) return;
      setGame((g) => {
        if (!g.started) return g;
        let p = { ...g.position };
        if (!g.dock && !s.fishing) {
          const k = keys.current;
          const turn =
            (k.has("a") || k.has("arrowleft") ? 1 : 0) -
            (k.has("d") || k.has("arrowright") ? 1 : 0);
          const thrust =
            (k.has("w") || k.has("arrowup") ? 1 : 0) -
            (k.has("s") || k.has("arrowdown") ? 0.65 : 0);
          if (turn || thrust) {
            p.heading -= turn * dt * 1.6;
            p.x += Math.sin(p.heading) * thrust * dt * 4.4;
            p.z -= Math.cos(p.heading) * thrust * dt * 4.4;
            if (s.autopilot) setAutopilot(false);
          } else if (s.autopilot && s.selected) {
            const dx = s.selected.x - p.x,
              dz = s.selected.z - p.z,
              d = Math.hypot(dx, dz);
            if (d < 2.2) {
              setAutopilot(false);
              setNotice(`You have reached ${s.selected.name}.`);
            } else {
              p.heading = Math.atan2(dx, -dz);
              p.x += (dx / d) * dt * 3.8;
              p.z += (dz / d) * dt * 3.8;
            }
          }
          p.x = Math.max(-9, Math.min(35, p.x));
          p.z = Math.max(-29, Math.min(27, p.z));
        }
        const dockSafe = g.dock || distance(p, { x: -9, z: 5 }) < 7;
        const dread = Math.max(
          0,
          g.dread +
            (dockSafe ? -3 : getPhase(g.elapsed) >= 0.55 ? 0.55 : -0.15) * dt,
        );
        if (dread >= 100) {
          setAutopilot(false);
          setFishing(null);
          setNotice(
            "You wake on the dock. Your catch is gone. Your recovered words remain.",
          );
          bayAudio.effect("bell");
          return {
            ...g,
            position: { x: -8, z: 5, heading: Math.PI / 2 },
            dock: true,
            dread: 0,
            inventory: [],
            elapsed: Math.ceil(g.elapsed / 480) * 480 + 30,
            notes: [
              ...g.notes,
              "The water closed over the gunwale. Brannock found me on the dock. My catch did not return.",
            ],
          };
        }
        return {
          ...g,
          position:
            p.x === g.position.x &&
            p.z === g.position.z &&
            p.heading === g.position.heading
              ? g.position
              : p,
          dread,
          elapsed: g.elapsed + dt,
        };
      });
    }, 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      const s = stateRef.current;
      if (s.panel) return;
      const key = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(key)
      ) {
        e.preventDefault();
        keys.current.add(key);
      }
      if (e.repeat) return;
      if (key === "j") setPanel("journal");
      if (key === "b") setPanel("bank");
      if (key === "q") setPanel("quests");
      if (key === "m") setPanel("chart");
      if (key === "e") actions.current.interact();
      if (
        e.code === "Space" &&
        !s.fishing &&
        !(e.target instanceof HTMLButtonElement)
      ) {
        e.preventDefault();
        actions.current.cast();
      }
      if (key === "escape" && !s.fishing) setPaused((p) => !p);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clear = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);
  const show = (p: Panel) => {
    keys.current.clear();
    setPanel(p);
  };
  const selectSpot = (id: string) => {
    const spot = strangeFish.find((s) => s.id === id);
    if (spot) {
      setSelected({ ...spot, name: spot.spot });
      setNotice(`Course marked: ${spot.spot}. Use WASD or “Sail to marker”.`);
    }
  };
  const openSite = (id: string) => {
    if (id === "shrine") {
      if (allWords && night && distance(game.position, { x: 22, z: -25 }) < 7) {
        show("shrine");
      } else {
        setSelected({
          id: "shrine",
          name: "The drowned shrine",
          x: 22,
          z: -25,
        });
        setNotice("Approach the shrine on the far shore after dark.");
      }
      return;
    }
    const p = puzzleRegistry.find((p) => p.id === id);
    if (!p) return;
    show(null);
    if (p.id === "minesweeper" && distance(game.position, p.site) > 6) {
      setSelected({ ...p.site, id: p.id, name: p.title });
      setNotice("Sail to the rusted marker posts to investigate.");
      return;
    }
    if (p.id !== "minesweeper" && !game.dock) {
      setNotice("Moor at the village dock to visit the village.");
      setSelected({ id: "dock", name: "Marrow dock", x: -8, z: 5 });
      return;
    }
    if (p.nightOnly && !night) {
      setNotice(
        "This door opens after dark. You can wait for night at the dock.",
      );
      return;
    }
    setGame((g) => ({ ...g, visited: [...new Set([...g.visited, id])] }));
    show(`puzzle:${id}`);
  };
  const openNPC = (id: string) => {
    if (!game.dock) {
      setSelected({ id: "dock", name: "Marrow dock", x: -8, z: 5 });
      setNotice(
        "The workers are on the dock. Moor your boat to speak with them.",
      );
      return;
    }
    show(`npc:${id}`);
  };
  const interact = () => {
    if (fishing) return;
    if (game.dock) {
      show("dock");
      return;
    }
    if (allWords && night && distance(game.position, { x: 22, z: -25 }) < 7) {
      show("shrine");
      return;
    }
    if (distance(game.position, { x: 13, z: 22 }) < 6) {
      openSite("minesweeper");
      return;
    }
    if (nearDock) {
      setGame((g) => ({
        ...g,
        dock: true,
        dread: Math.max(0, g.dread - 25),
        position: { x: -8, z: 5, heading: Math.PI / 2 },
      }));
      setAutopilot(false);
      bayAudio.effect("bell");
      show("dock");
      return;
    }
    setNotice(
      "Nothing within reach. Follow a marker or return to the village dock.",
    );
  };
  const cast = () => {
    if (!game.started || paused || fishing || panel) return;
    if (game.dock) {
      setNotice("Cast off from the dock before fishing.");
      return;
    }
    if (nearby?.night && !night) {
      setNotice(
        "Still water. This strange fish only bites after dark. Try for an ordinary catch away from this ripple.",
      );
      return;
    }
    let catchName =
        ordinaryFish[Math.floor(Math.random() * ordinaryFish.length)],
      id = catchName,
      strange = false;
    if (
      nearby &&
      !game.inventory.includes(nearby.id) &&
      !game.completed.some(
        (n) => villagers.find((v) => v.id === n)?.fish === nearby.id,
      )
    ) {
      catchName = nearby.name;
      id = nearby.id;
      strange = true;
    }
    setAutopilot(false);
    setFishing({ name: catchName, id, strange });
  };
  actions.current = { interact, cast };
  const landCatch = () => {
    if (!fishing) return;
    const catchData = fishing;
    setFishing(null);
    setGame((g) => ({
      ...g,
      inventory: [...g.inventory, catchData.id],
      caught: [...new Set([...g.caught, catchData.id])],
    }));
    bayAudio.effect("splash");
    if (catchData.strange) {
      foundWord(catchData.id);
      setNotice(
        `${catchData.name}. A seed word is caught behind its teeth. Return it to the village.`,
      );
    } else setNotice(`${catchData.name} added to your catch and fish journal.`);
  };
  const sail = () => {
    if (!selected) return;
    setGame((g) => ({ ...g, dock: false, started: true }));
    setPanel(null);
    setAutopilot(true);
    setNotice(`Sailing to ${selected.name}. Steer with WASD to take the helm.`);
  };
  const start = () => {
    setGame((g) => ({ ...g, started: true }));
    selectSpot("fish-1");
    setNotice(
      "Welcome back. Head for the ripples, or moor at the village to meet the workers.",
    );
  };
  const worldActions = useRef({ selectSpot, openSite, openNPC });
  worldActions.current = { selectSpot, openSite, openNPC };
  const markerSpot = useCallback(
    (id: string) => worldActions.current.selectSpot(id),
    [],
  );
  const markerSite = useCallback(
    (id: string) => worldActions.current.openSite(id),
    [],
  );
  const markerNPC = useCallback(
    (id: string) => worldActions.current.openNPC(id),
    [],
  );
  const clockText = night
    ? "Nightfall"
    : phase < 0.22
      ? "Morning"
      : phase < 0.4
        ? "Afternoon"
        : "Dusk";
  const modalTitle =
    panel === "journal"
      ? "The field journal"
      : panel === "bank"
        ? "The word bank"
        : panel === "quests"
          ? "Unfinished business"
          : panel === "chart"
            ? "A chart of Marrow Bay"
            : panel === "dock"
              ? "The village dock"
              : panel === "help"
                ? "A guide for the returning"
                : panel === "ledger"
                  ? "The Ledger"
                  : panel === "shrine"
                    ? "The drowned shrine"
                    : panel?.startsWith("npc:")
                      ? villagers.find((v) => v.id === panel.slice(4))?.name
                      : panel?.startsWith("puzzle:")
                        ? puzzleRegistry.find((p) => p.id === panel.slice(7))
                            ?.title
                        : "";
  const currentNPC = panel?.startsWith("npc:")
    ? villagers.find((v) => v.id === panel.slice(4))
    : null;
  const currentPuzzle = panel?.startsWith("puzzle:")
    ? puzzleRegistry.find((p) => p.id === panel.slice(7))
    : null;
  const Puzzle = currentPuzzle?.component;
  return (
    <main className={`game-shell ${night ? "is-night" : ""}`}>
      <a className="skip-link" href="#captains-tools">
        Skip to game controls
      </a>
      <div
        className="world-wrap"
        role="group"
        aria-label="A low-poly fishing boat in fog-bound Marrow Bay, beside a lantern-lit village and dark rocky islands."
      >
        <Suspense
          fallback={
            <div className="world-loading">
              <Icon name="anchor" size={42} />
              <span>The bay is taking shape…</span>
            </div>
          }
        >
          <World
            position={game.position}
            phase={night ? 0.75 : 0.25}
            dread={Math.round(game.dread)}
            allWords={allWords}
            selectedSpot={selected?.id || null}
            onSelectSpot={markerSpot}
            onSelectSite={markerSite}
            onSelectNPC={markerNPC}
            paused={paused || !!panel || !!fishing || hidden || !game.started}
            reducedMotion={reduced}
          />
        </Suspense>
      </div>
      <div className="world-vignette" />
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            show("help");
          }}
          aria-label="The Drowned Ledger, game guide"
        >
          <span className="brand-mark">
            <Icon name="anchor" size={27} />
          </span>
          <span>
            The Drowned
            <br />
            <strong>Ledger</strong>
          </span>
        </a>
        <div className="chapter-tag">
          <span className="small-dot" /> A Marrow Bay story{" "}
          <span className="chapter-number">Chapter I</span>
        </div>
        <div className="top-tools">
          <button
            className="icon-btn"
            aria-label={sound ? "Mute sound" : "Enable sound"}
            aria-pressed={sound}
            onClick={async () => {
              try {
                setSound(await bayAudio.toggle());
                bayAudio.night(night);
                bayAudio.pause(paused || hidden);
              } catch {
                setNotice(
                  "Sound could not start. Check your browser’s audio permissions.",
                );
              }
            }}
          >
            <Icon name={sound ? "sound" : "mute"} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume game" : "Pause game"}
            aria-pressed={paused}
          >
            <Icon name={paused ? "play" : "pause"} />
          </button>
          <button
            className="icon-btn help-button"
            onClick={() => show("help")}
            aria-label="Open game guide"
          >
            <Icon name="help" />
          </button>
        </div>
      </header>
      <section className="location-card">
        <div className="eyebrow location-kicker">
          <span /> Somewhere you remember
        </div>
        <h1>
          Marrow Bay<span>.</span>
        </h1>
        <p className="location-subtitle">The sea keeps what it takes.</p>
        <div className="location-rule" />
        <div className="weather">
          <Icon name={night ? "moon" : "sun"} size={17} />
          <span>{clockText} · Heavy fog</span>
          <span className="weather-degree">12°</span>
        </div>
      </section>
      <aside className="voyage-status" aria-label="Voyage status">
        <div className="day-status">
          <Icon name={night ? "moon" : "sun"} size={28} />
          <div>
            <span className="eyebrow">Day {String(day).padStart(2, "0")}</span>
            <strong>{clockText}</strong>
          </div>
          <div
            className="day-dial"
            style={{
              background: `conic-gradient(var(--accent) ${phase * 360}deg, #33453b 0)`,
            }}
          >
            <span />
          </div>
        </div>
        <div className="dread-label">
          <span>
            <Icon name="eye" size={15} /> Dread
          </span>
          <strong>
            {Math.round(game.dread)}
            <span>/100</span>
          </strong>
        </div>
        <div
          className="dread-track"
          role="progressbar"
          aria-label="Dread"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(game.dread)}
        >
          <span style={{ width: `${game.dread}%` }} />
        </div>
        <p>
          {game.dread > 70
            ? "Something follows. Return to the dock."
            : night && !game.dock
              ? "Keep a light. Keep close."
              : "For now, the water is quiet."}
        </p>
      </aside>
      <section className="objective-card">
        <div className="eyebrow">
          <Icon name="compass" size={16} /> Your purpose
        </div>
        <h2>Recover what was lost.</h2>
        <p>
          Somewhere below, your old boat holds a Ledger. Find the twelve words
          that will bring it back.
        </p>
        <button className="objective-progress" onClick={() => show("bank")}>
          <span className="word-ticks" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} className={i < hunt.words.length ? "found" : ""} />
            ))}
          </span>
          <span>
            <strong>{String(hunt.words.length).padStart(2, "0")}</strong> / 12
            words recovered <Icon name="arrow" size={15} />
          </span>
        </button>
      </section>
      <div className="compass-rose" aria-hidden="true">
        <span>N</span>
        <svg viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="27" />
          <path d="M40 2v15m0 46v15M2 40h15m46 0h15M40 16l7 24-7 24-7-24Z" />
          <path className="compass-fill" d="m40 16 7 24h-7Z" />
        </svg>
        <span className="bearing">
          {Math.round(
            ((((game.position.heading * 180) / Math.PI) % 360) + 360) % 360,
          )}
          °
        </span>
      </div>
      {!game.started && (
        <section className="arrival-card">
          <span className="eyebrow">You’ve been here before</span>
          <h2>
            Some things
            <br />
            don’t stay buried.
          </h2>
          <p>
            Years ago, the bay took your boat. Your Ledger. Everything.
            <br />
            Tonight, you’ve come to take it back.
          </p>
          <button className="primary-btn" onClick={start}>
            Begin the crossing <Icon name="arrow" size={18} />
          </button>
          <span className="small muted">
            A quiet fishing mystery · Saved on this device
          </span>
        </section>
      )}
      {game.started && !fishing && !paused && (
        <section className="sailing-actions" id="game-actions" tabIndex={-1}>
          {selected && (
            <div className="course-line">
              <Icon name="compass" size={15} />
              <span>{selected.name}</span>
              <small>{Math.round(distance(game.position, selected))} m</small>
            </div>
          )}
          <div className="action-row">
            {game.dock ? (
              <button
                className="primary-btn"
                onClick={() => {
                  setGame((g) => ({ ...g, dock: false }));
                  setNotice("The ropes fall away. You are on your own again.");
                }}
              >
                Cast off <Icon name="sail" />
              </button>
            ) : (
              <button className="primary-btn fish-action" onClick={cast}>
                <Icon name="fish" />
                {nearby ? "Fish these ripples" : "Cast your line"}
                <kbd>Space</kbd>
              </button>
            )}
            <button className="secondary-btn" onClick={interact}>
              <Icon name={game.dock || nearDock ? "anchor" : "eye"} />
              {game.dock
                ? "Visit village"
                : nearDock
                  ? "Moor at dock"
                  : "Investigate"}
              <kbd>E</kbd>
            </button>
          </div>
          {selected && distance(game.position, selected) > 3 && (
            <button
              className="course-button"
              onClick={() => (autopilot ? setAutopilot(false) : sail())}
            >
              {autopilot ? "Take the helm" : "Sail to marker"}{" "}
              <Icon name={autopilot ? "pause" : "arrow"} size={14} />
            </button>
          )}
        </section>
      )}
      {fishing && (
        <Fishing
          key={fishing.id}
          strange={fishing.strange}
          paused={paused || !!panel || hidden}
          onCatch={landCatch}
          onCancel={() => setFishing(null)}
        />
      )}
      {paused && (
        <section className="pause-card">
          <Icon name="anchor" size={35} />
          <h2>A moment ashore.</h2>
          <p>The bay can wait. Your voyage is paused.</p>
          <button className="primary-btn" onClick={() => setPaused(false)}>
            Resume voyage <Icon name="play" size={16} />
          </button>
        </section>
      )}
      <div className="chart-preview">
        <button onClick={() => show("chart")} aria-label="Open bay chart">
          <svg viewBox="0 0 170 125" aria-hidden="true">
            <path className="chart-water" d="M0 0h170v125H0Z" />
            <path
              className="chart-grid"
              d="M0 30h170M0 60h170M0 90h170M40 0v125M80 0v125M120 0v125M160 0v125"
            />
            <path
              className="chart-land"
              d="m0 0 42 0 6 12-9 13 20 16-6 18 14 15-13 10 3 21-21 20H0ZM132 13l12-5 14 11-8 17-16-5-8-10ZM125 85l11-4 13 13-7 19-20-10Z"
            />
            {strangeFish.map((s) => (
              <circle
                key={s.id}
                cx={(s.x + 30) * 2.2}
                cy={(s.z + 29) * 1.9}
                r="2"
              />
            ))}
            <g
              transform={`translate(${(game.position.x + 30) * 2.2},${(game.position.z + 29) * 1.9}) rotate(${(game.position.heading * 180) / Math.PI})`}
            >
              <path className="chart-boat" d="m0-5 3 9-3-2-3 2Z" />
            </g>
            <text x="159" y="15">
              N
            </text>
          </svg>
          <span>
            <Icon name="map" size={14} /> Bay chart <kbd>M</kbd>
          </span>
        </button>
      </div>
      <div className="bottom-note">
        <span className="small-dot" />{" "}
        {game.dock
          ? "Moored at Marrow dock"
          : autopilot
            ? "Following your marked course"
            : "Marrow Bay · Eastern waters"}{" "}
        · {game.inventory.length} in hold
        <span className="save-note">
          {saveError ? "Saving unavailable" : "Progress saves automatically"}
        </span>
      </div>
      <nav
        id="captains-tools"
        tabIndex={-1}
        className="bottom-nav"
        aria-label="Captain’s tools"
      >
        <button onClick={() => show("journal")}>
          <Icon name="book" />
          <span>Journal</span>
          <kbd>J</kbd>
        </button>
        <button onClick={() => show("bank")}>
          <Icon name="words" />
          <span>Word bank</span>
          <span className="nav-count">{hunt.words.length}</span>
          <kbd>B</kbd>
        </button>
        <button onClick={() => show("quests")}>
          <Icon name="quests" />
          <span>Quest log</span>
          <kbd>Q</kbd>
        </button>
        <button className="mobile-map" onClick={() => show("chart")}>
          <Icon name="map" />
          <span>Chart</span>
        </button>
      </nav>
      <div className="keyboard-hint">
        <span>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> Steer
        </span>
        <span>Drag to look</span>
      </div>
      {game.started && !panel && !paused && !fishing && (
        <TouchStick keysRef={keys} />
      )}
      {notice && !hunt.toast && (
        <div className="toast game-notice" role="status">
          <Icon name="bell" size={18} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss message"
            className="icon-btn"
            onClick={() => setNotice("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {hunt.toast && (
        <div className="toast word-toast" role="status">
          <Icon name="words" size={24} />
          <div>
            <span className="eyebrow">You found a word</span>
            <strong>{hunt.toast.word}</strong>
            <span>Recovered from the deep. Saved in your word bank.</span>
          </div>
          <button
            className="icon-btn"
            onClick={hunt.dismissToast}
            aria-label="Dismiss word notification"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {(hunt.error || saveError) && (
        <div className="save-warning" role="alert">
          {hunt.error || saveError}
          {!hunt.config && (
            <button onClick={() => void initializeHunt()}>
              Retry hunt data
            </button>
          )}
        </div>
      )}
      {panel && (
        <Modal
          title={modalTitle || "Marrow Bay"}
          kicker={
            panel === "shrine"
              ? "What was kept, may be returned"
              : "The Drowned Ledger"
          }
          onClose={() => show(null)}
          wide={["chart", "journal", "ledger", "shrine"].includes(panel)}
        >
          {panel === "journal" && (
            <>
              <div className="tab-row">
                <button
                  aria-pressed={journalTab === "fish"}
                  onClick={() => setJournalTab("fish")}
                >
                  Fish journal <span>{game.caught.length}/11</span>
                </button>
                <button
                  aria-pressed={journalTab === "notes"}
                  onClick={() => setJournalTab("notes")}
                >
                  Field notes{" "}
                  <span>{hunt.entries.length + game.notes.length + 1}</span>
                </button>
              </div>
              {journalTab === "fish" ? (
                <div className="fish-grid">
                  {[
                    ...strangeFish,
                    ...ordinaryFish.map((name) => ({
                      id: name,
                      name,
                      description:
                        "An ordinary fish from an extraordinary place.",
                    })),
                  ].map((f, i) => (
                    <article
                      key={f.id}
                      className={`fish-entry ${game.caught.includes(f.id) ? "discovered" : ""}`}
                    >
                      <div className="fish-illustration">
                        <FishDrawing variant={i} />
                      </div>
                      <span className="eyebrow">
                        {i < 5 ? "Aberration" : "Common waters"}
                      </span>
                      <h3>
                        {game.caught.includes(f.id)
                          ? f.name
                          : "Unrecorded catch"}
                      </h3>
                      <p>
                        {game.caught.includes(f.id)
                          ? f.description
                          : i < 5
                            ? "Follow the marked ripples. Some things only surface after dark."
                            : "Cast your line in open water to discover this species."}
                      </p>
                      {game.caught.includes(f.id) && (
                        <span className="discovered-label">
                          <Icon name="check" size={13} /> Recorded
                        </span>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="field-notes">
                  <article>
                    <span className="eyebrow">The return</span>
                    <h3>Everything was on that boat.</h3>
                    <p>
                      The Ledger hardware wallet. The seed card with its twelve
                      words. I remember the water coming in. I remember a light
                      below the waterline. I don’t remember reaching the shore.
                    </p>
                    <p>
                      The villagers recognise me. None of them will say from
                      when.
                    </p>
                  </article>
                  {hunt.entries.map((entry) => (
                    <article key={entry.sourceId}>
                      <span className="eyebrow">
                        A recovered word ·{" "}
                        {new Date(entry.date).toLocaleDateString()}
                      </span>
                      <p>
                        From{" "}
                        {strangeFish.find((s) => s.id === entry.sourceId)
                          ?.name ||
                          puzzleRegistry.find((p) => p.id === entry.sourceId)
                            ?.title ||
                          "the bay"}
                        : <mark>{entry.word}</mark>. Keep it safe. Its place in
                        the phrase is still unknown.
                      </p>
                    </article>
                  ))}
                  {game.notes.map((note, i) => (
                    <article key={i}>
                      <p>{note}</p>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {panel === "bank" && (
            <>
              <p className="panel-intro">
                Twelve words. One way back. Words are kept in the order you find
                them; the shrine will tell you how they belong together.
              </p>
              <div className="bank-count">
                <strong>{hunt.words.length}</strong>
                <span>of 12 recovered</span>
              </div>
              <div className="word-bank">
                {hunt.words.map((w, i) => (
                  <div className="word-tile" key={`${w}-${i}`}>
                    <Icon name="leaf" size={15} />
                    {w}
                  </div>
                ))}
                {Array.from({ length: 12 - hunt.words.length }, (_, i) => (
                  <div className="word-tile empty" key={`empty-${i}`}>
                    <Icon name="lock" size={14} /> Unrecovered
                  </div>
                ))}
              </div>
              <p className="notice">
                Five words lie inside strange fish. Seven wait in village games
                and chores. When all twelve return, seek the far shore after
                dark.
              </p>
              <button className="secondary-btn" onClick={() => show("ledger")}>
                Open the Ledger <Icon name="arrow" size={17} />
              </button>
            </>
          )}
          {panel === "quests" && (
            <>
              <p className="panel-intro">
                The village trades in favours. Meet the workers at the dock;
                investigate the places they leave unlocked.
              </p>
              <div className="section-heading">
                <h3>The fishermen’s favours</h3>
                <span>{game.completed.length}/5 complete</span>
              </div>
              <div className="quest-list">
                {villagers.map((v) => (
                  <button
                    key={v.id}
                    onClick={() =>
                      game.dock
                        ? openNPC(v.id)
                        : (selectSpot(v.fish), show(null))
                    }
                  >
                    <span
                      className={`quest-dot ${game.completed.includes(v.id) ? "complete" : ""}`}
                    >
                      {game.completed.includes(v.id) ? "✓" : "◇"}
                    </span>
                    <span>
                      <strong>{v.name}</strong>
                      <small>
                        {game.completed.includes(v.id)
                          ? "A favour repaid"
                          : game.accepted.includes(v.id)
                            ? `Bring back ${strangeFish.find((f) => f.id === v.fish)?.name}`
                            : `Speak to the ${v.role.toLowerCase()}`}
                      </small>
                    </span>
                    <span className="quest-state">
                      {game.completed.includes(v.id)
                        ? "Complete"
                        : game.accepted.includes(v.id)
                          ? "In progress"
                          : "Unmet"}
                    </span>
                  </button>
                ))}
              </div>
              <div className="section-heading">
                <h3>Seven village secrets</h3>
                <span>
                  {
                    puzzleRegistry.filter((p) => hunt.foundIds.includes(p.id))
                      .length
                  }
                  /7 found
                </span>
              </div>
              <div className="quest-list">
                {puzzleRegistry.map((p) => (
                  <button key={p.id} onClick={() => openSite(p.id)}>
                    <span className="quest-dot">
                      {hunt.foundIds.includes(p.id) ? "✓" : "⌑"}
                    </span>
                    <span>
                      <strong>{p.title}</strong>
                      <small>
                        {p.site.name}
                        {p.nightOnly ? " · After dark" : ""}
                      </small>
                    </span>
                    <span className="quest-state">
                      {hunt.foundIds.includes(p.id)
                        ? "Found"
                        : game.visited.includes(p.id)
                          ? "Visited"
                          : "Unvisited"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="small muted">
                The seven village games are coming in a later chapter.
              </p>
            </>
          )}
          {panel === "chart" && (
            <>
              <p className="panel-intro">
                Mark a destination, then sail to it or take the helm with WASD.
                The night reaches further than the lanterns.
              </p>
              <div className="large-chart">
                <svg
                  viewBox="0 0 560 340"
                  role="img"
                  aria-label="Chart with village west, five fishing grounds east, and shrine on the northeast shore"
                >
                  <defs>
                    <pattern
                      id="grid"
                      width="35"
                      height="35"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M35 0H0v35"
                        fill="none"
                        stroke="#445247"
                        strokeWidth=".5"
                      />
                    </pattern>
                  </defs>
                  <rect width="560" height="340" fill="url(#grid)" />
                  <path
                    className="chart-land"
                    d="M0 0h121l34 42-16 38 25 55-13 43 33 43-32 48 3 40-34 31H0Z"
                  />
                  <path
                    className="chart-shore"
                    d="M128 0 166 42l-14 38 23 55-12 43 32 43-30 48 3 40-34 31"
                  />
                  <text x="31" y="170" className="chart-title">
                    MARROW
                  </text>
                  <text x="43" y="190" className="chart-title">
                    VILLAGE
                  </text>
                  {strangeFish.map((s, i) => (
                    <g
                      key={s.id}
                      transform={`translate(${(s.x + 25) * 8},${(s.z + 29) * 5.4})`}
                    >
                      <circle r="12" fill="#233d34" stroke="#b5c69a" />
                      <text y="4" textAnchor="middle" fill="#ddd6b6">
                        {i + 1}
                      </text>
                    </g>
                  ))}
                  <text x="520" y="27" className="chart-title">
                    N ↑
                  </text>
                  <g
                    transform={`translate(${(game.position.x + 25) * 8},${(game.position.z + 29) * 5.4}) rotate(${(game.position.heading * 180) / Math.PI})`}
                  >
                    <path className="chart-boat" d="m0-8 5 14-5-3-5 3Z" />
                  </g>
                </svg>
              </div>
              <div className="chart-destinations">
                <button
                  onClick={() => {
                    setSelected({
                      id: "dock",
                      name: "Marrow dock",
                      x: -8,
                      z: 5,
                    });
                    show(null);
                  }}
                >
                  <Icon name="anchor" />
                  <span>
                    <strong>Marrow dock</strong>
                    <small>A little shelter from the bay</small>
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
                {strangeFish.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      selectSpot(s.id);
                      show(null);
                    }}
                  >
                    <span className="destination-number">{i + 1}</span>
                    <span>
                      <strong>{s.spot}</strong>
                      <small>
                        {s.night ? "Bites after dark" : "Ripples in the fog"}{" "}
                        {hunt.foundIds.includes(s.id) ? "· Word recovered" : ""}
                      </small>
                    </span>
                    <Icon name={s.night ? "moon" : "arrow"} size={16} />
                  </button>
                ))}
                <button
                  onClick={() => {
                    setSelected({
                      id: "minesweeper",
                      name: "The rusted ring",
                      x: 13,
                      z: 22,
                    });
                    show(null);
                  }}
                >
                  <Icon name="compass" />
                  <span>
                    <strong>The rusted ring</strong>
                    <small>Marker posts on the open bay</small>
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
                {allWords && night && (
                  <button
                    onClick={() => {
                      setSelected({
                        id: "shrine",
                        name: "The drowned shrine",
                        x: 22,
                        z: -25,
                      });
                      show(null);
                    }}
                  >
                    <Icon name="lock" />
                    <span>
                      <strong>The drowned shrine</strong>
                      <small>The far shore is calling</small>
                    </span>
                    <Icon name="arrow" size={16} />
                  </button>
                )}
              </div>
            </>
          )}
          {panel === "dock" && (
            <>
              <p className="panel-intro">
                Oilskins drip on the planks. Heavy eyes follow your boat. The
                workers all wear the same apron: <em>IMD</em>.
              </p>
              <div className="dock-actions">
                <button
                  className="secondary-btn"
                  onClick={() => {
                    setGame((g) => ({
                      ...g,
                      elapsed:
                        Math.floor(g.elapsed / 480) * 480 +
                        (night ? 480 + 30 : 270),
                      dread: 0,
                    }));
                    setNotice(
                      night
                        ? "Morning finds the village already working."
                        : "The last light leaves the water.",
                    );
                    bayAudio.effect("bell");
                    show(null);
                  }}
                >
                  <Icon name={night ? "sun" : "moon"} />
                  {night ? "Rest until dawn" : "Wait for night"}
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => {
                    setGame((g) => ({ ...g, dock: false }));
                    show(null);
                  }}
                >
                  Cast off <Icon name="sail" />
                </button>
              </div>
              <div className="villager-grid">
                {villagers.map((v, i) => (
                  <button
                    key={v.id}
                    className="villager-card"
                    onClick={() => openNPC(v.id)}
                  >
                    <PepePortrait variant={i} />
                    <span>
                      <strong>{v.name}</strong>
                      <small>{v.role}</small>
                    </span>
                    <Icon
                      name={game.completed.includes(v.id) ? "check" : "arrow"}
                      size={16}
                    />
                  </button>
                ))}
              </div>
              <div className="section-heading">
                <h3>Around the village</h3>
              </div>
              <div className="site-grid">
                {puzzleRegistry
                  .filter((p) => p.id !== "minesweeper")
                  .map((p) => (
                    <button key={p.id} onClick={() => openSite(p.id)}>
                      <Icon name={p.nightOnly ? "moon" : "compass"} size={18} />
                      <span>
                        <strong>{p.title}</strong>
                        <small>
                          {p.site.name}
                          {p.nightOnly ? " · Night only" : ""}
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
            </>
          )}
          {currentNPC && (
            <div className="dialogue">
              <div className="dialogue-person">
                <PepePortrait variant={villagers.indexOf(currentNPC)} />
                <div>
                  <span className="eyebrow">{currentNPC.role}</span>
                  <p>{currentNPC.bio}</p>
                </div>
              </div>
              <blockquote>
                “
                {game.completed.includes(currentNPC.id)
                  ? currentNPC.reply
                  : currentNPC.intro}
                ”
              </blockquote>
              {!game.accepted.includes(currentNPC.id) ? (
                <button
                  className="primary-btn"
                  onClick={() => {
                    setGame((g) => ({
                      ...g,
                      accepted: [...g.accepted, currentNPC.id],
                    }));
                    setNotice(
                      `${currentNPC.name} is waiting for a ${strangeFish.find((f) => f.id === currentNPC.fish)?.name}.`,
                    );
                  }}
                >
                  I’ll find your fish <Icon name="arrow" size={17} />
                </button>
              ) : game.completed.includes(currentNPC.id) ? (
                <p className="notice">
                  <Icon name="check" size={17} /> A favour repaid. The village
                  remembers.
                </p>
              ) : game.inventory.includes(currentNPC.fish) ? (
                <button
                  className="primary-btn"
                  onClick={() => {
                    setGame((g) => ({
                      ...g,
                      inventory: g.inventory.filter(
                        (f, i) => i !== g.inventory.indexOf(currentNPC.fish),
                      ),
                      completed: [...g.completed, currentNPC.id],
                      notes: [
                        ...g.notes,
                        `${currentNPC.name}: “${currentNPC.reply}”`,
                      ],
                    }));
                    bayAudio.effect("bell");
                    setNotice(`${currentNPC.name}’s favour is repaid.`);
                  }}
                >
                  Hand over the{" "}
                  {strangeFish.find((f) => f.id === currentNPC.fish)?.name}
                  <Icon name="arrow" size={17} />
                </button>
              ) : (
                <div className="notice">
                  Find the{" "}
                  {strangeFish.find((f) => f.id === currentNPC.fish)?.name} at{" "}
                  {strangeFish.find((f) => f.id === currentNPC.fish)?.spot}.{" "}
                  {strangeFish.find((f) => f.id === currentNPC.fish)?.night
                    ? "It only bites after dark."
                    : ""}
                  <button
                    className="secondary-btn"
                    onClick={() => {
                      selectSpot(currentNPC.fish);
                      show(null);
                    }}
                  >
                    Mark the fishing ground <Icon name="compass" size={16} />
                  </button>
                </div>
              )}
              <button className="text-button" onClick={() => show("dock")}>
                Return to the village
              </button>
            </div>
          )}
          {currentPuzzle && Puzzle && (
            <Puzzle onSolved={() => foundWord(currentPuzzle.id)} />
          )}
          {(panel === "ledger" || panel === "shrine") &&
            (hunt.config ? (
              <Suspense fallback={<p role="status">Opening the Ledger…</p>}>
                <ChestPanel
                  config={hunt.config}
                  words={hunt.words}
                  shrine={panel === "shrine"}
                />
              </Suspense>
            ) : (
              <p>
                The hunt data has not loaded. Close this panel and retry the
                hunt data.
              </p>
            ))}
          {panel === "help" && (
            <div className="help-content">
              <p className="panel-intro">
                Return to the bay that took everything. Catch strange fish, earn
                the workers’ trust, and gather the scattered words of your lost
                seed card.
              </p>
              <h3>Take the helm</h3>
              <dl className="controls-list">
                <div>
                  <dt>W / S</dt>
                  <dd>Forward / reverse</dd>
                </div>
                <div>
                  <dt>A / D</dt>
                  <dd>Turn the boat</dd>
                </div>
                <div>
                  <dt>Mouse drag</dt>
                  <dd>Look around the bay</dd>
                </div>
                <div>
                  <dt>Space</dt>
                  <dd>Cast, then reel in the marked zone</dd>
                </div>
                <div>
                  <dt>E</dt>
                  <dd>Moor, visit or investigate nearby</dd>
                </div>
                <div>
                  <dt>J / B / Q / M</dt>
                  <dd>Journal, word bank, quests, chart</dd>
                </div>
                <div>
                  <dt>Escape</dt>
                  <dd>Close a panel / pause your voyage</dd>
                </div>
              </dl>
              <p>
                On touch screens, use the steering stick and the on-screen
                action buttons. You can also mark a destination in the chart and
                choose “Sail to marker”.
              </p>
              <h3>The bay after dark</h3>
              <p>
                A full day takes eight minutes. Night raises dread away from the
                dock. At its limit, you wake ashore without your catch. Your
                recorded fish and recovered words remain. Docking lowers dread;
                rest at the village to change the time.
              </p>
              <h3>What the water keeps</h3>
              <p>
                Ordinary fish fill the journal. Each of the five strange fish
                lives at its own marked ripple; two only bite at night. Three
                timed strikes land a catch. The seven village puzzle sites open
                in a later chapter. This is the base chapter of a planned 40–60
                minute mystery.
              </p>
              <p>
                No wallet is needed to explore, fish or save your progress. The
                Ledger’s optional chain actions ask your wallet to approve each
                transaction. Enter only the words recovered in this game.
              </p>
              <label className="setting">
                <input
                  type="checkbox"
                  checked={reduced}
                  onChange={(e) => setReduced(e.target.checked)}
                />{" "}
                Reduce environmental motion
              </label>
              <p className="small muted">
                Progress stays in this browser. Clearing site data removes your
                saved voyage.
              </p>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}

function TouchStick({ keysRef }: { keysRef: React.RefObject<Set<string>> }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const root = useRef<HTMLDivElement>(null);
  const update = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    const x = Math.max(-28, Math.min(28, e.clientX - r.left - r.width / 2)),
      y = Math.max(-28, Math.min(28, e.clientY - r.top - r.height / 2));
    setOffset({ x, y });
    keysRef.current.clear();
    if (x < -10) keysRef.current.add("a");
    if (x > 10) keysRef.current.add("d");
    if (y < -10) keysRef.current.add("w");
    if (y > 10) keysRef.current.add("s");
  };
  const stop = () => {
    keysRef.current.clear();
    setOffset({ x: 0, y: 0 });
  };
  return (
    <div
      ref={root}
      className="touch-stick"
      aria-label="Touch steering stick. Drag up to move, left or right to turn."
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons) update(e);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      <span style={{ transform: `translate(${offset.x}px,${offset.y}px)` }}>
        <Icon name="compass" size={24} />
      </span>
    </div>
  );
}
function FishDrawing({ variant }: { variant: number }) {
  return (
    <svg viewBox="0 0 150 65" aria-hidden="true">
      <g transform={variant === 1 ? "translate(0 12) scale(1 .65)" : ""}>
        <path
          d="M24 32Q57-5 121 31 65 75 24 32L5 14l3 35 16-17Z"
          fill="currentColor"
          opacity=".32"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="m51 19 11-13 23 13m-35 29 11 11 15-9M99 23q-11 10-1 21"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="109" cy="29" r="2" fill="currentColor" />
        {variant === 3 && (
          <path d="M43 35h43m-35-4v8m9-8v8m9-8v8m9-8v8" stroke="currentColor" />
        )}
        {variant === 2 && (
          <text
            x="41"
            y="35"
            fill="currentColor"
            fontSize="8"
            fontFamily="monospace"
          >
            001 101 011
          </text>
        )}
      </g>
    </svg>
  );
}
