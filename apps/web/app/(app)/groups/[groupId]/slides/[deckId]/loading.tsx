export default function SlideDeckLoading() {
  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-10rem)]">
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
        <div className="h-2 flex-1 mx-6 rounded-full bg-slate-100 animate-pulse" />
        <div className="h-4 w-16 rounded bg-slate-200 animate-pulse" />
      </div>

      <div className="flex-1 rounded-2xl bg-slate-100 animate-pulse" />

      <div className="flex items-center justify-center gap-3">
        <div className="h-9 w-24 rounded-lg bg-slate-200 animate-pulse" />
        <div className="h-4 w-12 rounded bg-slate-100 animate-pulse" />
        <div className="h-9 w-24 rounded-lg bg-slate-200 animate-pulse" />
      </div>
    </div>
  );
}
