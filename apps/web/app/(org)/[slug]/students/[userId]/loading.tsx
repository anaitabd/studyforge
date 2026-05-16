export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-slate-200" />
        <div className="space-y-2">
          <div className="h-6 w-40 bg-slate-200 rounded-xl" />
          <div className="h-4 w-28 bg-slate-200 rounded-xl" />
        </div>
      </div>
      <div className="h-48 bg-slate-200 rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
