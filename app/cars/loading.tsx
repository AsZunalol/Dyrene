export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">

      <div className="relative z-10 px-6 pt-32 pb-12">
        <div className="max-w-6xl mx-auto">
          <div
            className="rounded-2xl p-8 border border-white/10 shadow-lg mb-8 animate-pulse"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="h-4 w-32 rounded bg-white/10 mb-4" />
            <div className="h-10 w-48 rounded bg-white/10 mb-4" />
            <div className="h-5 w-72 rounded bg-white/10" />
          </div>

          <div
            className="rounded-2xl p-6 border border-white/10 shadow-lg animate-pulse"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="h-8 w-40 rounded bg-white/10 mb-4" />
            <div className="h-4 w-32 rounded bg-white/10 mb-6" />

            <div className="space-y-3">
              <div className="h-12 rounded-xl bg-white/10" />
              <div className="h-12 rounded-xl bg-white/10" />
              <div className="h-12 rounded-xl bg-white/10" />
              <div className="h-12 rounded-xl bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}