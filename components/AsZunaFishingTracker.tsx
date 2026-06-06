"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  sell_price: number | null;
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
  location: string | null;
  session_date: string | null;
  notes: string | null;
  created_at: string;
  aszuna_fishing_baits: Bait | null;
  aszuna_fishing_session_catches: SessionCatch[];
};
type FishingData = {
  isAdmin: boolean;
  baits: Bait[];
  fish: Fish[];
  sessions: FishingSession[];
};
type CatchInput = { fish_id: string; amount: number };
type StatRow = {
  bait: Bait;
  fish: Fish;
  caught: number;
  baitsUsed: number;
  chance: number;
  profit: number;
  profitPerBait: number;
};
type BaitOverview = {
  bait: Bait;
  baitsUsed: number;
  totalCaught: number;
  profit: number;
  profitPerBait: number;
  bestFish: StatRow | null;
};

const emptyData: FishingData = {
  isAdmin: false,
  baits: [],
  fish: [],
  sessions: [],
};

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function percent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function ImageBox({
  src,
  name,
  large = false,
}: {
  src?: string | null;
  name: string;
  large?: boolean;
}) {
  const size = large ? "h-16 w-16" : "h-12 w-12";
  if (!src) {
    return (
      <div
        className={`flex ${size} shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm font-black text-[#00ffbf]`}
      >
        {name.slice(0, 1).toUpperCase() || "?"}
      </div>
    );
  }
  return (
    <div
      className={`relative ${size} shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30`}
    >
      <img src={src} alt={name} className="h-full w-full object-cover" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-[#00ffbf]/60 focus:ring-4 focus:ring-[#00ffbf]/10";
const buttonClass =
  "rounded-2xl bg-[#00ffbf] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-black shadow-lg shadow-[#00ffbf]/20 transition hover:-translate-y-0.5 hover:bg-[#23ffd0] disabled:cursor-not-allowed disabled:opacity-50";
const subtleButtonClass =
  "rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-gray-200 transition hover:bg-white/10";

export default function AsZunaFishingTracker() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<FishingData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<
    "session" | "bait" | "fish" | "tools"
  >("session");

  const [baitName, setBaitName] = useState("");
  const [baitImage, setBaitImage] = useState("");
  const [fishName, setFishName] = useState("");
  const [fishImage, setFishImage] = useState("");
  const [fishPrice, setFishPrice] = useState(0);

  const [selectedBaitId, setSelectedBaitId] = useState("");
  const [baitsUsed, setBaitsUsed] = useState(1);
  const [sessionDate, setSessionDate] = useState(today());
  const [sessionLocation, setSessionLocation] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [catches, setCatches] = useState<CatchInput[]>([
    { fish_id: "", amount: 1 },
  ]);
  const [targetFish, setTargetFish] = useState("");

  const [editingBait, setEditingBait] = useState<Bait | null>(null);
  const [editingFish, setEditingFish] = useState<Fish | null>(null);
  const [editingSession, setEditingSession] = useState<FishingSession | null>(
    null,
  );

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/aszuna/fishing", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || "Could not load fishing data.");
      setData(json);
      if (!selectedBaitId && json.baits?.[0]?.id)
        setSelectedBaitId(json.baits[0].id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load fishing data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3000);
  }

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
      if (type === "bait") {
        if (editingBait)
          setEditingBait({
            ...editingBait,
            image_url: publicUrlData.publicUrl,
          });
        else setBaitImage(publicUrlData.publicUrl);
      }
      if (type === "fish") {
        if (editingFish)
          setEditingFish({
            ...editingFish,
            image_url: publicUrlData.publicUrl,
          });
        else setFishImage(publicUrlData.publicUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function request(
    method: "POST" | "PUT",
    body: Record<string, unknown>,
  ) {
    const res = await fetch("/api/aszuna/fishing", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Something went wrong.");
    return json;
  }

  async function addBait(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = cleanName(baitName);
    if (!name) return setError("Add a bait name first.");
    setSaving(true);
    setError("");
    try {
      const json = await request("POST", {
        action: "add_bait",
        name,
        image_url: cleanName(baitImage),
      });
      setData((current) => ({
        ...current,
        baits: [...current.baits, json].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }));
      setSelectedBaitId(json.id);
      setBaitName("");
      setBaitImage("");
      setActiveTab("session");
      showNotice("Bait added.");
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
      const json = await request("POST", {
        action: "add_fish",
        name,
        image_url: cleanName(fishImage),
        sell_price: fishPrice,
      });
      setData((current) => ({
        ...current,
        fish: [...current.fish, json].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }));
      setFishName("");
      setFishImage("");
      setFishPrice(0);
      setActiveTab("session");
      showNotice("Fish added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add fish.");
    } finally {
      setSaving(false);
    }
  }

  function cleanSessionCatches(rows: CatchInput[]) {
    return rows
      .map((row) => ({
        fish_id: row.fish_id,
        amount: Math.max(1, Math.floor(Number(row.amount) || 1)),
      }))
      .filter((row) => row.fish_id);
  }

  async function saveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanCatches = cleanSessionCatches(catches);
    if (!selectedBaitId) return setError("Add and pick a bait first.");
    if (cleanCatches.length === 0)
      return setError("Add at least one fish/result from the session.");
    setSaving(true);
    setError("");
    try {
      await request("POST", {
        action: "add_session",
        bait_id: selectedBaitId,
        baits_used: Math.max(1, Math.floor(Number(baitsUsed) || 1)),
        location: cleanName(sessionLocation),
        session_date: sessionDate,
        notes: cleanName(sessionNotes),
        catches: cleanCatches,
      });
      setBaitsUsed(1);
      setSessionDate(today());
      setSessionLocation("");
      setSessionNotes("");
      setCatches([{ fish_id: "", amount: 1 }]);
      await loadData();
      showNotice("Session saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save session.");
    } finally {
      setSaving(false);
    }
  }

  async function updateBait(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingBait) return;
    setSaving(true);
    setError("");
    try {
      await request("PUT", {
        action: "update_bait",
        id: editingBait.id,
        name: editingBait.name,
        image_url: editingBait.image_url,
      });
      setEditingBait(null);
      await loadData();
      showNotice("Bait updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update bait.");
    } finally {
      setSaving(false);
    }
  }

  async function updateFish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingFish) return;
    setSaving(true);
    setError("");
    try {
      await request("PUT", {
        action: "update_fish",
        id: editingFish.id,
        name: editingFish.name,
        image_url: editingFish.image_url,
        sell_price: editingFish.sell_price ?? 0,
      });
      setEditingFish(null);
      await loadData();
      showNotice("Fish updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update fish.");
    } finally {
      setSaving(false);
    }
  }

  function startEditSession(session: FishingSession) {
    setEditingSession(session);
    setSelectedBaitId(session.bait_id);
    setBaitsUsed(session.baits_used);
    setSessionDate(session.session_date || session.created_at.slice(0, 10));
    setSessionLocation(session.location || "");
    setSessionNotes(session.notes || "");
    setCatches(
      (session.aszuna_fishing_session_catches || []).map((row) => ({
        fish_id: row.fish_id,
        amount: row.amount,
      })),
    );
    setActiveTab("session");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function updateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSession) return;
    const cleanCatches = cleanSessionCatches(catches);
    if (!selectedBaitId || cleanCatches.length === 0)
      return setError("Pick bait and add at least one fish.");
    setSaving(true);
    setError("");
    try {
      await request("PUT", {
        action: "update_session",
        id: editingSession.id,
        bait_id: selectedBaitId,
        baits_used: baitsUsed,
        location: cleanName(sessionLocation),
        session_date: sessionDate,
        notes: cleanName(sessionNotes),
        catches: cleanCatches,
      });
      setEditingSession(null);
      setBaitsUsed(1);
      setSessionDate(today());
      setSessionLocation("");
      setSessionNotes("");
      setCatches([{ fish_id: "", amount: 1 }]);
      await loadData();
      showNotice("Session updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update session.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(type: "session" | "bait" | "fish", id: string) {
    if (!window.confirm(`Delete this ${type}?`)) return;
    setError("");
    try {
      const res = await fetch(
        `/api/aszuna/fishing?type=${type}&id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not delete row.");
      await loadData();
      showNotice(`${type} deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete row.");
    }
  }

  function getCatchAmount(fishId: string) {
    return catches.find((row) => row.fish_id === fishId)?.amount || 0;
  }

  function setFishCatchAmount(fishId: string, amount: number) {
    const cleanAmount = Math.max(0, Math.floor(Number(amount) || 0));
    setCatches((current) => {
      const withoutFish = current.filter((row) => row.fish_id !== fishId);
      if (cleanAmount <= 0)
        return withoutFish.length ? withoutFish : [{ fish_id: "", amount: 1 }];
      return [...withoutFish, { fish_id: fishId, amount: cleanAmount }];
    });
  }

  function toggleFishCatch(fishId: string) {
    const currentAmount = getCatchAmount(fishId);
    setFishCatchAmount(fishId, currentAmount > 0 ? 0 : 1);
  }

  const stats = useMemo(() => {
    const baitMap = new Map(data.baits.map((bait) => [bait.id, bait]));
    const fishMap = new Map(data.fish.map((fish) => [fish.id, fish]));
    const baitsUsedByBait = new Map<string, number>();
    const caughtByBaitFish = new Map<string, number>();

    for (const session of data.sessions) {
      baitsUsedByBait.set(
        session.bait_id,
        (baitsUsedByBait.get(session.bait_id) || 0) +
          (Number(session.baits_used) || 0),
      );
      for (const catchRow of session.aszuna_fishing_session_catches || []) {
        const key = `${session.bait_id}:${catchRow.fish_id}`;
        caughtByBaitFish.set(
          key,
          (caughtByBaitFish.get(key) || 0) + (Number(catchRow.amount) || 0),
        );
      }
    }

    const rows: StatRow[] = [];
    for (const [key, caught] of caughtByBaitFish.entries()) {
      const [baitId, fishId] = key.split(":");
      const bait = baitMap.get(baitId);
      const fish = fishMap.get(fishId);
      const baitsUsedTotal = baitsUsedByBait.get(baitId) || 0;
      if (!bait || !fish) continue;
      const profit = caught * Number(fish.sell_price || 0);
      rows.push({
        bait,
        fish,
        caught,
        baitsUsed: baitsUsedTotal,
        chance: baitsUsedTotal > 0 ? (caught / baitsUsedTotal) * 100 : 0,
        profit,
        profitPerBait: baitsUsedTotal > 0 ? profit / baitsUsedTotal : 0,
      });
    }
    return rows.sort(
      (a, b) =>
        a.bait.name.localeCompare(b.bait.name) ||
        b.profitPerBait - a.profitPerBait ||
        b.chance - a.chance,
    );
  }, [data]);

  const overview = useMemo(() => {
    const rows = new Map<string, BaitOverview>();
    for (const bait of data.baits)
      rows.set(bait.id, {
        bait,
        baitsUsed: 0,
        totalCaught: 0,
        profit: 0,
        profitPerBait: 0,
        bestFish: null,
      });
    for (const session of data.sessions) {
      const row = rows.get(session.bait_id);
      if (!row) continue;
      row.baitsUsed += Number(session.baits_used) || 0;
      row.totalCaught += (session.aszuna_fishing_session_catches || []).reduce(
        (sum, catchRow) => sum + (Number(catchRow.amount) || 0),
        0,
      );
    }
    for (const stat of stats) {
      const row = rows.get(stat.bait.id);
      if (!row) continue;
      row.profit += stat.profit;
      if (!row.bestFish || stat.profitPerBait > row.bestFish.profitPerBait)
        row.bestFish = stat;
    }
    for (const row of rows.values())
      row.profitPerBait = row.baitsUsed > 0 ? row.profit / row.baitsUsed : 0;
    return Array.from(rows.values()).sort(
      (a, b) => b.profitPerBait - a.profitPerBait,
    );
  }, [data, stats]);

  const statsByBait = useMemo(() => {
    const grouped = new Map<string, StatRow[]>();
    for (const row of stats)
      grouped.set(row.bait.id, [...(grouped.get(row.bait.id) || []), row]);
    return Array.from(grouped.values());
  }, [stats]);

  const bestBait = useMemo(() => {
    const target = cleanName(targetFish).toLowerCase();
    if (!target) return null;
    return (
      stats
        .filter((row) => row.fish.name.toLowerCase() === target)
        .sort(
          (a, b) =>
            b.profitPerBait - a.profitPerBait ||
            b.chance - a.chance ||
            b.caught - a.caught,
        )[0] || null
    );
  }, [stats, targetFish]);

  const totalBaitsUsed = data.sessions.reduce(
    (total, session) => total + (Number(session.baits_used) || 0),
    0,
  );
  const totalFishCaught = data.sessions.reduce(
    (total, session) =>
      total +
      (session.aszuna_fishing_session_catches || []).reduce(
        (sum, catchRow) => sum + (Number(catchRow.amount) || 0),
        0,
      ),
    0,
  );
  const totalProfit = stats.reduce((total, row) => total + row.profit, 0);
  const bestMoneyBait = overview[0];

  function exportData() {
    const payload = {
      exported_at: new Date().toISOString(),
      baits: data.baits,
      fish: data.fish,
      sessions: data.sessions.map((session) => ({
        bait_id: session.bait_id,
        bait_name: session.aszuna_fishing_baits?.name || "",
        baits_used: session.baits_used,
        location: session.location,
        session_date: session.session_date,
        notes: session.notes,
        catches: (session.aszuna_fishing_session_catches || []).map((row) => ({
          fish_id: row.fish_id,
          fish_name: row.aszuna_fishing_fish?.name || "",
          amount: row.amount,
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aszuna-fishing-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const rows = [
      [
        "date",
        "location",
        "bait",
        "baits_used",
        "fish",
        "amount",
        "sell_price",
        "profit",
      ],
    ];
    for (const session of data.sessions) {
      for (const catchRow of session.aszuna_fishing_session_catches || []) {
        const fish = catchRow.aszuna_fishing_fish;
        const price = Number(fish?.sell_price || 0);
        rows.push([
          session.session_date || session.created_at.slice(0, 10),
          session.location || "",
          session.aszuna_fishing_baits?.name || "Deleted bait",
          String(session.baits_used),
          fish?.name || "Deleted fish",
          String(catchRow.amount),
          String(price),
          String(price * catchRow.amount),
        ]);
      }
    }
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aszuna-fishing-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError("");
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await request("POST", {
        action: "import",
        baits: json.baits || [],
        fish: json.fish || [],
        sessions: json.sessions || [],
      });
      await loadData();
      showNotice("Import finished.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#00ffbf]">
              AsZuna Tool
            </p>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              Fishing Data Tracker
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
              Track bait sessions, fish drops, locations, drop chances, and
              profit per bait. We calculate by sessions because bait used is the
              real attempt count.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-3xl">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs text-gray-500">Sessions</p>
              <p className="text-2xl font-black text-white">
                {data.sessions.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs text-gray-500">Bait Used</p>
              <p className="text-2xl font-black text-white">{totalBaitsUsed}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs text-gray-500">Caught</p>
              <p className="text-2xl font-black text-white">
                {totalFishCaught}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs text-gray-500">Profit</p>
              <p className="text-2xl font-black text-[#00ffbf]">
                {money(totalProfit)}
              </p>
            </div>
          </div>
        </div>
        {!data.isAdmin && (
          <p className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            View-only mode. Only admins can add, edit, delete, or import data.
          </p>
        )}
        {error && (
          <p className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-5 rounded-2xl border border-[#00ffbf]/20 bg-[#00ffbf]/10 p-4 text-sm text-[#b8ffef]">
            {notice}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[520px_minmax(0,1fr)]">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl lg:p-6 xl:sticky xl:top-28 xl:self-start">
          <div className="mb-5 grid grid-cols-4 gap-2">
            {(["session", "bait", "fish", "tools"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-2xl px-3 py-2 text-sm font-black capitalize transition ${activeTab === tab ? "bg-[#00ffbf] text-black" : "bg-black/30 text-gray-300 hover:bg-white/10"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "session" && (
            <form
              onSubmit={editingSession ? updateSession : saveSession}
              className="space-y-5"
            >
              <div>
                <p className="text-lg font-black text-white">
                  {editingSession
                    ? "Edit fishing session"
                    : "Add fishing session"}
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Pick bait, enter how many baits you used, then add the fish
                  you got.
                </p>
              </div>
              <Field label="Bait used">
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.baits.map((bait) => (
                    <button
                      key={bait.id}
                      type="button"
                      disabled={!data.isAdmin}
                      onClick={() => setSelectedBaitId(bait.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${selectedBaitId === bait.id ? "border-[#00ffbf]/60 bg-[#00ffbf]/10" : "border-white/10 bg-black/25 hover:bg-white/5"}`}
                    >
                      <ImageBox src={bait.image_url} name={bait.name} />
                      <span className="text-sm font-black text-white">
                        {bait.name}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Baits used">
                  <input
                    disabled={!data.isAdmin}
                    type="number"
                    min="1"
                    value={baitsUsed}
                    onChange={(e) => setBaitsUsed(Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Date">
                  <input
                    disabled={!data.isAdmin}
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Location">
                  <input
                    disabled={!data.isAdmin}
                    value={sessionLocation}
                    onChange={(e) => setSessionLocation(e.target.value)}
                    placeholder="Pier, lake, ocean..."
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">
                    Fish caught
                  </p>
                  <p className="text-xs text-gray-500">
                    Click a fish image, then set how many you got.
                  </p>
                </div>
                {data.fish.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-gray-500">
                    Add fish/results first before you can log a session.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.fish.map((fish) => {
                      const amount = getCatchAmount(fish.id);
                      const selected = amount > 0;
                      return (
                        <div
                          key={fish.id}
                          className={`rounded-2xl border p-3 transition ${selected ? "border-[#00ffbf]/60 bg-[#00ffbf]/10" : "border-white/10 bg-black/25"}`}
                        >
                          <button
                            type="button"
                            disabled={!data.isAdmin}
                            onClick={() => toggleFishCatch(fish.id)}
                            className="flex w-full items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <ImageBox src={fish.image_url} name={fish.name} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-white">
                                {fish.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {money(Number(fish.sell_price || 0))} each
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${selected ? "bg-[#00ffbf] text-black" : "bg-white/10 text-gray-400"}`}
                            >
                              {selected ? "Picked" : "Pick"}
                            </span>
                          </button>
                          <div className="mt-3 grid grid-cols-[36px_1fr_36px] gap-2">
                            <button
                              type="button"
                              disabled={!data.isAdmin || !selected}
                              onClick={() =>
                                setFishCatchAmount(fish.id, amount - 1)
                              }
                              className="rounded-xl border border-white/10 bg-white/5 text-lg font-black text-white disabled:opacity-30"
                            >
                              -
                            </button>
                            <input
                              disabled={!data.isAdmin || !selected}
                              type="number"
                              min="0"
                              value={amount}
                              onChange={(e) =>
                                setFishCatchAmount(
                                  fish.id,
                                  Number(e.target.value),
                                )
                              }
                              className={`${inputClass} py-2 text-center`}
                            />
                            <button
                              type="button"
                              disabled={!data.isAdmin}
                              onClick={() =>
                                setFishCatchAmount(fish.id, amount + 1)
                              }
                              className="rounded-xl border border-white/10 bg-white/5 text-lg font-black text-white disabled:opacity-30"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <Field label="Notes">
                <textarea
                  disabled={!data.isAdmin}
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Weather, time, anything useful..."
                  rows={3}
                  className={inputClass}
                />
              </Field>
              {data.isAdmin && (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className={buttonClass}
                  >
                    {saving
                      ? "Saving..."
                      : editingSession
                        ? "Update Session"
                        : "Save Session"}
                  </button>
                  {editingSession && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSession(null);
                        setBaitsUsed(1);
                        setSessionDate(today());
                        setSessionLocation("");
                        setSessionNotes("");
                        setCatches([{ fish_id: "", amount: 1 }]);
                      }}
                      className={subtleButtonClass}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              )}
            </form>
          )}

          {activeTab === "bait" && (
            <form onSubmit={addBait} className="space-y-5">
              <div>
                <p className="text-lg font-black text-white">Add bait</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Add your 3 bait types here with images.
                </p>
              </div>
              <Field label="Bait name">
                <input
                  disabled={!data.isAdmin}
                  value={baitName}
                  onChange={(e) => setBaitName(e.target.value)}
                  placeholder="Bait name"
                  className={inputClass}
                />
              </Field>
              <Field label="Image">
                <input
                  disabled={!data.isAdmin}
                  value={baitImage}
                  onChange={(e) => setBaitImage(e.target.value)}
                  placeholder="Image URL, or upload below"
                  className={inputClass}
                />
              </Field>
              {data.isAdmin && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file, "bait");
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-[#00ffbf] file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
                />
              )}
              {baitImage && (
                <ImageBox src={baitImage} name={baitName || "Bait"} large />
              )}
              {data.isAdmin && (
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className={buttonClass}
                >
                  {uploading
                    ? "Uploading..."
                    : saving
                      ? "Saving..."
                      : "Add Bait"}
                </button>
              )}
            </form>
          )}

          {activeTab === "fish" && (
            <form onSubmit={addFish} className="space-y-5">
              <div>
                <p className="text-lg font-black text-white">Add fish/result</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Add image and sell price so profit per bait works.
                </p>
              </div>
              <Field label="Fish/result name">
                <input
                  disabled={!data.isAdmin}
                  value={fishName}
                  onChange={(e) => setFishName(e.target.value)}
                  placeholder="Fish/result name"
                  className={inputClass}
                />
              </Field>
              <Field label="Sell price">
                <input
                  disabled={!data.isAdmin}
                  type="number"
                  min="0"
                  step="0.01"
                  value={fishPrice}
                  onChange={(e) => setFishPrice(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <Field label="Image">
                <input
                  disabled={!data.isAdmin}
                  value={fishImage}
                  onChange={(e) => setFishImage(e.target.value)}
                  placeholder="Image URL, or upload below"
                  className={inputClass}
                />
              </Field>
              {data.isAdmin && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file, "fish");
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-[#00ffbf] file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
                />
              )}
              {fishImage && (
                <ImageBox src={fishImage} name={fishName || "Fish"} large />
              )}
              {data.isAdmin && (
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className={buttonClass}
                >
                  {uploading
                    ? "Uploading..."
                    : saving
                      ? "Saving..."
                      : "Add Fish"}
                </button>
              )}
            </form>
          )}

          {activeTab === "tools" && (
            <div className="space-y-5">
              <div>
                <p className="text-lg font-black text-white">Backup tools</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Export your data before big changes. Import supports the JSON
                  file exported here.
                </p>
              </div>
              <button
                type="button"
                onClick={exportData}
                className={buttonClass}
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className={subtleButtonClass}
              >
                Export CSV
              </button>
              {data.isAdmin && (
                <Field label="Import JSON">
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={importJson}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-[#00ffbf] file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
                  />
                </Field>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6 min-w-0">
          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5 lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-black text-white">
                  Best bait overview
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Sorted by profit per bait.
                </p>
              </div>
              {bestMoneyBait && (
                <p className="rounded-2xl border border-[#00ffbf]/20 bg-[#00ffbf]/10 px-4 py-2 text-sm font-black text-[#00ffbf]">
                  Best: {bestMoneyBait.bait.name} ·{" "}
                  {money(bestMoneyBait.profitPerBait)}/bait
                </p>
              )}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.18em] text-gray-500">
                  <tr>
                    <th className="py-3">Bait</th>
                    <th>Baits Used</th>
                    <th>Best Fish</th>
                    <th>Total Profit</th>
                    <th>Profit / Bait</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.map((row) => (
                    <tr key={row.bait.id} className="border-t border-white/10">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <ImageBox
                            src={row.bait.image_url}
                            name={row.bait.name}
                          />
                          <span className="font-black text-white">
                            {row.bait.name}
                          </span>
                        </div>
                      </td>
                      <td className="text-gray-300">{row.baitsUsed}</td>
                      <td className="text-gray-300">
                        {row.bestFish
                          ? `${row.bestFish.fish.name} (${percent(row.bestFish.chance)})`
                          : "-"}
                      </td>
                      <td className="font-bold text-white">
                        {money(row.profit)}
                      </td>
                      <td className="font-black text-[#00ffbf]">
                        {money(row.profitPerBait)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5 lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-black text-white">
                  Drop chance by bait
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Chance = fish caught ÷ baits used.
                </p>
              </div>
              <input
                value={targetFish}
                onChange={(e) => setTargetFish(e.target.value)}
                placeholder="Best bait for fish..."
                className={inputClass}
              />
            </div>
            {bestBait && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#00ffbf]/25 bg-[#00ffbf]/10 p-4">
                <ImageBox
                  src={bestBait.bait.image_url}
                  name={bestBait.bait.name}
                />
                <div>
                  <p className="text-sm text-gray-300">
                    Best bait for {bestBait.fish.name}
                  </p>
                  <p className="text-lg font-black text-white">
                    {bestBait.bait.name} · {percent(bestBait.chance)} ·{" "}
                    {money(bestBait.profitPerBait)}/bait
                  </p>
                </div>
              </div>
            )}
            <div className="mt-5 space-y-4">
              {loading && (
                <p className="text-sm text-gray-500">Loading fishing data...</p>
              )}
              {!loading && statsByBait.length === 0 && (
                <p className="text-sm text-gray-500">
                  No session stats yet. Add baits, fish, then save your first
                  session.
                </p>
              )}
              {statsByBait.map((rows) => (
                <div
                  key={rows[0].bait.id}
                  className="rounded-2xl border border-white/10 bg-black/25 p-4"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <ImageBox
                      src={rows[0].bait.image_url}
                      name={rows[0].bait.name}
                    />
                    <div>
                      <p className="font-black text-white">
                        {rows[0].bait.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {rows[0].baitsUsed} baits tested
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {rows.map((row) => (
                      <div
                        key={`${row.bait.id}-${row.fish.id}`}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-3"
                      >
                        <ImageBox
                          src={row.fish.image_url}
                          name={row.fish.name}
                        />
                        <div>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-bold text-white">
                              {row.fish.name}
                            </span>
                            <span className="font-black text-[#00ffbf]">
                              {percent(row.chance)}
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-[#00ffbf]"
                              style={{ width: `${Math.min(100, row.chance)}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {row.caught} caught · {money(row.profitPerBait)}
                            /bait · {money(row.profit)} total
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5 lg:p-6">
          <p className="text-lg font-black text-white">Latest sessions</p>
          <div className="mt-4 space-y-3">
            {data.sessions.slice(0, 10).map((session) => (
              <div
                key={session.id}
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ImageBox
                      src={session.aszuna_fishing_baits?.image_url}
                      name={session.aszuna_fishing_baits?.name || "Bait"}
                    />
                    <div>
                      <p className="font-black text-white">
                        {session.aszuna_fishing_baits?.name || "Deleted bait"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {session.baits_used} baits ·{" "}
                        {session.session_date ||
                          session.created_at.slice(0, 10)}
                        {session.location ? ` · ${session.location}` : ""}
                      </p>
                    </div>
                  </div>
                  {data.isAdmin && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditSession(session)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow("session", session.id)}
                        className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(session.aszuna_fishing_session_catches || []).map(
                    (catchRow) => (
                      <span
                        key={catchRow.id}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300"
                      >
                        {catchRow.amount}x{" "}
                        {catchRow.aszuna_fishing_fish?.name || "Deleted fish"}
                      </span>
                    ),
                  )}
                </div>
                {session.notes && (
                  <p className="mt-3 text-sm text-gray-500">{session.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5 lg:p-6">
            <p className="text-lg font-black text-white">Baits</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.baits.map((bait) => (
                <div
                  key={bait.id}
                  className="rounded-2xl border border-white/10 bg-black/25 p-3"
                >
                  <div className="flex items-center gap-3">
                    <ImageBox src={bait.image_url} name={bait.name} />
                    <p className="font-bold text-white">{bait.name}</p>
                  </div>
                  {data.isAdmin && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingBait(bait)}
                        className={subtleButtonClass}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow("bait", bait.id)}
                        className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5 lg:p-6">
            <p className="text-lg font-black text-white">Fish / results</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.fish.map((fish) => (
                <div
                  key={fish.id}
                  className="rounded-2xl border border-white/10 bg-black/25 p-3"
                >
                  <div className="flex items-center gap-3">
                    <ImageBox src={fish.image_url} name={fish.name} />
                    <div>
                      <p className="font-bold text-white">{fish.name}</p>
                      <p className="text-xs text-gray-500">
                        Sell price: {money(Number(fish.sell_price || 0))}
                      </p>
                    </div>
                  </div>
                  {data.isAdmin && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingFish(fish)}
                        className={subtleButtonClass}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow("fish", fish.id)}
                        className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {editingBait && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={updateBait}
            className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0b0b10] p-6 shadow-2xl"
          >
            <h3 className="text-2xl font-black text-white">Edit bait</h3>
            <div className="mt-5 space-y-4">
              <Field label="Name">
                <input
                  value={editingBait.name}
                  onChange={(e) =>
                    setEditingBait({ ...editingBait, name: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Image">
                <input
                  value={editingBait.image_url || ""}
                  onChange={(e) =>
                    setEditingBait({
                      ...editingBait,
                      image_url: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImage(file, "bait");
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-[#00ffbf] file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
              />
              {editingBait.image_url && (
                <ImageBox
                  src={editingBait.image_url}
                  name={editingBait.name}
                  large
                />
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={saving || uploading}
                className={buttonClass}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingBait(null)}
                className={subtleButtonClass}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editingFish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={updateFish}
            className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0b0b10] p-6 shadow-2xl"
          >
            <h3 className="text-2xl font-black text-white">Edit fish</h3>
            <div className="mt-5 space-y-4">
              <Field label="Name">
                <input
                  value={editingFish.name}
                  onChange={(e) =>
                    setEditingFish({ ...editingFish, name: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Sell price">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingFish.sell_price ?? 0}
                  onChange={(e) =>
                    setEditingFish({
                      ...editingFish,
                      sell_price: Number(e.target.value),
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Image">
                <input
                  value={editingFish.image_url || ""}
                  onChange={(e) =>
                    setEditingFish({
                      ...editingFish,
                      image_url: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImage(file, "fish");
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-[#00ffbf] file:px-4 file:py-2 file:text-sm file:font-bold file:text-black"
              />
              {editingFish.image_url && (
                <ImageBox
                  src={editingFish.image_url}
                  name={editingFish.name}
                  large
                />
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={saving || uploading}
                className={buttonClass}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingFish(null)}
                className={subtleButtonClass}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
