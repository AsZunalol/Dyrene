export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">

      <div className="relative z-10 px-6 pt-8 pb-12">
        <div className="max-w-7xl mx-auto">
          <div
            className="rounded-xl p-8 border border-line shadow-lg mb-8 animate-pulse"
            style={{
              background:
                "var(--surface)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="h-4 w-40 rounded bg-elevated mb-4" />
            <div className="h-10 w-56 rounded bg-elevated mb-4" />
            <div className="h-5 w-[28rem] max-w-full rounded bg-elevated" />
          </div>

          <div
            className="rounded-xl p-6 border border-line shadow-lg animate-pulse"
            style={{
              background:
                "var(--surface)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-12 rounded-xl bg-elevated" />
              <div className="h-12 rounded-xl bg-elevated" />
              <div className="h-32 rounded-xl bg-elevated md:col-span-2" />
              <div className="h-32 rounded-xl bg-elevated md:col-span-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}