import React from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import CarsList from "@/components/CarsList";
import AddCarModal from "@/components/AddCarModal";

export const dynamic = "force-dynamic";

export default async function CarsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/login");

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profErr || !profile || !profile.is_admin) return redirect("/denied");

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Navbar />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 px-6 pt-32 pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div
            className="rounded-2xl p-8 border border-white/10 shadow-lg mb-8"
            style={{
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
}}
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-white/70">
                  Dyrene Motors
                </p>
                <h1 className="text-4xl font-bold text-white mt-2">Cars</h1>
                <p className="text-gray-300 mt-2 text-lg max-w-2xl">
                  Browse vehicles
                  VIN-Scratch and store cars.
                </p>
              </div>

              {/* Add Car Button moved here */}
              <div className="flex justify-start lg:justify-end">
                <AddCarModal />
              </div>
            </div>
          </div>

          {/* Garage */}
          <div
            className="rounded-2xl p-6 border border-white/10 shadow-lg"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white">Garage</h2>
              <p className="text-gray-300 mt-2">
                Search and filter.
              </p>
            </div>

            <CarsList />
          </div>
        </div>
      </div>
    </div>
  );
}