export default function ResultsLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
      <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
