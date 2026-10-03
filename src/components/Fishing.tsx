import { useEffect, useRef, useState } from "react";
import { bayAudio } from "../game/audio";
import { fishingHit } from "../game/data";
import { Icon } from "./Icon";
export function Fishing({
  strange,
  paused,
  onCatch,
  onCancel,
}: {
  strange: boolean;
  paused: boolean;
  onCatch: () => void;
  onCancel: () => void;
}) {
  const landed = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (landed.current) clearTimeout(landed.current);
    },
    [],
  );
  const [stage, setStage] = useState<"waiting" | "reeling" | "lost">("waiting");
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState(
    "Hold steady. Something is listening.",
  );
  const waitingTime = useRef(2200 + Math.random() * 1800),
    pausedRef = useRef(paused);
  pausedRef.current = paused;
  const needle = useRef(0.5),
    bar = useRef<HTMLSpanElement>(null),
    lastStrike = useRef(0),
    strikeRef = useRef(() => {});
  useEffect(() => {
    bayAudio.effect("splash");
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      waitingTime.current -= 100;
      if (waitingTime.current <= 0) {
        clearInterval(timer);
        setStage("reeling");
        setFeedback(
          "A bite. Strike while the needle is inside the marked zone.",
        );
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (stage !== "reeling" || paused) return;
    let frame = 0;
    const start = performance.now();
    const animate = (time: number) => {
      needle.current =
        (Math.sin((time - start) / (strange ? 390 : 520)) + 1) / 2;
      if (bar.current) bar.current.style.left = `${needle.current * 100}%`;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [stage, strange, paused]);
  const strike = () => {
    if (
      paused ||
      stage !== "reeling" ||
      performance.now() - lastStrike.current < 330
    )
      return;
    lastStrike.current = performance.now();
    bayAudio.effect("reel");
    if (fishingHit(needle.current, strange)) {
      const n = hits + 1;
      setHits(n);
      setFeedback(
        n === 3
          ? "The line holds. It’s yours."
          : `${n} of 3 strikes. Keep the line tight.`,
      );
      if (n === 3) {
        setStage("waiting");
        landed.current = setTimeout(onCatch, 450);
      }
    } else {
      const n = misses + 1;
      setMisses(n);
      setFeedback(
        n >= 3
          ? "The line snaps. Whatever it was is gone."
          : `Missed. ${3 - n} ${3 - n === 1 ? "chance" : "chances"} left.`,
      );
      if (n >= 3) setStage("lost");
    }
  };
  strikeRef.current = strike;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        !pausedRef.current &&
        !(e.target instanceof HTMLButtonElement) &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        e.preventDefault();
        strikeRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <section className="fishing-panel" aria-label="Fishing minigame">
      <div className="fishing-heading">
        <Icon name="fish" />
        <span className="eyebrow">
          {strange ? "An unfamiliar weight" : "Line in the water"}
        </span>
        <button
          className="icon-btn"
          aria-label="Stop fishing"
          onClick={onCancel}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <h2>
        {stage === "waiting"
          ? hits === 3
            ? "Something from the deep."
            : "Wait for the bite…"
          : stage === "lost"
            ? "Back to the depths."
            : "Steady your hand."}
      </h2>
      <div
        className="timing-bar"
        aria-label={`Timing bar, ${hits} of 3 hits, ${misses} misses`}
      >
        <div className="catch-zone" style={{ width: strange ? "19%" : "32%" }}>
          <span>Strike zone</span>
        </div>
        <span ref={bar} className="needle" />
      </div>
      <div
        className="fishing-progress"
        aria-label={`${hits} successful strikes`}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className={hits > i ? "is-hit" : ""}>
            {hits > i ? "✓" : i + 1}
          </span>
        ))}
      </div>
      <p className="fishing-feedback" role="status">
        {feedback}
      </p>
      {stage === "lost" ? (
        <button className="secondary-btn" onClick={onCancel}>
          Return to the water
        </button>
      ) : (
        <button
          className="primary-btn"
          disabled={paused || stage !== "reeling"}
          onClick={strike}
        >
          Reel in <kbd>Space</kbd>
        </button>
      )}
      <p className="small muted">
        Three timed strikes land a catch. Three misses break the line.
      </p>
    </section>
  );
}
