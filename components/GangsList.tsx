"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { createClient } from "@/lib/supabase/client";

type Gang = {
  id: string;
  name: string;
  image?: string | null;
  description?: string | null;
  status: "friendly" | "conflict";
};

type GangMember = {
  id: string;
  name: string;
  role: string;
  phone?: string | null;
  avatar?: string | null;
};

type GangEvent = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  image?: string | null;
  images?: string[] | null;
  pinned?: boolean | null;
  created_at: string;
  added_by?: string | null;
  added_by_email?: string | null;
  added_by_avatar?: string | null;
  gang_event_members?: {
    member: GangMember | null;
  }[];
};

type ConfirmAction =
  | { type: "gang"; id: string; name?: string }
  | { type: "event"; id: string; name?: string }
  | { type: "member"; id: string; name?: string };

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;

  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function roleColor(role: string) {
  const cleanRole = role.toLowerCase();

  if (cleanRole.includes("leader") || cleanRole.includes("boss")) {
    return "bg-red-500/15 text-red-300 border-red-400/30";
  }

  if (cleanRole.includes("co") || cleanRole.includes("underboss")) {
    return "bg-orange-500/15 text-orange-300 border-orange-400/30";
  }

  if (cleanRole.includes("recruit") || cleanRole.includes("trial")) {
    return "bg-blue-500/15 text-blue-300 border-blue-400/30";
  }

  if (cleanRole.includes("member")) {
    return "bg-green-500/15 text-green-300 border-green-400/30";
  }

  return "bg-purple-500/15 text-purple-300 border-purple-400/30";
}

function eventCategoryColor(category?: string | null) {
  const cleanCategory = (category || "Intel").toLowerCase();

  if (cleanCategory === "meeting") {
    return "border-blue-400/30 bg-blue-500/15 text-blue-300";
  }

  if (cleanCategory === "fight") {
    return "border-red-400/30 bg-red-500/15 text-red-300";
  }

  if (cleanCategory === "alliance") {
    return "border-green-400/30 bg-green-500/15 text-green-300";
  }

  if (cleanCategory === "warning") {
    return "border-yellow-400/30 bg-yellow-500/15 text-yellow-300";
  }

  if (cleanCategory === "screenshot") {
    return "border-purple-400/30 bg-purple-500/15 text-purple-300";
  }

  return "border-indigo-400/30 bg-indigo-500/15 text-indigo-300";
}

