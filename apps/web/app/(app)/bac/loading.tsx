export default function BacLoading() {
  return (
    <div className="space-y-8">
      <div className="h-9 w-48 bg-slate-100 rounded animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
      <div className="h-52 rounded-xl bg-slate-100 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
