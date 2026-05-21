export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-5 w-28 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-slate-200 rounded-2xl" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
