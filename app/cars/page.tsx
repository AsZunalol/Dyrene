import PageHeader from "@/components/PageHeader";
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
    <main className="hub-page">
      <PageHeader icon="cars" eyebrow="Garage" title="Cars" description="Browse store vehicles and VIN-scratch cars. Find your next ride." actions={isAdmin ? <AddCarModal /> : undefined} />
      <section className="hub-panel p-5 sm:p-6" aria-label="Vehicle garage">
        <CarsList isAdmin={isAdmin} />
      </section>
    </main>
  );
}
