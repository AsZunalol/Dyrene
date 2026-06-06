"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Bait = {
  id: string;
  name: string;
  image_url: string | null;
  created_at: string;
};

type Fish = {
  id: string;
  name: string;
  image_url: string | null;
  created_at: string;
};

type SessionCatch = {
  id: string;
  fish_id: string;
  amount: number;
  aszuna_fishing_fish: Fish | null;
};

type FishingSession = {
  id: string;
  bait_id: string;
  baits_used: number;
  notes: string | null;
  created_at: string;
  aszuna_fishing_baits: Bait | null;
  aszuna_fishing_session_catches: SessionCatch[];
};

type FishingData = {
  baits: Bait[];
  fish: Fish[];
  sessions: FishingSession[];
};

type CatchInput = {
  fish_id: string;
  amount: number;
};

type StatRow = {
  bait: Bait;
  fish: Fish;
  caught: number;
  baitsUsed: number;
  chance: number;
};

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function formatChance(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function ImageBox({ src, name }: { src?: string | null; name: string }) {
  if (!src) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm font-black text-[#00ffbf]">
        {name.slice(0, 1).toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <img src={src} alt={name} className="h-full w-full object-cover" />
    </div>
  );
}

export default function AsZunaFishingTracker() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<FishingData>({ baits: [], fish: [], sessions: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"session" | "bait" | "fish">("session");

  const [baitName, setBaitName] = useState("");
  const [baitImage, setBaitImage] = useState("");
  const [fishName, setFishName] = useState("");
  const [fishImage, setFishImage] = useState("");

  const [selectedBaitId, setSelectedBaitId] = useState("");
  const [baitsUsed, setBaitsUsed] = useState(1);
  const [sessionNotes, setSessionNotes] = useState("");
  const [catches, setCatches] = useState<CatchInput[]>([{ fish_id: "", amount: 1 }]);
  const [targetFish, setTargetFish] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/aszuna/fishing", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Could not load fishing data.");

      setData(json);
      if (!selectedBaitId && json.baits?.[0]?.id) setSelectedBaitId(json.baits[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load fishing data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadImage(file: File, type: "bait" | "fish") {
    setUploading(true);
    setError("");

    try {
      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("aszuna-fishing-images")
        .upload(fileName, file);

      if (uploadError) throw new Error(uploadError.message);

      const { data: publicUrlData } = supabase.storage
        .from("aszuna-fishing-images")
        .getPublicUrl(fileName);

      if (type === "bait") setBaitImage(publicUrlData.publicUrl);
      if (type === "fish") setFishImage(publicUrlData.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function addBait(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = cleanName(baitName);
    if (!name) return setError("Add a bait name first.");

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/aszuna/fishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_bait", name, image_url: cleanName(baitImage) }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Could not add bait.");

      setData((current) => ({ ...current, baits: [...current.baits, json].sort((a, b) => a.name.localeCompare(b.name)) }));
      setSelectedBaitId(json.id);
      setBaitName("");
      setBaitImage("");
      setActiveTab("session");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add bait.");
    } finally {
      setSaving(false);
    }
  }

  async function addFish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = cleanName(fishName);
    if (!name) return setError("Add a fish name first.");

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/aszuna/fishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_fish", name, image_url: cleanName(fishImage) }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Could not add fish.");

      setData((current) => ({ ...current, fish: [...current.fish, json].sort((a, b) => a.name.localeCompare(b.name)) }));
      setFishName("");
      setFishImage("");
      setActiveTab("session");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add fish.");
    } finally {
      setSaving(false);
    }
  }

  async function addSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanCatches = catches
      .map((catchRow) => ({ fish_id: catchRow.fish_id, amount: Math.max(1, Math.floor(Number(catchRow.amount) || 1)) }))
      .filter((catchRow) => catchRow.fish_id);

    if (!selectedBaitId) return setError("Add and pick a bait first.");
    if (cleanCatches.length === 0) return setError("Add at least one fish/result from the session.");

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/aszuna/fishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_session",
          bait_id: selectedBaitId,
          baits_used: Math.max(1, Math.floor(Number(baitsUsed) || 1)),
          notes: cleanName(sessionNotes),
          catches: cleanCatches,
        }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Could not save session.");

      setBaitsUsed(1);
      setSessionNotes("");
      setCatches([{ fish_id: "", amount: 1 }]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save session.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(type: "session" | "bait" | "fish", id: string) {
    setError("");

    try {
      const res = await fetch(`/api/aszuna/fishing?type=${type}&id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Could not delete row.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete row.");
    }
  }

  const stats = useMemo(() => {
    const baitMap = new Map(data.baits.map((bait) => [bait.id, bait]));
    const fishMap = new Map(data.fish.map((fish) => [fish.id, fish]));
    const baitsUsedByBait = new Map<string, number>();
    const caughtByBaitFish = new Map<string, number>();

    for (const session of data.sessions) {
      baitsUsedByBait.set(session.bait_id, (baitsUsedByBait.get(session.bait_id) || 0) + (Number(session.baits_used) || 0));

      for (const catchRow of session.aszuna_fishing_session_catches || []) {
        const key = `${session.bait_id}:${catchRow.fish_id}`;
        caughtByBaitFish.set(key, (caughtByBaitFish.get(key) || 0) + (Number(catchRow.amount) || 0));
      }
    }

    const rows: StatRow[] = [];

    for (const [key, caught] of caughtByBaitFish.entries()) {
      const [baitId, fishId] = key.split(":");
      const bait = baitMap.get(baitId);
      const fish = fishMap.get(fishId);
      const baitsUsedTotal = baitsUsedByBait.get(baitId) || 0;

      if (!bait || !fish) continue;

      rows.push({
        bait,
        fish,
        caught,
        baitsUsed: baitsUsedTotal,
        chance: baitsUsedTotal > 0 ? (caught / baitsUsedTotal) * 100 : 0,
      });
    }

    return rows.sort((a, b) => a.bait.name.localeCompare(b.bait.name) || b.chance - a.chance);
  }, [data]);

  const statsByBait = useMemo(() => {
    const grouped = new Map<string, StatRow[]>();
    for (const row of stats) grouped.set(row.bait.id, [...(grouped.get(row.bait.id) || []), row]);
    return Array.from(grouped.values());
  }, [stats]);

  const bestBait = useMemo(() => {
    const target = cleanName(targetFish).toLowerCase();
    if (!target) return null;

    return stats
      .filter((row) => row.fish.name.toLowerCase() === target)
      .sort((a, b) => b.chance - a.chance || b.caught - a.caught)[0];
  }, [stats, targetFish]);

  const totalBaitsUsed = data.sessions.reduce((total, session) => total + (Number(session.baits_used) || 0), 0);
  const totalFishCaught = data.sessions.reduce(
    (total, session) =>
      total +
      (session.aszuna_fishing_session_catches || []).reduce(
        (sum, catchRow) => sum + (Number(catchRow.amount) || 0),
        0,
      ),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-500">Sessions</p>
          <p className="mt-2 text-3xl font-black text-white">{data.sessions.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-500">Baits used</p>
          <p className="mt-2 text-3xl font-black text-white">{totalBaitsUsed}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-500">Fish caught</p>
          <p className="mt-2 text-3xl font-black text-white">{totalFishCaught}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-500">Bait types</p>
          <p className="mt-2 text-3xl font-black text-white">{data.baits.length}</p>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-2">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["session", "Add Session"],
            ["bait", "Add Bait"],
            ["fish", "Add Fish"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value as "session" | "bait" | "fish")}
              className={`rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition ${
                activeTab === value ? "bg-[#00ffbf] text-black" : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
          {activeTab === "session" && (
            <form onSubmit={addSession} className="space-y-5">
              <div>
                <p className="text-lg font-black text-white">Log fishing session</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Pick bait, write how many baits you used, then add all fish you got from that session.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-200">Bait used</label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {data.baits.map((bait) => (
                    <button
                      key={bait.id}
                      type="button"
                      onClick={() => setSelectedBaitId(bait.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        selectedBaitId === bait.id
                          ? "border-[#00ffbf]/60 bg-[#00ffbf]/10"
                          : "border-white/10 bg-black/30 hover:border-white/20"
                      }`}
                    >
                      <ImageBox src={bait.image_url} name={bait.name} />
                      <span className="text-sm font-bold text-white">{bait.name}</span>
                    </button>
                  ))}
                </div>
                {data.baits.length === 0 && <p className="mt-3 text-sm text-gray-500">Add your 3 bait types first.</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-200">How many baits used?</label>
                <input
                  type="number"
                  min={1}
                  value={baitsUsed}
                  onChange={(event) => setBaitsUsed(Number(event.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-[#00ffbf]/60 focus:ring-4 focus:ring-[#00ffbf]/10"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-gray-200">Fish collected</label>
                  <button
                    type="button"
                    onClick={() => setCatches((current) => [...current, { fish_id: "", amount: 1 }])}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 transition hover:bg-white/10 hover:text-white"
                  >
                    + Add fish
                  </button>
                </div>

                {catches.map((catchRow, index) => (
                  <div key={index} className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 sm:grid-cols-[1fr_110px_auto]">
                    <select
                      value={catchRow.fish_id}
                      onChange={(event) =>
                        setCatches((current) => current.map((row, i) => (i === index ? { ...row, fish_id: event.target.value } : row)))
                      }
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-white outline-none focus:border-[#00ffbf]/60"
                    >
                      <option value="">Pick fish</option>
                      {data.fish.map((fish) => (
                        <option key={fish.id} value={fish.id}>
                          {fish.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min={1}
                      value={catchRow.amount}
                      onChange={(event) =>
                        setCatches((current) => current.map((row, i) => (i === index ? { ...row, amount: Number(event.target.value) } : row)))
                      }
                      className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-white outline-none focus:border-[#00ffbf]/60"
                    />

                    <button
                      type="button"
                      onClick={() => setCatches((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)))}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-xs font-bold text-red-200 transition hover:bg-red-500/20"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-200">Notes</label>
                <textarea
                  value={sessionNotes}
                  onChange={(event) => setSessionNotes(event.target.value)}
                  placeholder="Optional: spot, time, anything useful"
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-[#00ffbf]/60 focus:ring-4 focus:ring-[#00ffbf]/10"
                />
              </div>

              <button
                type="submit"
                disabled={saving || data.baits.length === 0 || data.fish.length === 0}
                className="w-full rounded-2xl bg-[#00ffbf] px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-black shadow-lg shadow-[#00ffbf]/20 transition hover:-translate-y-0.5 hover:bg-[#23ffd0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Session"}
              </button>
            </form>
          )}

          {activeTab === "bait" && (
            <form onSubmit={addBait} className="space-y-5">
              <div>
                <p className="text-lg font-black text-white">Add bait</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">Add your bait types here. Upload an image so sessions are fast to click.</p>
              </div>
              <input
                value={baitName}
                onChange={(event) => setBaitName(event.target.value)}
                placeholder="Bait name"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-[#00ffbf]/60 focus:ring-4 focus:ring-[#00ffbf]/10"
              />
              <input
                value={baitImage}
                onChange={(event) => setBaitImage(event.target.value)}
                placeholder="Image URL, or upload below"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-[#00ffbf]/60 focus:ring-4 focus:ring-[#00ffbf]/10"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadImage(file, "bait");
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-[#00ffbf] file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
              />
              {baitImage && <ImageBox src={baitImage} name={baitName || "Bait"} />}
              <button
                type="submit"
                disabled={saving || uploading}
                className="w-full rounded-2xl bg-[#00ffbf] px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-black shadow-lg shadow-[#00ffbf]/20 transition hover:-translate-y-0.5 hover:bg-[#23ffd0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? "Uploading..." : saving ? "Saving..." : "Add Bait"}
              </button>
            </form>
          )}

          {activeTab === "fish" && (
            <form onSubmit={addFish} className="space-y-5">
              <div>
                <p className="text-lg font-black text-white">Add fish/result</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">Add every fish or reward you can get from bait.</p>
              </div>
              <input
                value={fishName}
                onChange={(event) => setFishName(event.target.value)}
                placeholder="Fish/result name"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-[#00ffbf]/60 focus:ring-4 focus:ring-[#00ffbf]/10"
              />
              <input
                value={fishImage}
                onChange={(event) => setFishImage(event.target.value)}
                placeholder="Image URL, or upload below"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-[#00ffbf]/60 focus:ring-4 focus:ring-[#00ffbf]/10"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadImage(file, "fish");
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-[#00ffbf] file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
              />
              {fishImage && <ImageBox src={fishImage} name={fishName || "Fish"} />}
              <button
                type="submit"
                disabled={saving || uploading}
                className="w-full rounded-2xl bg-[#00ffbf] px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-black shadow-lg shadow-[#00ffbf]/20 transition hover:-translate-y-0.5 hover:bg-[#23ffd0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? "Uploading..." : saving ? "Saving..." : "Add Fish"}
              </button>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-black text-white">Drop chance by bait</p>
                <p className="mt-1 text-sm text-gray-400">Calculated as fish caught ÷ baits used.</p>
              </div>
              <input
                value={targetFish}
                onChange={(event) => setTargetFish(event.target.value)}
                placeholder="Best bait for fish..."
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-[#00ffbf]/60 focus:ring-4 focus:ring-[#00ffbf]/10"
              />
            </div>

            {bestBait && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#00ffbf]/25 bg-[#00ffbf]/10 p-4">
                <ImageBox src={bestBait.bait.image_url} name={bestBait.bait.name} />
                <div>
                  <p className="text-sm text-gray-300">Best bait for {bestBait.fish.name}</p>
                  <p className="text-lg font-black text-white">
                    {bestBait.bait.name} · {formatChance(bestBait.chance)}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-4">
              {loading && <p className="text-sm text-gray-500">Loading fishing data...</p>}
              {!loading && statsByBait.length === 0 && (
                <p className="text-sm text-gray-500">No session stats yet. Add baits, fish, then save your first session.</p>
              )}

              {statsByBait.map((rows) => (
                <div key={rows[0].bait.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <ImageBox src={rows[0].bait.image_url} name={rows[0].bait.name} />
                    <div>
                      <p className="font-black text-white">{rows[0].bait.name}</p>
                      <p className="text-xs text-gray-500">{rows[0].baitsUsed} baits tested</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {rows.map((row) => (
                      <div key={`${row.bait.id}-${row.fish.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                        <ImageBox src={row.fish.image_url} name={row.fish.name} />
                        <div>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-bold text-white">{row.fish.name}</span>
                            <span className="font-black text-[#00ffbf]">{formatChance(row.chance)}</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-[#00ffbf]" style={{ width: `${Math.min(100, row.chance)}%` }} />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {row.caught} caught from {row.baitsUsed} bait
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <p className="text-lg font-black text-white">Latest sessions</p>
            <div className="mt-4 space-y-3">
              {data.sessions.slice(0, 6).map((session) => (
                <div key={session.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ImageBox src={session.aszuna_fishing_baits?.image_url} name={session.aszuna_fishing_baits?.name || "Bait"} />
                      <div>
                        <p className="font-black text-white">{session.aszuna_fishing_baits?.name || "Deleted bait"}</p>
                        <p className="text-xs text-gray-500">{session.baits_used} baits used</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteRow("session", session.id)}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(session.aszuna_fishing_session_catches || []).map((catchRow) => (
                      <span key={catchRow.id} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                        {catchRow.amount}x {catchRow.aszuna_fishing_fish?.name || "Deleted fish"}
                      </span>
                    ))}
                  </div>
                  {session.notes && <p className="mt-3 text-sm text-gray-500">{session.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
          <p className="text-lg font-black text-white">Baits</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.baits.map((bait) => (
              <div key={bait.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="flex items-center gap-3">
                  <ImageBox src={bait.image_url} name={bait.name} />
                  <p className="font-bold text-white">{bait.name}</p>
                </div>
                <button type="button" onClick={() => deleteRow("bait", bait.id)} className="text-xs font-bold text-red-300 hover:text-red-200">
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
          <p className="text-lg font-black text-white">Fish / results</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.fish.map((fish) => (
              <div key={fish.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="flex items-center gap-3">
                  <ImageBox src={fish.image_url} name={fish.name} />
                  <p className="font-bold text-white">{fish.name}</p>
                </div>
                <button type="button" onClick={() => deleteRow("fish", fish.id)} className="text-xs font-bold text-red-300 hover:text-red-200">
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
