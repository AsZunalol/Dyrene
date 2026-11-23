"use client";
import { useTranslation } from "@/components/LanguageProvider";

import { useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

export default function AddGangModal() {
  const { t } = useTranslation();
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
      alert(t("Image upload failed"));
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
      alert(t("Failed to add gang"));
    }
  }

  const inputClass =
    "w-full rounded-xl border border-line bg-surface px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-accent/50 focus:bg-white/[0.1]";

  const modal =
    open &&
    createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
        <form
          onSubmit={addGang}
          className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl border border-line bg-[var(--surface)]/95 p-6 text-white shadow-lg shadow-black/50"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-elevated text-2xl text-white transition hover:bg-red-500/20 hover:text-red-200"
          >
            ×
          </button>

          <div className="mb-6 pr-12">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">{t("New relation")}</p>
            <h2 className="mt-2 text-3xl font-semibold">{t("Add Gang")}</h2>
            <p className="mt-2 text-sm text-muted">{t("Add a gang profile with image, relation status and short notes.")}</p>
          </div>

          <div className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Gang name")}
              className={inputClass}
              required
            />

            <label className="block rounded-xl border border-dashed border-line bg-surface p-4 transition hover:bg-surface">
              <span className="text-sm font-semibold text-white">{t("Gang image")}</span>
              <span className="mt-1 block text-xs text-muted">{t("Upload a banner or logo for the card.")}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadGangImage(file);
                }}
                className="mt-3 w-full text-sm text-muted file:mr-4 file:rounded-xl file:border-0 file:bg-accent-strong file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-accent-strong"
              />
            </label>

            {uploadingImage && (
              <p className="text-sm text-muted">{t("Uploading image...")}</p>
            )}

            {image && (
              <img
                src={image}
                alt={t("Gang preview")}
                className="h-40 w-full rounded-xl border border-line object-cover"
              />
            )}

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("Short description")}
              className={`${inputClass} min-h-28 resize-none`}
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-line bg-[var(--surface)] px-4 py-3 text-white outline-none transition focus:border-accent/50"
            >
              <option className="bg-[var(--surface)] text-white" value="friendly">{t("Friendly")}</option>
              <option className="bg-[var(--surface)] text-white" value="conflict">{t("In Conflict")}</option>
            </select>

            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="w-full rounded-xl bg-accent-strong px-4 py-3 font-bold text-white shadow-lg shadow-accent/30 transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:translate-y-0 disabled:opacity-60"
            >
              {loading ? t("Adding...") : t("Add Gang")}
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
        className="inline-flex items-center justify-center rounded-xl bg-accent-strong px-5 py-3 font-bold text-white shadow-lg shadow-accent/30 transition hover:-translate-y-0.5 hover:bg-accent-strong"
      >{t("+ Add Gang")}</button>

      {modal}
    </>
  );
}
