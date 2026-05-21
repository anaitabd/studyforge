export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-1">
        <div className="h-8 w-36 bg-slate-200 rounded-xl" />
        <div className="h-4 w-64 bg-slate-200 rounded-lg" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
