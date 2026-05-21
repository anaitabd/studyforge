export default function Loading() {
  return (
    <div className="max-w-2xl space-y-6 animate-pulse">
      <div className="h-8 w-40 bg-slate-200 rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-200 rounded-xl" />
        ))}
      </div>
      <div className="h-10 w-28 bg-slate-200 rounded-xl" />
    </div>
  );
}
