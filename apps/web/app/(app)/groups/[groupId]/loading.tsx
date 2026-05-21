export default function GroupOverviewLoading() {
  return (
    <div className="space-y-6">
      <div className="h-28 rounded-xl bg-slate-100 animate-pulse" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
