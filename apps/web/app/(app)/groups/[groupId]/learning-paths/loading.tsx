export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-44 bg-slate-200 rounded-xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 bg-slate-200 rounded-xl" />
      ))}
    </div>
  );
}
