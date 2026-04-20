export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07203a] text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a223d] via-[#103b63] to-[#06111f]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_30%),radial-gradient(circle_at_bottom,rgba(15,23,42,0.65),transparent_45%)]" />
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative z-10 px-6 pt-32 pb-12">
        <div className="max-w-7xl mx-auto">
          <div
            className="rounded-2xl p-8 border border-white/10 shadow-lg mb-8 animate-pulse"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="h-4 w-32 rounded bg-white/10 mb-4" />
            <div className="h-10 w-64 rounded bg-white/10 mb-4" />
            <div className="h-5 w-[30rem] max-w-full rounded bg-white/10" />
          </div>

          <div
            className="rounded-2xl p-6 border border-white/10 shadow-lg animate-pulse"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="h-12 w-56 rounded-xl bg-white/10 mb-6" />

            <div className="space-y-3">
              <div className="h-12 rounded-xl bg-white/10" />
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