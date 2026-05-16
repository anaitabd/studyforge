export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-36 bg-slate-200 rounded-xl" />
      <div className="h-10 bg-slate-200 rounded-lg" />
      <div className="rounded-xl border border-slate-100 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-50 border-b border-slate-100 last:border-0" />
        ))}
      </div>
    </div>
  );
}
