"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MapPin = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  color: string | null;
  image_url: string | null;
  x_position: number;
  y_position: number;
  created_at: string;
};

type GtaMapProps = {
  isAdmin: boolean;
};

type ViewState = {
  x: number;
  y: number;
  scale: number;
};

const MAP_WIDTH = 4096;
const MAP_HEIGHT = 4096;
const MAP_IMAGE = "/gta-map-small.jpg";
const START_SCALE = 0.25;

function sortPinsByTitle(a: MapPin, b: MapPin) {
  return a.title.localeCompare(b.title, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function PinSvg({
  icon,
  color,
}: {
  icon: string | null;
  color: string | null;
}) {
  const fill = color || "#ef4444";

  if (icon === "car") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8 drop-shadow-lg">
        <path
          fill={fill}
          d="M5 11l1.4-4.2A3 3 0 0 1 9.25 5h5.5a3 3 0 0 1 2.85 1.8L19 11h1a1 1 0 0 1 1 1v5h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3v-5a1 1 0 0 1 1-1h1Zm2.1 0h9.8l-1-3a1.5 1.5 0 0 0-1.42-1H9.52A1.5 1.5 0 0 0 8.1 8l-1 3ZM7 16.25A.75.75 0 1 0 7 14.75a.75.75 0 0 0 0 1.5Zm10 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        />
      </svg>
    );
  }

  if (icon === "house") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8 drop-shadow-lg">
        <path
          fill={fill}
          d="M3 11.5 12 4l9 7.5-1.3 1.5L18 11.6V20h-5v-5h-2v5H6v-8.4L4.3 13 3 11.5Z"
        />
      </svg>
    );
  }

  if (icon === "shop") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8 drop-shadow-lg">
        <path
          fill={fill}
          d="M5 4h14l1 5v2a3 3 0 0 1-5 2.24A3 3 0 0 1 12 14a3 3 0 0 1-3-0.76A3 3 0 0 1 4 11V9l1-5Zm1 11h12v5H6v-5Z"
        />
      </svg>
    );
  }

  if (icon === "star") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8 drop-shadow-lg">
        <path
          fill={fill}
          d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.3 6.8-6-3.4-6 3.4 1.3-6.8-5.1-4.7 6.9-.8L12 2Z"
        />
      </svg>
    );
  }

  if (icon === "warning") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8 drop-shadow-lg">
        <path
          fill={fill}
          d="M12 3 1.8 21h20.4L12 3Zm1 14h-2v2h2v-2Zm0-7h-2v5h2v-5Z"
        />
      </svg>
    );
  }

  if (icon === "man") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8 drop-shadow-lg">
        <path
          fill={fill}
          d="M12 2.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-2.5 7h5a3.5 3.5 0 0 1 3.5 3.5v3.2a1.3 1.3 0 0 1-2.6 0V13.5h-.7V21a1.5 1.5 0 0 1-3 0v-4h-.4v4a1.5 1.5 0 0 1-3 0v-7.5h-.7v2.7a1.3 1.3 0 0 1-2.6 0V13a3.5 3.5 0 0 1 3.5-3.5Z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 drop-shadow-lg">
      <path
        fill={fill}
        d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
      />
    </svg>
  );
}