function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-32 rounded-b-xl border border-t-0 border-white/10 bg-white/10 px-4 py-3 text-white outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;

    if (value && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }

    if (!value && editor.getHTML() !== "<p></p>") {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  if (!editor) return null;

  const buttonClass =
    "rounded-lg bg-white/10 px-3 py-1 text-sm font-semibold text-white hover:bg-white/20";

  const activeButtonClass =
    "rounded-lg bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-500";

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-t-xl border border-white/10 bg-[#061625] p-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? activeButtonClass : buttonClass}
        >
          Bold
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={
            editor.isActive("italic") ? activeButtonClass : buttonClass
          }
        >
          Italic
        </button>

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={
            editor.isActive("heading", { level: 3 })
              ? activeButtonClass
              : buttonClass
          }
        >
          Heading
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={
            editor.isActive("bulletList") ? activeButtonClass : buttonClass
          }
        >
          Bullet List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={
            editor.isActive("orderedList") ? activeButtonClass : buttonClass
          }
        >
          Number List
        </button>

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
          className={buttonClass}
        >
          Clear
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  const sizeClasses = {
    xs: "h-5 w-5 text-[10px]",
    sm: "h-7 w-7 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-24 w-24 text-3xl",
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-white/10 font-bold text-white`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function GangsList({ gangs }: { gangs: Gang[] }) {
  const supabase = createClient();

  const [gangList, setGangList] = useState<Gang[]>(gangs);

  const [editingGang, setEditingGang] = useState<Gang | null>(null);
  const [editingMember, setEditingMember] = useState<GangMember | null>(null);
  const [editingEvent, setEditingEvent] = useState<GangEvent | null>(null);
  const [selectedMember, setSelectedMember] = useState<GangMember | null>(null);
  const [selectedGang, setSelectedGang] = useState<Gang | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "members">(
    "timeline",
  );

  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"friendly" | "conflict">("friendly");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [events, setEvents] = useState<GangEvent[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventCategory, setEventCategory] = useState("Intel");
  const [eventPinned, setEventPinned] = useState(false);
  const [eventImages, setEventImages] = useState<string[]>([]);
  const [uploadingEventImage, setUploadingEventImage] = useState(false);
  const [selectedEventMembers, setSelectedEventMembers] = useState<string[]>(
    [],
  );

  const [members, setMembers] = useState<GangMember[]>([]);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberAvatar, setMemberAvatar] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  function openLightbox(images: string[], index: number) {
    setLightboxImages(images);
    setLightboxIndex(index);
  }

  function closeLightbox() {
    setLightboxImages([]);
    setLightboxIndex(0);
  }

  function nextLightboxImage() {
    setLightboxIndex((prev) =>
      prev + 1 >= lightboxImages.length ? 0 : prev + 1,
    );
  }

  function previousLightboxImage() {
    setLightboxIndex((prev) =>
      prev - 1 < 0 ? lightboxImages.length - 1 : prev - 1,
    );
  }

  function getEventImages(event: GangEvent) {
    if (Array.isArray(event.images) && event.images.length > 0) {
      return event.images.filter(Boolean);
    }

    if (event.image) {
      return [event.image];
    }

    return [];
  }

  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

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
      alert(error.message);
      return;
    }

    const { data } = supabase.storage
      .from("gang-images")
      .getPublicUrl(fileName);

    setImage(data.publicUrl);
    setUploadingImage(false);
  }

  async function uploadEventImages(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploadingEventImage(true);

    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

      const { error } = await supabase.storage
        .from("gang-event-images")
        .upload(fileName, file);

      if (error) {
        setUploadingEventImage(false);
        alert(error.message);
        return;
      }

      const { data } = supabase.storage
        .from("gang-event-images")
        .getPublicUrl(fileName);

      uploadedUrls.push(data.publicUrl);
    }

    setEventImages((prev) => [...prev, ...uploadedUrls]);
    setUploadingEventImage(false);
  }

  async function uploadMemberAvatar(file: File) {
    setUploadingAvatar(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;

    const { error } = await supabase.storage
      .from("gang-member-avatars")
      .upload(fileName, file);

    if (error) {
      setUploadingAvatar(false);
      alert(error.message);
      return;
    }

    const { data } = supabase.storage
      .from("gang-member-avatars")
      .getPublicUrl(fileName);

    setMemberAvatar(data.publicUrl);
    setUploadingAvatar(false);
  }

  function openEdit(gang: Gang) {
    setEditingGang(gang);
    setName(gang.name);
    setImage(gang.image ?? "");
    setDescription(gang.description ?? "");
    setStatus(gang.status);
  }

  function openEditMember(member: GangMember) {
    setEditingMember(member);
    setMemberName(member.name);
    setMemberRole(member.role);
    setMemberPhone(member.phone ?? "");
    setMemberAvatar(member.avatar ?? "");
  }

  function openEditEvent(event: GangEvent) {
    setEditingEvent(event);
    setEventTitle(event.title);
    setEventDescription(event.description ?? "");
    setEventCategory(event.category || "Intel");
    setEventPinned(Boolean(event.pinned));
    setEventImages(getEventImages(event));
    setSelectedEventMembers(
      event.gang_event_members
        ?.map(({ member }) => member?.id)
        .filter(Boolean) as string[],
    );
  }

  function openAddEvent() {
    setEditingEvent(null);
    setEventTitle("");
    setEventDescription("");
    setEventCategory("Intel");
    setEventPinned(false);
    setEventImages([]);
    setSelectedEventMembers([]);
    setShowAddEvent(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGang) return;

    setSaving(true);

    const res = await fetch("/api/gangs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingGang.id,
        name,
        image,
        description,
        status,
      }),
    });

    setSaving(false);

    if (!res.ok) return alert("Failed to update gang");

    const updatedGang: Gang = {
      ...editingGang,
      name,
      image,
      description,
      status,
    };

    setGangList((prev) =>
      prev.map((gang) => (gang.id === editingGang.id ? updatedGang : gang)),
    );

    setSelectedGang((prev) =>
      prev?.id === editingGang.id ? updatedGang : prev,
    );
    setEditingGang(null);
  }

  async function saveMemberEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMember || !selectedGang) return;

    const res = await fetch("/api/gangs/details", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "member",
        id: editingMember.id,
        name: memberName,
        role: memberRole,
        phone: memberPhone,
        avatar: memberAvatar,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      return alert(data.error || "Failed to update member");
    }

    setEditingMember(null);
    setMemberName("");
    setMemberRole("");
    setMemberPhone("");
    setMemberAvatar("");
    loadGangDetails(selectedGang.id);
  }

  async function saveEventEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEvent || !selectedGang) return;

    const res = await fetch("/api/gangs/details", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "event",
        id: editingEvent.id,
        title: eventTitle,
        description: eventDescription,
        category: eventCategory,
        pinned: eventPinned,
        image: eventImages[0] || null,
        images: eventImages,
        memberIds: selectedEventMembers,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      return alert(data.error || "Failed to update event");
    }

    setEditingEvent(null);
    setEventTitle("");
    setEventDescription("");
    setEventCategory("Intel");
    setEventPinned(false);
    setEventImages([]);
    setSelectedEventMembers([]);
    loadGangDetails(selectedGang.id);
  }

  async function deleteGang(id: string) {
    setDeleting(true);

    const res = await fetch("/api/gangs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    setDeleting(false);

    if (!res.ok) return alert("Failed to delete gang");

    setGangList((prev) => prev.filter((gang) => gang.id !== id));

    if (selectedGang?.id === id) {
      setSelectedGang(null);
    }

    setConfirmAction(null);
  }

  function runConfirmAction() {
    if (!confirmAction) return;

    if (confirmAction.type === "gang") {
      deleteGang(confirmAction.id);
    }

    if (confirmAction.type === "event") {
      deleteEvent(confirmAction.id);
    }

    if (confirmAction.type === "member") {
      deleteMember(confirmAction.id);
    }
  }

  async function loadGangDetails(gangId: string) {
    const res = await fetch(`/api/gangs/details?gangId=${gangId}`);
    const data = await res.json();

    setEvents(data.events ?? []);
    setMembers(data.members ?? []);
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGang) return;

    const res = await fetch("/api/gangs/details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "event",
        gangId: selectedGang.id,
        title: eventTitle,
        description: eventDescription,
        category: eventCategory,
        pinned: eventPinned,
        image: eventImages[0] || null,
        images: eventImages,
        memberIds: selectedEventMembers,
      }),
    });

    if (!res.ok) return alert("Failed to add event");

    setEventTitle("");
    setEventDescription("");
    setEventCategory("Intel");
    setEventPinned(false);
    setEventImages([]);
    setSelectedEventMembers([]);
    setShowAddEvent(false);
    loadGangDetails(selectedGang.id);
  }

  async function deleteEvent(id: string) {
    setDeleting(true);

    const res = await fetch("/api/gangs/details", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "event", id }),
    });

    setDeleting(false);

    if (!res.ok) return alert("Failed to delete event");

    setEvents((prev) => prev.filter((event) => event.id !== id));
    setConfirmAction(null);
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGang) return;

    const res = await fetch("/api/gangs/details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "member",
        gangId: selectedGang.id,
        name: memberName,
        role: memberRole,
        phone: memberPhone,
        avatar: memberAvatar,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      return alert(data.error || "Failed to add member");
    }

    setMemberName("");
    setMemberRole("");
    setMemberPhone("");
    setMemberAvatar("");
    setShowAddMember(false);
    loadGangDetails(selectedGang.id);
  }

  async function deleteMember(id: string) {
    setDeleting(true);

    const res = await fetch("/api/gangs/details", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "member", id }),
    });

    setDeleting(false);

    if (!res.ok) return alert("Failed to delete member");

    setMembers((prev) => prev.filter((member) => member.id !== id));
    setEvents((prev) =>
      prev.map((event) => ({
        ...event,
        gang_event_members: event.gang_event_members?.filter(
          ({ member }) => member?.id !== id,
        ),
      })),
    );

    if (selectedMember?.id === id) {
      setSelectedMember(null);
    }

    setConfirmAction(null);
  }

  useEffect(() => {
    if (selectedGang) {
      setActiveTab("timeline");
      loadGangDetails(selectedGang.id);
    }
  }, [selectedGang]);

  const eventFormFields = (
    <div className="space-y-4">
      <input
        value={eventTitle}
        onChange={(e) => setEventTitle(e.target.value)}
        placeholder="Event title"
        className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
      />

      <RichTextEditor value={eventDescription} onChange={setEventDescription} />

      <select
        value={eventCategory}
        onChange={(e) => setEventCategory(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#061625] px-4 py-3 text-white outline-none"
      >
        <option className="bg-[#061625] text-white" value="Intel">
          Intel
        </option>
        <option className="bg-[#061625] text-white" value="Meeting">
          Meeting
        </option>
        <option className="bg-[#061625] text-white" value="Fight">
          Fight
        </option>
        <option className="bg-[#061625] text-white" value="Alliance">
          Alliance
        </option>
        <option className="bg-[#061625] text-white" value="Warning">
          Warning
        </option>
        <option className="bg-[#061625] text-white" value="Screenshot">
          Screenshot
        </option>
      </select>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-3 text-sm font-semibold text-yellow-200">
        <input
          type="checkbox"
          checked={eventPinned}
          onChange={(e) => setEventPinned(e.target.checked)}
          className="h-4 w-4 accent-yellow-400"
        />

        <span>Pin this event to the top</span>
      </label>

      <div className="space-y-2">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => uploadEventImages(e.target.files)}
          className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none"
        />

        {uploadingEventImage && (
          <p className="text-sm text-gray-400">Uploading event images...</p>
        )}

        {eventImages.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {eventImages.map((imageUrl, index) => (
              <div key={`${imageUrl}-${index}`} className="relative">
                <button
                  type="button"
                  onClick={() => openLightbox(eventImages, index)}
                  className="block w-full overflow-hidden rounded-xl border border-white/10"
                >
                  <img
                    src={imageUrl}
                    alt={`Event preview ${index + 1}`}
                    className="h-32 w-full object-cover transition hover:scale-[1.02]"
                  />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setEventImages((prev) =>
                      prev.filter((_, imageIndex) => imageIndex !== index),
                    )
                  }
                  className="absolute right-2 top-2 rounded-lg bg-black/70 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-white">Linked Members</p>

        <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3">
          {members.map((member) => (
            <label
              key={member.id}
              className="flex cursor-pointer items-center gap-3 text-sm text-gray-300"
            >
              <input
                type="checkbox"
                checked={selectedEventMembers.includes(member.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedEventMembers((prev) => [...prev, member.id]);
                  } else {
                    setSelectedEventMembers((prev) =>
                      prev.filter((id) => id !== member.id),
                    );
                  }
                }}
              />

              <Avatar src={member.avatar} name={member.name} size="sm" />

              <span>{member.name}</span>
            </label>
          ))}

          {members.length === 0 && (
            <p className="text-sm text-gray-400">No members to link.</p>
          )}
        </div>
      </div>
    </div>
  );

  const editModal =
    editingGang &&
    createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 px-4">
        <form
          onSubmit={saveEdit}
          className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#081b2f] p-6 text-white shadow-2xl"
        >
          <button
            type="button"
            onClick={() => setEditingGang(null)}
            className="absolute right-4 top-4 text-2xl text-white hover:text-red-400"
          >
            ×
          </button>

          <h2 className="mb-5 text-2xl font-bold">Edit Gang</h2>

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
              onChange={(e) =>
                setStatus(e.target.value as "friendly" | "conflict")
              }
              className="w-full rounded-xl border border-white/10 bg-[#061625] px-4 py-3 text-white outline-none"
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
              disabled={saving || uploadingImage}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>,
      document.body,
    );

  const addEventModal =
    showAddEvent &&
    createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 px-4">
        <form
          onSubmit={addEvent}
          className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#081b2f] p-6 text-white shadow-2xl"
        >
          <button
            type="button"
            onClick={() => setShowAddEvent(false)}
            className="absolute right-4 top-4 text-2xl text-white hover:text-red-400"
          >
            ×
          </button>

          <h2 className="mb-5 text-2xl font-bold">Add Event</h2>

          {eventFormFields}

          <button
            disabled={uploadingEventImage}
            className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            Add Event
          </button>
        </form>
      </div>,
      document.body,
    );

  const editEventModal =
    editingEvent &&
    createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 px-4">
        <form
          onSubmit={saveEventEdit}
          className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#081b2f] p-6 text-white shadow-2xl"
        >
          <button
            type="button"
            onClick={() => setEditingEvent(null)}
            className="absolute right-4 top-4 text-2xl text-white hover:text-red-400"
          >
            ×
          </button>

          <h2 className="mb-5 text-2xl font-bold">Edit Event</h2>

          {eventFormFields}

          <button
            disabled={uploadingEventImage}
            className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            Save Event
          </button>
        </form>
      </div>,
      document.body,
    );

  const addMemberModal =
    showAddMember &&
    createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 px-4">
        <form
          onSubmit={addMember}
          className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#081b2f] p-6 text-white shadow-2xl"
        >
          <button
            type="button"
            onClick={() => setShowAddMember(false)}
            className="absolute right-4 top-4 text-2xl text-white hover:text-red-400"
          >
            ×
          </button>

          <h2 className="mb-5 text-2xl font-bold">Add Member</h2>

          <div className="space-y-4">
            <input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Member name"
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
            />

            <input
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
              placeholder="Member role"
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
            />

            <input
              value={memberPhone}
              onChange={(e) => setMemberPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
            />

            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMemberAvatar(file);
                }}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none"
              />

              {uploadingAvatar && (
                <p className="text-sm text-gray-400">Uploading avatar...</p>
              )}

              {memberAvatar && (
                <img
                  src={memberAvatar}
                  alt="Member avatar preview"
                  className="h-24 w-24 rounded-full object-cover"
                />
              )}
            </div>

            <button
              disabled={uploadingAvatar}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              Add Member
            </button>
          </div>
        </form>
      </div>,
      document.body,
    );

  const editMemberModal =
    editingMember &&
    createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 px-4">
        <form
          onSubmit={saveMemberEdit}
          className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#081b2f] p-6 text-white shadow-2xl"
        >
          <button
            type="button"
            onClick={() => setEditingMember(null)}
            className="absolute right-4 top-4 text-2xl text-white hover:text-red-400"
          >
            ×
          </button>

          <h2 className="mb-5 text-2xl font-bold">Edit Member</h2>

          <div className="space-y-4">
            <input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Member name"
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
            />

            <input
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
              placeholder="Member role"
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
            />

            <input
              value={memberPhone}
              onChange={(e) => setMemberPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
            />

            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMemberAvatar(file);
                }}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none"
              />

              {uploadingAvatar && (
                <p className="text-sm text-gray-400">Uploading avatar...</p>
              )}

              {memberAvatar && (
                <img
                  src={memberAvatar}
                  alt="Member avatar preview"
                  className="h-24 w-24 rounded-full object-cover"
                />
              )}
            </div>

            <button
              disabled={uploadingAvatar}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              Save Member
            </button>
          </div>
        </form>
      </div>,
      document.body,
    );

  const memberProfileModal =
    selectedMember &&
    createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 px-4">
        <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#081b2f] p-6 text-center text-white shadow-2xl">
          <button
            type="button"
            onClick={() => setSelectedMember(null)}
            className="absolute right-4 top-4 text-2xl text-white hover:text-red-400"
          >
            ×
          </button>

          <div className="flex justify-center">
            <Avatar
              src={selectedMember.avatar}
              name={selectedMember.name}
              size="xl"
            />
          </div>

          <h2 className="mt-4 text-2xl font-bold">{selectedMember.name}</h2>

          <span
            className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${roleColor(
              selectedMember.role,
            )}`}
          >
            {selectedMember.role || "No role"}
          </span>

          {selectedMember.phone && (
            <p className="mt-4 text-sm text-gray-300">
              Phone: {selectedMember.phone}
            </p>
          )}

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => {
                setSelectedMember(null);
                openEditMember(selectedMember);
              }}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500"
            >
              Edit Member
            </button>

            <button
              onClick={() =>
                setConfirmAction({
                  type: "member",
                  id: selectedMember.id,
                  name: selectedMember.name,
                })
              }
              className="rounded-xl bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/25"
            >
              Delete
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  const confirmModal =
    confirmAction &&
    createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 px-4">
        <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#081b2f] p-6 text-white shadow-2xl">
          <button
            type="button"
            onClick={() => {
              if (!deleting) setConfirmAction(null);
            }}
            className="absolute right-4 top-4 text-2xl text-white hover:text-red-400"
          >
            ×
          </button>

          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl text-red-300">
            !
          </div>

          <h2 className="text-2xl font-bold">Confirm Delete</h2>

          <p className="mt-3 text-sm leading-6 text-gray-300">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-white">
              {confirmAction.name || `this ${confirmAction.type}`}
            </span>
            ? This action cannot be undone.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirmAction(null)}
              className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={deleting}
              onClick={runConfirmAction}
              className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  const detailsModal =
    selectedGang &&
    createPortal(
      <div className="fixed inset-0 z-[2147483647] overflow-y-auto bg-black/80 px-4 py-10">
        <div className="relative mx-auto min-h-[90vh] w-full max-w-6xl rounded-2xl border border-white/10 bg-[#081b2f] p-6 text-white shadow-2xl">
          <button
            type="button"
            onClick={() => setSelectedGang(null)}
            className="absolute right-4 top-4 z-20 text-2xl text-white hover:text-red-400"
          >
            ×
          </button>

          <div className="relative mb-8 h-56 w-full overflow-hidden rounded-2xl border border-white/10">
            {selectedGang.image ? (
              <img
                src={selectedGang.image}
                alt={selectedGang.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-blue-900" />
            )}

            <div className="absolute inset-0 bg-black/60" />

            <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">
                Gang Profile
              </p>

              <h2 className="mt-2 text-4xl font-bold text-white">
                {selectedGang.name}
              </h2>

              <p className="mt-3 max-w-2xl text-gray-300">
                {selectedGang.description || "No description"}
              </p>
            </div>
          </div>

          <div className="mb-8 flex justify-center gap-3">
            <button
              onClick={() => setActiveTab("timeline")}
              className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
                activeTab === "timeline"
                  ? "bg-indigo-600 text-white"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              Timeline
            </button>

            <button
              onClick={() => setActiveTab("members")}
              className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
                activeTab === "members"
                  ? "bg-indigo-600 text-white"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              Members
            </button>
          </div>

          {activeTab === "timeline" && (
            <>
              <div className="mb-8 flex justify-center">
                <button
                  onClick={openAddEvent}
                  className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold hover:bg-indigo-500"
                >
                  + Add Event
                </button>
              </div>

              <div className="relative mx-auto max-w-5xl pb-10">
                <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-white/20 md:block" />

                <div className="space-y-10">
                  {events.map((event, index) => (
                    <div
                      key={event.id}
                      className={`relative flex ${
                        index % 2 === 0 ? "md:justify-start" : "md:justify-end"
                      }`}
                    >
                      <div className="absolute left-1/2 top-6 hidden h-4 w-4 -translate-x-1/2 rounded-full border-4 border-[#081b2f] bg-indigo-500 md:block" />

                      <div
                        className={`w-full rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-lg md:w-[calc(50%-2rem)] ${
                          index % 2 === 0 ? "md:text-right" : "md:text-left"
                        }`}
                      >
                        <div
                          className={`mb-3 flex items-center gap-2 ${
                            index % 2 === 0
                              ? "md:justify-end"
                              : "md:justify-start"
                          }`}
                        >
                          <Avatar
                            src={event.added_by_avatar}
                            name={event.added_by_email || "Unknown author"}
                            size="sm"
                          />

                          <div>
                            <p className="text-xs font-semibold text-white">
                              {event.added_by_email || "Unknown author"}
                            </p>
                            <p className="text-xs uppercase tracking-[0.16em] text-indigo-300">
                              {timeAgo(event.created_at)}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`mb-2 flex flex-wrap items-center gap-2 ${
                            index % 2 === 0
                              ? "md:justify-end"
                              : "md:justify-start"
                          }`}
                        >
                          {event.pinned && (
                            <span className="rounded-full border border-yellow-400/30 bg-yellow-500/15 px-3 py-1 text-xs font-semibold text-yellow-300">
                              📌 Pinned
                            </span>
                          )}

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${eventCategoryColor(
                              event.category,
                            )}`}
                          >
                            {event.category || "Intel"}
                          </span>
                        </div>

                        <h3 className="text-xl font-bold">{event.title}</h3>

                        {event.description ? (
                          <div
                            className="mt-2 text-sm leading-6 text-gray-300 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-5"
                            dangerouslySetInnerHTML={{
                              __html: event.description,
                            }}
                          />
                        ) : (
                          <p className="mt-2 text-sm leading-6 text-gray-300">
                            No description
                          </p>
                        )}

                        {getEventImages(event).length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              openLightbox(getEventImages(event), 0)
                            }
                            className="group relative mt-4 block w-full overflow-hidden rounded-xl border border-white/10"
                          >
                            <img
                              src={getEventImages(event)[0]}
                              alt={event.title}
                              className="max-h-[420px] w-full object-cover transition group-hover:scale-[1.02]"
                            />

                            {getEventImages(event).length > 1 && (
                              <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                                +{getEventImages(event).length - 1} more
                              </div>
                            )}

                            {getEventImages(event).length > 1 && (
                              <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                                Gallery
                              </div>
                            )}
                          </button>
                        )}

                        {event.gang_event_members &&
                          event.gang_event_members.length > 0 && (
                            <div
                              className={`mt-4 flex flex-wrap gap-2 ${
                                index % 2 === 0
                                  ? "md:justify-end"
                                  : "md:justify-start"
                              }`}
                            >
                              {event.gang_event_members.map(({ member }) =>
                                member ? (
                                  <div
                                    key={member.id}
                                    className="group relative"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setSelectedMember(member)}
                                      className="flex cursor-pointer items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
                                    >
                                      <Avatar
                                        src={member.avatar}
                                        name={member.name}
                                        size="xs"
                                      />

                                      {member.name}
                                    </button>

                                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 hidden w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-[#061625] p-4 text-left shadow-2xl group-hover:block">
                                      <div className="flex items-center gap-3">
                                        <Avatar
                                          src={member.avatar}
                                          name={member.name}
                                          size="lg"
                                        />

                                        <div>
                                          <p className="font-bold text-white">
                                            {member.name}
                                          </p>

                                          <span
                                            className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${roleColor(
                                              member.role,
                                            )}`}
                                          >
                                            {member.role}
                                          </span>

                                          {member.phone && (
                                            <p className="mt-1 text-sm text-gray-400">
                                              Phone: {member.phone}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      <p className="mt-3 text-xs text-indigo-300">
                                        Click to open profile
                                      </p>
                                    </div>
                                  </div>
                                ) : null,
                              )}
                            </div>
                          )}

                        <div
                          className={`mt-4 flex gap-4 ${
                            index % 2 === 0 ? "md:justify-end" : ""
                          }`}
                        >
                          <button
                            onClick={() => openEditEvent(event)}
                            className="text-sm text-indigo-300 hover:text-indigo-200"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              setConfirmAction({
                                type: "event",
                                id: event.id,
                                name: event.title,
                              })
                            }
                            className="text-sm text-red-400 hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {events.length === 0 && (
                    <p className="text-center text-sm text-gray-400">
                      No timeline events yet.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "members" && (
            <div className="mx-auto max-w-4xl">
              <div className="mb-8 flex justify-center">
                <button
                  onClick={() => setShowAddMember(true)}
                  className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold hover:bg-indigo-500"
                >
                  + Add Member
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.06] p-4"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedMember(member)}
                      className="flex items-center gap-4 text-left"
                    >
                      <Avatar
                        src={member.avatar}
                        name={member.name}
                        size="lg"
                      />

                      <div>
                        <h4 className="font-bold">{member.name}</h4>

                        <span
                          className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${roleColor(
                            member.role,
                          )}`}
                        >
                          {member.role || "No role"}
                        </span>

                        {member.phone && (
                          <p className="mt-1 text-sm text-gray-400">
                            Phone: {member.phone}
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="flex gap-3">
                      <button
                        onClick={() => openEditMember(member)}
                        className="text-sm text-indigo-300 hover:text-indigo-200"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          setConfirmAction({
                            type: "member",
                            id: member.id,
                            name: member.name,
                          })
                        }
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                {members.length === 0 && (
                  <p className="text-sm text-gray-400">No members yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>,
      document.body,
    );

  const imageLightboxModal =
    lightboxImages.length > 0 &&
    createPortal(
      <div
        onClick={closeLightbox}
        className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/95 p-4"
      >
        <button
          type="button"
          onClick={closeLightbox}
          className="absolute right-5 top-5 z-20 text-3xl text-white hover:text-red-400"
        >
          ×
        </button>

        {lightboxImages.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              previousLightboxImage();
            }}
            className="absolute left-5 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-3xl text-white hover:bg-white/20"
          >
            ‹
          </button>
        )}

        <img
          src={lightboxImages[lightboxIndex]}
          alt="Preview"
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain"
        />

        {lightboxImages.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextLightboxImage();
            }}
            className="absolute right-5 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-3xl text-white hover:bg-white/20"
          >
            ›
          </button>
        )}

        {lightboxImages.length > 1 && (
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-sm text-white">
            {lightboxIndex + 1} / {lightboxImages.length}
          </p>
        )}
      </div>,
      document.body,
    );

  return (
    <>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {gangList.map((gang) => (
          <div
            key={gang.id}
            onClick={() => setSelectedGang(gang)}
            className="cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:-translate-y-1 hover:bg-white/[0.07]"
          >
            <div className="h-36 bg-white/5">
              {gang.image ? (
                <img
                  src={gang.image}
                  alt={gang.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  No image
                </div>
              )}
            </div>

            <div className="p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">{gang.name}</h2>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    gang.status === "friendly"
                      ? "bg-green-500/15 text-green-400"
                      : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {gang.status === "friendly" ? "Friendly" : "In Conflict"}
                </span>
              </div>

              <p className="line-clamp-3 text-sm text-gray-300">
                {gang.description || "No description"}
              </p>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(gang);
                  }}
                  className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
                >
                  Edit
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmAction({
                      type: "gang",
                      id: gang.id,
                      name: gang.name,
                    });
                  }}
                  className="rounded-lg bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/25"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editModal}
      {detailsModal}
      {addEventModal}
      {editEventModal}
      {addMemberModal}
      {editMemberModal}
      {memberProfileModal}
      {imageLightboxModal}
      {confirmModal}
    </>
  );
}
