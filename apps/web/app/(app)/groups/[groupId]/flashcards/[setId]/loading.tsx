export default function Loading() {
  return (
    <div className="max-w-xl mx-auto space-y-6 animate-pulse">
      <div className="h-5 w-24 bg-slate-200 rounded-lg" />
      <div className="h-56 bg-slate-200 rounded-2xl" />
      <div className="flex justify-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-20 bg-slate-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
