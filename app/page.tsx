import Link from "next/link";
import Navbar from "@/components/Navbar";
import AddCarForm from "@/components/AddCarForm";
import CarsList from "@/components/CarsList";

const cards = [
  {
    title: "Crafting",
    href: "/crafting",
    emoji: "🛠",
    description: "See crafting info, materials, and production routes.",
  },
  {
    title: "Meth",
    href: "/meth",
    emoji: "🧪",
    description: "Track meth production, steps, and important notes.",
  },
  {
    title: "Cars",
    href: "/cars",
    emoji: "🚗",
    description: "View gang vehicles, status, and car-related info.",
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Navbar />

      {/* Background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Blur + dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="relative z-10 px-6 pt-32 pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <div
            className="rounded-2xl p-8 border border-white/10 shadow-lg mb-8"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
              backdropFilter: "blur(10px)",
            }}
          >
            <h1 className="text-4xl font-bold text-white">Welcome to Dyrene</h1>
            <p className="text-gray-300 mt-2 text-lg">
              Members dashboard for gang info, planning, and overview.
            </p>
          </div>
          

          {/* Preview cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cards.map((card) => (
              <Link key={card.title} href={card.href} className="group">
                <div
                  className="h-full rounded-2xl p-6 border border-white/10 shadow-lg transition duration-300 group-hover:scale-[1.02] group-hover:border-white/20"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <div className="text-4xl mb-4">{card.emoji}</div>
                  <h2 className="text-2xl font-bold text-white">{card.title}</h2>
                  <p className="text-gray-300 mt-3">{card.description}</p>

                  <div className="mt-6 inline-flex items-center text-sm font-semibold text-white/90 group-hover:text-white">
                    Open {card.title}
                    <span className="ml-2 transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}