"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

export default function AddGangModal() {
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("friendly");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function uploadGangImage(file: File) {
    setUploadingImage(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;

    const { error } = await supabase.storage
      .from("gang-images")
      .upload(fileName, file);

    if (error) {
      setUploadingImage(false);
      alert("Image upload failed");
      return;
    }

    const { data } = supabase.storage
      .from("gang-images")
      .getPublicUrl(fileName);

    setImage(data.publicUrl);
    setUploadingImage(false);
  }

  async function addGang(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    const res = await fetch("/api/gangs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, image, description, status }),
    });

    setLoading(false);

    if (res.ok) {
      window.location.reload();
    } else {
      alert("Failed to add gang");
    }
  }

  const modal =
    open &&
    createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 px-4">
        <form
          onSubmit={addGang}
          className="relative z-[2147483647] w-full max-w-lg rounded-2xl border border-white/10 bg-[#081b2f] p-6 text-white shadow-2xl"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 text-2xl text-white hover:text-red-400"
          >
            ×
          </button>

          <h2 className="mb-5 text-2xl font-bold">Add Gang</h2>

          <div className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gang name"
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
            />

            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadGangImage(file);
                }}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none"
              />

              {uploadingImage && (
                <p className="text-sm text-gray-400">Uploading image...</p>
              )}

              {image && (
                <img
                  src={image}
                  alt="Gang preview"
                  className="h-32 w-full rounded-xl object-cover"
                />
              )}
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              className="min-h-28 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
            >
              <option value="friendly">Friendly</option>
              <option value="conflict">In Conflict</option>
            </select>

            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? "Adding..." : "Add Gang"}
            </button>
          </div>
        </form>
      </div>,
      document.body,
    );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500"
      >
        Add Gang
      </button>

      {modal}
    </>
  );
}
