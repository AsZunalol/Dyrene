export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden">

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
            <div className="h-10 w-56 rounded bg-elevated mb-4" />
            <div className="h-5 w-60 rounded bg-elevated" />
          </div>

          <div
            className="rounded-xl p-6 border border-line shadow-lg animate-pulse"
            style={{
              background:
                "var(--surface)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="space-y-3">
              <div className="h-12 rounded-xl bg-elevated" />
              <div className="h-12 rounded-xl bg-elevated" />
              <div className="h-12 rounded-xl bg-elevated" />
              <div className="h-12 rounded-xl bg-elevated" />
              <div className="h-12 rounded-xl bg-elevated" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}