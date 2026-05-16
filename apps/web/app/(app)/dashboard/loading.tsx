export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-9 w-64 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-200 rounded-xl" />
        ))}
      </div>
      <div className="h-16 bg-slate-200 rounded-2xl" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-slate-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
