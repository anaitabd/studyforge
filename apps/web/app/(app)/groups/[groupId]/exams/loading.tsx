export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-28 bg-slate-200 rounded-xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 bg-slate-200 rounded-xl" />
      ))}
    </div>
  );
}
