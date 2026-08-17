export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6" aria-busy="true" aria-label="Đang tải">
      <div className="mx-auto max-w-7xl animate-pulse space-y-5">
        <div className="h-20 rounded-3xl bg-white shadow-sm" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 rounded-3xl bg-white shadow-sm" />)}
        </div>
        <div className="h-16 rounded-2xl bg-white shadow-sm" />
        <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          {Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-12 rounded-xl bg-slate-100" />)}
        </div>
      </div>
    </main>
  );
}