export default function GtaMap({ isAdmin }: GtaMapProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const draggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const [pins, setPins] = useState<MapPin[]>([]);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [editingPin, setEditingPin] = useState<MapPin | null>(null);
  const [hoveredPin, setHoveredPin] = useState<MapPin | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const [newPinPosition, setNewPinPosition] = useState<{
    x_position: number;
    y_position: number;
  } | null>(null);

  const [view, setView] = useState<ViewState>({
    x: 0,
    y: 0,
    scale: START_SCALE,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [icon, setIcon] = useState("pin");
  const [color, setColor] = useState("#ef4444");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const categories = useMemo(() => {
    const unique = new Set<string>();

    pins.forEach((pin) => {
      const categoryName = pin.category?.trim() || "General";
      unique.add(categoryName);
    });

    return ["All", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [pins]);

  const filteredPins = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return pins
      .filter((pin) => {
        const pinCategory = pin.category?.trim() || "General";

        if (categoryFilter !== "All" && pinCategory !== categoryFilter) {
          return false;
        }

        if (!search) return true;

        const combined = [
          pin.title,
          pin.category || "General",
          pin.description || "",
        ]
          .join(" ")
          .toLowerCase();

        return combined.includes(search);
      })
      .sort(sortPinsByTitle);
  }, [pins, searchTerm, categoryFilter]);

  useEffect(() => {
    if (!selectedPin) return;

    const selectedPinCategory = selectedPin.category?.trim() || "General";
    const categoryMatches =
      categoryFilter === "All" || selectedPinCategory === categoryFilter;

    if (!categoryMatches) {
      setSelectedPin(null);
      setHoveredPin(null);
    }
  }, [categoryFilter, selectedPin]);

  async function loadPins() {
    try {
      const res = await fetch("/api/map-pins");
      const data = await res.json();

      if (res.ok) {
        setPins(data);
      }
    } catch {
      console.error("Failed to load map pins");
    }
  }

  useEffect(() => {
    loadPins();
  }, []);

  useEffect(() => {
    function centerMap() {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      setView({
        x: screenWidth / 2 - (MAP_WIDTH * START_SCALE) / 2,
        y: screenHeight / 2 - (MAP_HEIGHT * START_SCALE) / 2,
        scale: START_SCALE,
      });
    }

    centerMap();

    window.addEventListener("resize", centerMap);

    return () => {
      window.removeEventListener("resize", centerMap);
    };
  }, []);

  function resetForm() {
    setTitle("");
    setDescription("");
    setCategory("General");
    setIcon("pin");
    setColor("#ef4444");
    setImageUrl("");
  }

  function resetView() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    setView({
      x: screenWidth / 2 - (MAP_WIDTH * START_SCALE) / 2,
      y: screenHeight / 2 - (MAP_HEIGHT * START_SCALE) / 2,
      scale: START_SCALE,
    });
  }

  function zoomIn() {
    setView((current) => ({
      ...current,
      scale: Math.min(current.scale + 0.25, 5),
    }));
  }

  function zoomOut() {
    setView((current) => ({
      ...current,
      scale: Math.max(current.scale - 0.25, 0.15),
    }));
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const zoomAmount = event.deltaY < 0 ? 1.12 : 0.88;

    setView((current) => {
      const nextScale = Math.min(Math.max(current.scale * zoomAmount, 0.15), 5);

      const worldX = (mouseX - current.x) / current.scale;
      const worldY = (mouseY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: mouseX - worldX * nextScale,
        y: mouseY - worldY * nextScale,
      };
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;

    draggingRef.current = true;
    hasDraggedRef.current = false;

    lastMouseRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;

    const dx = event.clientX - lastMouseRef.current.x;
    const dy = event.clientY - lastMouseRef.current.y;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      hasDraggedRef.current = true;
    }

    lastMouseRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    setView((current) => ({
      ...current,
      x: current.x + dx,
      y: current.y + dy,
    }));
  }

  function handlePointerUp() {
    draggingRef.current = false;
  }

  function handleMapRightClick(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!isAdmin) return;

    hasDraggedRef.current = false;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();

    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const mapX = (clickX - view.x) / view.scale;
    const mapY = (clickY - view.y) / view.scale;

    if (mapX < 0 || mapY < 0 || mapX > MAP_WIDTH || mapY > MAP_HEIGHT) {
      return;
    }

    const x = (mapX / MAP_WIDTH) * 100;
    const y = (mapY / MAP_HEIGHT) * 100;

    setSelectedPin(null);
    setEditingPin(null);
    setHoveredPin(null);
    setNewPinPosition({
      x_position: Number(x.toFixed(2)),
      y_position: Number(y.toFixed(2)),
    });

    resetForm();
  }

  async function createPin(event: React.FormEvent) {
    event.preventDefault();

    if (!newPinPosition || !title.trim()) return;

    setSaving(true);

    try {
      const res = await fetch("/api/map-pins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          category,
          icon,
          color,
          image_url: imageUrl,
          x_position: newPinPosition.x_position,
          y_position: newPinPosition.y_position,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPins((current) => [data, ...current]);
        setNewPinPosition(null);
        resetForm();
      } else {
        alert(data.error || "Failed to create pin");
      }
    } catch {
      alert("Failed to create pin");
    }

    setSaving(false);
  }

  async function updatePin(event: React.FormEvent) {
    event.preventDefault();

    if (!editingPin || !title.trim()) return;

    setSaving(true);

    try {
      const res = await fetch("/api/map-pins", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingPin.id,
          title,
          description,
          category,
          icon,
          color,
          image_url: imageUrl,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPins((current) =>
          current.map((pin) => (pin.id === editingPin.id ? data : pin)),
        );
        setSelectedPin(data);
        setEditingPin(null);
        setNewPinPosition(null);
        resetForm();
      } else {
        alert(data.error || "Failed to update pin");
      }
    } catch {
      alert("Failed to update pin");
    }

    setSaving(false);
  }

  async function deletePin(id: string) {
    if (!confirm("Delete this pin?")) return;

    try {
      const res = await fetch("/api/map-pins", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setPins((current) => current.filter((pin) => pin.id !== id));
        setSelectedPin(null);
        setEditingPin(null);
        setHoveredPin(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete pin");
      }
    } catch {
      alert("Failed to delete pin");
    }
  }

  function startEditPin(pin: MapPin) {
    setEditingPin(pin);
    setSelectedPin(null);
    setNewPinPosition(null);
    setHoveredPin(null);

    setTitle(pin.title);
    setDescription(pin.description || "");
    setCategory(pin.category || "General");
    setIcon(pin.icon || "pin");
    setColor(pin.color || "#ef4444");
    setImageUrl(pin.image_url || "");
  }

  function cancelForm() {
    setEditingPin(null);
    setNewPinPosition(null);
    resetForm();
  }

  function animateToView(targetView: ViewState) {
    const startView = view;
    const duration = 650;
    const startTime = performance.now();

    function easeInOutCubic(t: number) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeInOutCubic(progress);

      setView({
        x: startView.x + (targetView.x - startView.x) * eased,
        y: startView.y + (targetView.y - startView.y) * eased,
        scale: startView.scale + (targetView.scale - startView.scale) * eased,
      });

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  function goToPin(pin: MapPin) {
    const targetScale = 1;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const pinX = (pin.x_position / 100) * MAP_WIDTH;
    const pinY = (pin.y_position / 100) * MAP_HEIGHT;

    animateToView({
      x: screenWidth / 2 - pinX * targetScale,
      y: screenHeight / 2 - pinY * targetScale,
      scale: targetScale,
    });

    setSelectedPin(pin);
    setEditingPin(null);
    setHoveredPin(null);
    setNewPinPosition(null);
  }

  function handlePinMouseMove(
    event: React.MouseEvent<HTMLButtonElement>,
    pin: MapPin,
  ) {
    setHoveredPin(pin);
    setTooltipPosition({
      x: event.clientX + 16,
      y: event.clientY + 16,
    });
  }

  const isFormOpen = Boolean(newPinPosition || editingPin);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0fa8d2] text-white">
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleMapRightClick}
        className="relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing"
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: `${MAP_WIDTH}px`,
            height: `${MAP_HEIGHT}px`,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: "0 0",
          }}
        >
          <img
            src={MAP_IMAGE}
            alt="GTA map"
            draggable={false}
            className="pointer-events-none absolute left-0 top-0 h-full w-full max-w-none select-none"
          />

          {filteredPins.map((pin) => (
            <button
              key={pin.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedPin(pin);
                setEditingPin(null);
                setHoveredPin(null);
                setNewPinPosition(null);
              }}
              onMouseEnter={(event) => handlePinMouseMove(event, pin)}
              onMouseMove={(event) => handlePinMouseMove(event, pin)}
              onMouseLeave={() => setHoveredPin(null)}
              className="absolute z-10 -translate-x-1/2 -translate-y-full transition hover:scale-125"
              style={{
                left: `${pin.x_position}%`,
                top: `${pin.y_position}%`,
              }}
              title={pin.title}
            >
              <PinSvg icon={pin.icon} color={pin.color} />
            </button>
          ))}

          {newPinPosition && (
            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-full"
              style={{
                left: `${newPinPosition.x_position}%`,
                top: `${newPinPosition.y_position}%`,
              }}
            >
              <PinSvg icon={icon} color={color} />
            </div>
          )}
        </div>
      </div>

      <div className="absolute left-4 top-24 z-50 rounded-2xl border border-white/10 bg-black/70 p-3 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold transition hover:bg-white/20"
          >
            -
          </button>

          <button
            type="button"
            onClick={zoomIn}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold transition hover:bg-white/20"
          >
            +
          </button>

          <button
            type="button"
            onClick={resetView}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/20"
          >
            Reset
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-300">
          Drag to move · Scroll to zoom
        </p>

        {isAdmin && (
          <p className="mt-1 text-xs text-yellow-300">
            Right click map to add a pin
          </p>
        )}
      </div>

      <div className="absolute left-4 top-56 z-50 w-[280px] rounded-2xl border border-white/10 bg-black/70 p-3 shadow-xl backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Categories</h3>
          <span className="text-xs text-gray-400">
            {filteredPins.length}/{pins.length}
          </span>
        </div>

        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
          {categories.map((categoryName) => (
            <button
              key={categoryName}
              type="button"
              onClick={() => setCategoryFilter(categoryName)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                categoryFilter === categoryName
                  ? "bg-indigo-600 text-white"
                  : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white"
              }`}
            >
              {categoryName}
            </button>
          ))}
        </div>
      </div>

      <aside className="absolute right-4 top-24 z-50 max-h-[calc(100vh-7rem)] w-[360px] overflow-y-auto rounded-2xl border border-white/10 bg-black/75 p-5 text-white shadow-2xl backdrop-blur">
        {isFormOpen && isAdmin ? (
          <form
            onSubmit={editingPin ? updatePin : createPin}
            className="space-y-4"
          >
            <h2 className="text-xl font-bold">
              {editingPin ? "Edit Pin" : "Add New Pin"}
            </h2>

            <div>
              <label className="mb-1 block text-sm text-gray-300">Title</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-indigo-400"
                placeholder="Example: Black market"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">
                Category
              </label>
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-indigo-400"
                placeholder="Example: Dealer, Mechanic, Stash, Hideout"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">Icon</label>
              <select
                value={icon}
                onChange={(event) => setIcon(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-indigo-400"
              >
                <option value="pin">Pin</option>
                <option value="car">Car</option>
                <option value="house">House</option>
                <option value="shop">Shop</option>
                <option value="star">Star</option>
                <option value="warning">Warning</option>
                <option value="man">Man</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">Color</label>
              <div className="flex flex-wrap gap-2">
                {[
                  "#ef4444",
                  "#22c55e",
                  "#3b82f6",
                  "#eab308",
                  "#a855f7",
                  "#f97316",
                  "#ec4899",
                  "#ffffff",
                  "#000000",
                ].map((pinColor) => (
                  <button
                    key={pinColor}
                    type="button"
                    onClick={() => setColor(pinColor)}
                    className={`h-8 w-8 rounded-full border-2 ${
                      color === pinColor ? "border-white" : "border-white/20"
                    }`}
                    style={{ backgroundColor: pinColor }}
                    title={pinColor}
                  />
                ))}
              </div>

              <input
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
                placeholder="#ef4444"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">
                Image URL
              </label>
              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-indigo-400"
                placeholder="https://example.com/image.jpg"
              />

              {imageUrl.trim() && (
                <img
                  src={imageUrl}
                  alt="Pin preview"
                  className="mt-3 max-h-40 w-full rounded-xl object-cover"
                />
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">
                Description
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-indigo-400"
                placeholder="Write notes about this place..."
              />
            </div>

            {newPinPosition && (
              <div className="text-xs text-gray-400">
                Position: {newPinPosition.x_position}%,{" "}
                {newPinPosition.y_position}%
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingPin
                    ? "Save Changes"
                    : "Save Pin"}
              </button>

              <button
                type="button"
                onClick={cancelForm}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : selectedPin ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <PinSvg icon={selectedPin.icon} color={selectedPin.color} />

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  {selectedPin.category || "General"}
                </p>
                <h2 className="text-2xl font-bold">{selectedPin.title}</h2>
              </div>
            </div>

            {selectedPin.image_url && (
              <img
                src={selectedPin.image_url}
                alt={selectedPin.title}
                className="max-h-52 w-full rounded-xl object-cover"
              />
            )}

            <p className="whitespace-pre-wrap text-sm text-gray-300">
              {selectedPin.description || "No description added."}
            </p>

            <div className="text-xs text-gray-500">
              Position: {selectedPin.x_position}%, {selectedPin.y_position}%
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => goToPin(selectedPin)}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Go To
              </button>

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => startEditPin(selectedPin)}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => deletePin(selectedPin.id)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
                  >
                    Delete
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setSelectedPin(null)}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Locations</h2>
              <p className="text-xs text-gray-400">
                {filteredPins.length} of {pins.length} pins shown
              </p>
            </div>

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-indigo-400"
              placeholder="Search title, category or description..."
            />

            <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
              {categories.map((categoryName) => (
                <button
                  key={categoryName}
                  type="button"
                  onClick={() => setCategoryFilter(categoryName)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    categoryFilter === categoryName
                      ? "bg-indigo-600 text-white"
                      : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white"
                  }`}
                >
                  {categoryName}
                </button>
              ))}
            </div>

            {filteredPins.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-400">
                No pins match your search/filter.
              </p>
            ) : (
              <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
                {filteredPins.map((pin) => (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => goToPin(pin)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"
                  >
                    <PinSvg icon={pin.icon} color={pin.color} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{pin.title}</p>
                      <p className="truncate text-xs text-gray-400">
                        {pin.category || "General"}
                      </p>
                      {pin.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                          {pin.description}
                        </p>
                      )}
                    </div>

                    {pin.image_url && (
                      <img
                        src={pin.image_url}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>

      {hoveredPin && (
        <div
          className="pointer-events-none fixed z-[9999] w-72 rounded-2xl border border-white/10 bg-black/90 p-3 text-white shadow-2xl backdrop-blur"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
          }}
        >
          {hoveredPin.image_url && (
            <img
              src={hoveredPin.image_url}
              alt={hoveredPin.title}
              className="mb-3 max-h-36 w-full rounded-xl object-cover"
            />
          )}

          <div className="flex items-start gap-2">
            <PinSvg icon={hoveredPin.icon} color={hoveredPin.color} />

            <div>
              <h3 className="font-bold leading-tight">{hoveredPin.title}</h3>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                {hoveredPin.category || "General"}
              </p>
            </div>
          </div>

          <p className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap text-sm text-gray-300">
            {hoveredPin.description || "No description added."}
          </p>
        </div>
      )}
    </div>
  );
}
