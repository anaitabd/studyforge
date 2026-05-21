export default function ChatLoading() {
  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6 h-[calc(100vh-12rem)]">
      <aside className="hidden lg:flex flex-col gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="h-3 w-28 rounded bg-slate-200 animate-pulse" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
          {[0, 1].map((i) => (
            <div key={i} className="h-6 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      </aside>

      <div className="flex flex-col gap-4">
        <div className="flex-1 space-y-4">
          <div className="flex justify-end">
            <div className="h-10 w-56 rounded-2xl bg-slate-200 animate-pulse" />
          </div>
          <div className="flex justify-start">
            <div className="h-20 w-72 rounded-2xl bg-slate-100 animate-pulse" />
          </div>
          <div className="flex justify-end">
            <div className="h-8 w-40 rounded-2xl bg-slate-200 animate-pulse" />
          </div>
          <div className="flex justify-start">
            <div className="h-28 w-80 rounded-2xl bg-slate-100 animate-pulse" />
          </div>
        </div>
        <div className="h-14 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}
