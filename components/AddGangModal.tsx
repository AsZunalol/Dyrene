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

  const inputClass =
    "w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/50 focus:bg-white/[0.1]";

  const modal =
    open &&
    createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
        <form
          onSubmit={addGang}
          className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-white/10 bg-[#071525]/95 p-6 text-white shadow-2xl shadow-black/50"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-2xl text-white transition hover:bg-red-500/20 hover:text-red-200"
          >
            ×
          </button>

          <div className="mb-6 pr-12">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">
              New relation
            </p>
            <h2 className="mt-2 text-3xl font-black">Add Gang</h2>
            <p className="mt-2 text-sm text-slate-400">
              Add a gang profile with image, relation status and short notes.
            </p>
          </div>

          <div className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gang name"
              className={inputClass}
              required
            />

            <label className="block rounded-2xl border border-dashed border-white/15 bg-white/[0.04] p-4 transition hover:bg-white/[0.07]">
              <span className="text-sm font-semibold text-white">Gang image</span>
              <span className="mt-1 block text-xs text-slate-400">
                Upload a banner or logo for the card.
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadGangImage(file);
                }}
                className="mt-3 w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-500"
              />
            </label>

            {uploadingImage && (
              <p className="text-sm text-slate-400">Uploading image...</p>
            )}

            {image && (
              <img
                src={image}
                alt="Gang preview"
                className="h-40 w-full rounded-2xl border border-white/10 object-cover"
              />
            )}

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              className={`${inputClass} min-h-28 resize-none`}
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#061625] px-4 py-3 text-white outline-none transition focus:border-blue-400/50"
            >
              <option className="bg-[#061625] text-white" value="friendly">
                Friendly
              </option>
              <option className="bg-[#061625] text-white" value="conflict">
                In Conflict
              </option>
            </select>

            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-500 disabled:translate-y-0 disabled:opacity-60"
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
        className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-500"
      >
        + Add Gang
      </button>

      {modal}
    </>
  );
}
