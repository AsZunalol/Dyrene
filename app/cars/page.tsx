import React from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import CarsList from "@/components/CarsList";
import AddCarModal from "@/components/AddCarModal";

export default async function CarsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = Boolean(profile?.is_admin);

  return (
    <div className="relative min-h-screen overflow-hidden text-white">

      <div className="relative z-10 px-6 pt-32 pb-12">
        <div className="max-w-6xl mx-auto">
          <div
            className="rounded-2xl p-8 border border-white/10 shadow-lg mb-8"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-white/70">
                  Dyrene Motors
                </p>
                <h1 className="text-4xl font-bold text-white mt-2">Cars</h1>
                <p className="text-gray-300 mt-2 text-lg max-w-2xl">
                  Browse vehicles VIN-Scratch and store cars.
                </p>
              </div>

              <div className="flex justify-start lg:justify-end">
                {isAdmin ? <AddCarModal /> : null}
              </div>
            </div>
          </div>

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
              <p className="text-gray-300 mt-2">Search and filter.</p>
            </div>

            <CarsList isAdmin={isAdmin} />
          </div>
        </div>
      </div>
    </div>
  );
}
