export interface PuzzleProps {
  onSolved: () => void;
}

export function ComingSoon({ flavour }: PuzzleProps & { flavour: string }) {
  return (
    <div className="coming-soon">
      <span className="eyebrow">A village secret</span>
      <h3>Coming soon</h3>
      <p>{flavour}</p>
      <p className="muted">
        This part of the village will open in a later chapter.
      </p>
    </div>
  );
}
