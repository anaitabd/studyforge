export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-32 bg-slate-200 rounded-xl" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 bg-slate-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
