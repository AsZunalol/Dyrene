"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { createClient } from "@/lib/supabase/client";

type TrojanGuide = {
  id: string;
  title: string;
  category: string | null;
  difficulty: string | null;
  short_description: string | null;
  content: string | null;
  cover_image: string | null;
  images: string[] | null;
  created_by: string | null;
  author_name?: string | null;
  author_avatar_url?: string | null;
  created_at: string;
  updated_at: string | null;
};

function RichTextEditor({
  value,
  onChange,
  onUploadImage,
}: {
  value: string;
  onChange: (value: string) => void;
  onUploadImage: (file: File) => Promise<string | null>;
}) {
  const [uploadingInlineImage, setUploadingInlineImage] = useState(false);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class:
            "my-5 mx-auto max-h-[360px] w-auto max-w-full rounded-2xl border border-white/10 bg-black/20 object-contain shadow-lg",
        },
      }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[520px] rounded-b-xl border border-t-0 border-emerald-400/20 bg-black/70 px-4 py-4 font-mono text-emerald-100 outline-none [&_code]:rounded-md [&_code]:border [&_code]:border-emerald-400/25 [&_code]:bg-black/70 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-emerald-200 [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-black [&_h3]:text-white [&_img]:mx-auto [&_img]:my-5 [&_img]:max-h-[360px] [&_img]:w-auto [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-emerald-400/25 [&_pre]:bg-[#020617] [&_pre]:p-4 [&_pre]:text-emerald-200 [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-bold [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    onUpdate({ editor }) {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }

      updateTimerRef.current = setTimeout(() => {
        onChange(editor.getHTML());
      }, 150);
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

  useEffect(() => {
    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, []);

  if (!editor) return null;

  const buttonClass =
    "rounded-lg border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 font-mono text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50";
  const activeButtonClass =
    "rounded-lg border border-emerald-300/30 bg-emerald-500 px-3 py-1 font-mono text-sm font-bold text-black hover:bg-emerald-400";

  function makeCurrentLineCodeBlock() {
    editor.commands.command(({ state, dispatch }) => {
      const { schema, selection } = state;
      const codeBlockType = schema.nodes.codeBlock;
      const paragraphType = schema.nodes.paragraph;

      if (!codeBlockType || !paragraphType) return false;

      const { $from } = selection;
      let blockDepth = $from.depth;

      while (blockDepth > 0 && !$from.node(blockDepth).isTextblock) {
        blockDepth -= 1;
      }

      if (blockDepth <= 0) return false;

      const currentNode = $from.node(blockDepth);
      const from = $from.before(blockDepth);
      const to = $from.after(blockDepth);
      const text = currentNode.textContent;

      if (!dispatch) return true;

      const tr = state.tr;

      if (currentNode.type === codeBlockType) {
        const paragraphNode = paragraphType.create(
          currentNode.attrs,
          text ? schema.text(text) : undefined,
        );

        tr.replaceWith(from, to, paragraphNode);
        tr.setSelection(TextSelection.near(tr.doc.resolve(from + 1)));
        dispatch(tr.scrollIntoView());
        return true;
      }

      const codeNode = codeBlockType.create(
        null,
        text ? schema.text(text) : undefined,
      );
      const emptyParagraph = paragraphType.create();

      tr.replaceWith(from, to, [codeNode, emptyParagraph]);
      tr.setSelection(TextSelection.near(tr.doc.resolve(from + codeNode.nodeSize + 1)));
      dispatch(tr.scrollIntoView());
      return true;
    });

    editor.commands.focus();
  }

  function insertImageUrl() {
    const url = prompt("Paste image URL");
    if (!url?.trim()) return;

    editor.chain().focus().setImage({ src: url.trim() }).run();
  }

  async function insertUploadedImage(file: File | undefined) {
    if (!file) return;

    setUploadingInlineImage(true);
    const url = await onUploadImage(file);
    setUploadingInlineImage(false);

    if (!url) return;

    editor.chain().focus().setImage({ src: url }).run();
  }

  return (
    <div className="relative">
      <div className="sticky top-0 z-30 flex flex-wrap gap-2 rounded-t-xl border border-emerald-400/25 bg-[#03140f] p-2">
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
          className={editor.isActive("italic") ? activeButtonClass : buttonClass}
        >
          Italic
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
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
          className={editor.isActive("bulletList") ? activeButtonClass : buttonClass}
        >
          Bullet List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? activeButtonClass : buttonClass}
        >
          Number List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={editor.isActive("code") ? activeButtonClass : buttonClass}
        >
          Inline Code
        </button>

        <button
          type="button"
          onClick={makeCurrentLineCodeBlock}
          className={editor.isActive("codeBlock") ? activeButtonClass : buttonClass}
        >
          Code Block
        </button>

        <label className={buttonClass}>
          {uploadingInlineImage ? "Uploading..." : "Insert Image"}
          <input
            type="file"
            accept="image/*"
            disabled={uploadingInlineImage}
            onChange={(e) => {
              insertUploadedImage(e.target.files?.[0]);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>

        <button type="button" onClick={insertImageUrl} className={buttonClass}>
          Image URL
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className={buttonClass}
        >
          Clear
        </button>
      </div>

      <EditorContent editor={editor} />

      <p className="mt-2 text-xs text-emerald-300/60">
        Tip: Code Block now only converts the current line and puts your cursor back in normal text underneath it.
      </p>
    </div>
  );
}

function splitImageUrls(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}


function getAuthorName(guide: TrojanGuide) {
  return guide.author_name || "Unknown operator";
}

function formatLastUpdated(value?: string | null) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function difficultyClass(difficulty?: string | null) {
  const clean = (difficulty || "Normal").toLowerCase();

  if (clean.includes("easy")) return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  if (clean.includes("hard")) return "border-red-400/30 bg-red-500/15 text-red-200";
  if (clean.includes("expert")) return "border-orange-400/30 bg-orange-500/15 text-orange-200";

  return "border-cyan-400/30 bg-cyan-500/15 text-cyan-200";
}

export default function TrojanGuides({
  initialGuides,
  isAdmin,
}: {
  initialGuides: TrojanGuide[];
  isAdmin: boolean;
}) {
  const supabase = createClient();

  const [guides, setGuides] = useState<TrojanGuide[]>(initialGuides);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState<TrojanGuide | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Hacking");
  const [difficulty, setDifficulty] = useState("Normal");
  const [shortDescription, setShortDescription] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [imageUrls, setImageUrls] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredGuides = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    if (!cleanSearch) return guides;

    return guides.filter((guide) => {
      return [
        guide.title,
        guide.category,
        guide.difficulty,
        guide.short_description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(cleanSearch);
    });
  }, [guides, search]);

  async function reloadGuides() {
    const res = await fetch("/api/trojan-guides");
    const data = await res.json();
    setGuides(Array.isArray(data) ? data : []);
  }

  function resetForm() {
    setEditingGuide(null);
    setTitle("");
    setCategory("Hacking");
    setDifficulty("Normal");
    setShortDescription("");
    setContent("");
    setCoverImage("");
    setImageUrls("");
  }

  function openAddGuide() {
    resetForm();
    setOpen(true);
  }

  function openEditGuide(guide: TrojanGuide) {
    setEditingGuide(guide);
    setTitle(guide.title);
    setCategory(guide.category || "Hacking");
    setDifficulty(guide.difficulty || "Normal");
    setShortDescription(guide.short_description || "");
    setContent(guide.content || "");
    setCoverImage(guide.cover_image || "");
    setImageUrls((guide.images || []).join("\n"));
    setOpen(true);
  }

  async function uploadImage(file: File, type: "cover" | "gallery") {
    if (type === "cover") setUploadingCover(true);
    if (type === "gallery") setUploadingImages(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;

    const { error } = await supabase.storage
      .from("trojan-guide-images")
      .upload(fileName, file);

    if (error) {
      setUploadingCover(false);
      setUploadingImages(false);
      alert(error.message);
      return;
    }

    const { data } = supabase.storage
      .from("trojan-guide-images")
      .getPublicUrl(fileName);

    if (type === "cover") {
      setCoverImage(data.publicUrl);
      setUploadingCover(false);
    } else {
      setImageUrls((prev) => [prev, data.publicUrl].filter(Boolean).join("\n"));
      setUploadingImages(false);
    }
  }

  async function uploadMultipleImages(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

      const { error } = await supabase.storage
        .from("trojan-guide-images")
        .upload(fileName, file);

      if (error) {
        setUploadingImages(false);
        alert(error.message);
        return;
      }

      const { data } = supabase.storage
        .from("trojan-guide-images")
        .getPublicUrl(fileName);

      uploadedUrls.push(data.publicUrl);
    }

    setImageUrls((prev) => [...splitImageUrls(prev), ...uploadedUrls].join("\n"));
    setUploadingImages(false);
  }

  async function uploadInlineGuideImage(file: File) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;

    const { error } = await supabase.storage
      .from("trojan-guide-images")
      .upload(fileName, file);

    if (error) {
      alert(error.message);
      return null;
    }

    const { data } = supabase.storage
      .from("trojan-guide-images")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  async function saveGuide(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) return alert("Enter a guide title");

    setSaving(true);

    const payload = {
      id: editingGuide?.id,
      title: title.trim(),
      category: category.trim() || null,
      difficulty: difficulty.trim() || null,
      short_description: shortDescription.trim() || null,
      content,
      cover_image: coverImage.trim() || null,
      images: splitImageUrls(imageUrls),
    };

    const res = await fetch("/api/trojan-guides", {
      method: editingGuide ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const json = await res.json();
      alert(json?.error || "Failed to save guide");
      return;
    }

    setOpen(false);
    resetForm();
    await reloadGuides();
  }

  async function deleteGuide(guide: TrojanGuide) {
    const confirmed = confirm(`Delete guide "${guide.title}"?`);
    if (!confirmed) return;

    setDeletingId(guide.id);

    const res = await fetch(`/api/trojan-guides?id=${guide.id}`, {
      method: "DELETE",
    });

    setDeletingId(null);

    if (!res.ok) {
      const json = await res.json();
      alert(json?.error || "Failed to delete guide");
      return;
    }

    setGuides((currentGuides) => currentGuides.filter((item) => item.id !== guide.id));
  }

  return (
    <>
      <div
        className="mb-8 overflow-hidden rounded-2xl border border-emerald-400/20 bg-black/55 shadow-[0_0_35px_rgba(16,185,129,0.10)] backdrop-blur"
      >
        <div className="flex items-center gap-2 border-b border-emerald-400/20 bg-emerald-950/25 px-5 py-3"><span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-yellow-300" /><span className="h-3 w-3 rounded-full bg-emerald-400" /><span className="ml-3 font-mono text-xs text-emerald-300/80">library@trojan:~/guides</span></div><div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-mono text-2xl font-black text-white">./guide-library</h2>
            <p className="mt-1 text-gray-300">
              Select a guide card to open the full terminal-style tutorial.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search --guides"
              className="w-full rounded-xl border border-emerald-400/20 bg-black/50 px-4 py-3 font-mono text-emerald-100 outline-none placeholder:text-emerald-700 sm:w-72"
            />

            {isAdmin ? (
              <button
                onClick={openAddGuide}
                className="rounded-xl border border-emerald-300/30 bg-emerald-500 px-5 py-3 font-mono font-bold text-black shadow-[0_0_18px_rgba(16,185,129,0.24)] hover:bg-emerald-400"
              >
                + Add Guide
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {filteredGuides.length === 0 ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-black/45 p-8 text-center font-mono text-emerald-200/70">
          No Trojan guides found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredGuides.map((guide) => (
            <div
              key={guide.id}
              className="group overflow-hidden rounded-2xl border border-emerald-400/20 bg-black/50 shadow-[0_0_28px_rgba(16,185,129,0.08)] transition hover:-translate-y-1 hover:border-emerald-300/40 hover:bg-emerald-500/5 hover:shadow-[0_0_35px_rgba(16,185,129,0.18)]"
            >
              <Link href={`/trojan/${guide.id}`} className="block">
                {guide.cover_image ? (
                  <img
                    src={guide.cover_image}
                    alt={guide.title}
                    className="h-44 w-full object-cover opacity-90 transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center bg-[#020617] font-mono text-5xl text-emerald-400">
                    &gt;_
                  </div>
                )}

                <div className="p-5">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {guide.category ? (
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-200">
                        {guide.category}
                      </span>
                    ) : null}

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${difficultyClass(
                        guide.difficulty,
                      )}`}
                    >
                      {guide.difficulty || "Normal"}
                    </span>
                  </div>

                  <h3 className="line-clamp-2 font-mono text-xl font-black text-white">
                    {guide.title}
                  </h3>

                  {guide.short_description ? (
                    <p className="mt-2 line-clamp-3 text-sm text-emerald-100/70">
                      {guide.short_description}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-black/45 px-3 py-2 font-mono text-xs text-emerald-300/75">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                      <span className="text-emerald-500/80">LAST UPDATED</span>
                      <span>{formatLastUpdated(guide.updated_at || guide.created_at)}</span>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-black/45 px-3 py-2 font-mono text-xs text-cyan-200/85">
                      {guide.author_avatar_url ? (
                        <img
                          src={guide.author_avatar_url}
                          alt={getAuthorName(guide)}
                          className="h-5 w-5 rounded-full border border-cyan-300/30 object-cover"
                        />
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/10 text-[10px]">
                          @
                        </span>
                      )}
                      <span className="text-cyan-400/80">AUTHOR</span>
                      <span className="truncate">{getAuthorName(guide)}</span>
                    </div>
                  </div>
                </div>
              </Link>

              {isAdmin ? (
                <div className="flex gap-2 border-t border-emerald-400/20 bg-black/25 p-4">
                  <button
                    onClick={() => openEditGuide(guide)}
                    className="w-full rounded-xl border border-emerald-400/20 px-4 py-2 font-mono text-sm font-semibold text-emerald-100 hover:bg-emerald-500/10"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteGuide(guide)}
                    disabled={deletingId === guide.id}
                    className="w-full rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {deletingId === guide.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/90 p-2 pt-4 sm:p-4 sm:pt-6 lg:p-6 lg:pt-8">
          <div className="relative flex h-[calc(100vh-2rem)] w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl border border-emerald-400/20 bg-[#020617] text-emerald-50 shadow-2xl sm:h-[calc(100vh-3rem)] lg:h-[calc(100vh-4rem)]">
            <div className="sticky top-0 z-40 flex shrink-0 items-center justify-between gap-4 border-b border-emerald-400/20 bg-[#020617] px-5 py-4 lg:px-7">
              <div>
                <h2 className="font-mono text-2xl font-black text-white">
                  {editingGuide ? "Edit Trojan Guide" : "Add Trojan Guide"}
                </h2>
                <p className="mt-1 text-sm text-emerald-300/60">
                  Fullscreen editor mode. The toolbar stays sticky while you write long guides with screenshots and command blocks.
                </p>
              </div>

              <button
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="rounded-xl border border-white/10 px-4 py-2 text-white/70 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveGuide} className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 pt-6 lg:px-7">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px_180px]">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Guide title"
                  className="w-full rounded-xl border border-emerald-400/20 bg-black/50 px-4 py-3 text-emerald-100 outline-none placeholder:text-emerald-700"
                />

                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category"
                  className="w-full rounded-xl border border-emerald-400/20 bg-black/50 px-4 py-3 text-emerald-100 outline-none placeholder:text-emerald-700"
                />

                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-xl border border-emerald-400/20 bg-black/70 px-4 py-3 text-emerald-100 outline-none"
                >
                  <option value="Easy">Easy</option>
                  <option value="Normal">Normal</option>
                  <option value="Hard">Hard</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>

              <textarea
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Short description shown on the guide card"
                rows={3}
                className="w-full rounded-xl border border-emerald-400/20 bg-black/50 px-4 py-3 text-emerald-100 outline-none placeholder:text-emerald-700"
              />

              <div className="space-y-2 rounded-xl border border-emerald-400/20 bg-black/40 p-4">
                <label className="block text-sm font-semibold text-emerald-100">
                  Cover image for the guide card
                </label>

                <input
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="Paste image URL or upload below"
                  className="w-full rounded-xl border border-emerald-400/20 bg-black/50 px-4 py-3 text-emerald-100 outline-none placeholder:text-emerald-700"
                />

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file, "cover");
                  }}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:font-semibold file:text-black hover:file:bg-emerald-400"
                />

                {uploadingCover ? <p className="text-sm text-emerald-300/60">Uploading cover...</p> : null}
                {coverImage ? (
                  <img src={coverImage} alt="Cover preview" className="h-36 w-full rounded-xl object-cover" />
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-emerald-100">
                  Guide content
                </label>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  onUploadImage={uploadInlineGuideImage}
                />
              </div>

              <div className="space-y-2 rounded-xl border border-emerald-400/20 bg-black/40 p-4">
                <label className="block text-sm font-semibold text-emerald-100">
                  Optional gallery images at bottom
                </label>

                <textarea
                  value={imageUrls}
                  onChange={(e) => setImageUrls(e.target.value)}
                  placeholder="Optional: one image URL per line, or upload below. For images inside the guide text, use Insert Image in the editor above."
                  rows={4}
                  className="w-full rounded-xl border border-emerald-400/20 bg-black/50 px-4 py-3 text-emerald-100 outline-none placeholder:text-emerald-700"
                />

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => uploadMultipleImages(e.target.files)}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:font-semibold file:text-black hover:file:bg-emerald-400"
                />

                {uploadingImages ? <p className="text-sm text-emerald-300/60">Uploading images...</p> : null}
              </div>

              <div className="sticky bottom-0 z-30 -mx-5 -mb-5 flex flex-col gap-3 border-t border-emerald-400/20 bg-[#020617] px-5 py-4 sm:flex-row lg:-mx-7 lg:-mb-5 lg:px-7">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  className="w-full rounded-xl border border-emerald-400/20 px-4 py-3 font-mono font-semibold hover:bg-emerald-500/10"
                >
                  Cancel
                </button>

                <button
                  disabled={saving || uploadingCover || uploadingImages}
                  className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-mono font-bold text-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingGuide ? "Save Changes" : "Create Guide"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
