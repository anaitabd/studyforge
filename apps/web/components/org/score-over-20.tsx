interface ScoreOver20Props {
  score: number | null;
  total?: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreOver20({ score, total = 20, size = "md" }: ScoreOver20Props) {
  if (score === null) {
    return <span className="text-slate-400 text-sm">Pending</span>;
  }

  const pct = score / total;
  const color =
    pct >= 0.8 ? "text-emerald-600" :
    pct >= 0.7 ? "text-green-600" :
    pct >= 0.6 ? "text-lime-600" :
    pct >= 0.5 ? "text-amber-600" :
    "text-red-600";

  const sizeClass =
    size === "sm" ? "text-lg font-bold" :
    size === "lg" ? "text-4xl font-bold" :
    "text-2xl font-bold";

  return (
    <span className={`${sizeClass} ${color}`}>
      {score.toFixed(1)}
      <span className="text-slate-400 font-normal text-sm">/{total}</span>
    </span>
  );
}
