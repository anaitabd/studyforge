export default function PricingLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">
      <div className="text-center space-y-3">
        <div className="h-9 w-48 rounded-lg bg-slate-200 animate-pulse mx-auto" />
        <div className="h-4 w-72 rounded bg-slate-100 animate-pulse mx-auto" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="space-y-2">
              <div className="h-5 w-20 rounded bg-slate-200 animate-pulse" />
              <div className="h-8 w-28 rounded bg-slate-200 animate-pulse" />
              <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
            </div>
            <div className="h-10 rounded-xl bg-slate-200 animate-pulse" />
            <div className="space-y-2.5">
              {[0, 1, 2, 3, 4].map((j) => (
                <div key={j} className="h-3 w-full rounded bg-slate-100 animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
