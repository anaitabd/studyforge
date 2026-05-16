export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-36 bg-slate-200 rounded-xl" />
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-slate-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
