"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AddCarForm from "@/components/AddCarForm";

export default function AddCarModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const modal = open ? (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(20,20,25,0.96), rgba(15,15,20,0.94))",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">Add Car</h2>
            <p className="text-sm text-gray-400">Create a new car listing</p>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <AddCarForm onSuccess={() => setOpen(false)} />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition hover:scale-[1.02]"
        style={{
          background: "linear-gradient(90deg,#5865F2,#6772E5)",
        }}
      >
        Add Car
      </button>

      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}