export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-40 bg-slate-200 rounded-xl" />
      <div className="h-14 bg-slate-200 rounded-2xl" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
