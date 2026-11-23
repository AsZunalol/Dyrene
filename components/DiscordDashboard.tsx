"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DiscordMessageEditor from "./DiscordMessageEditor";
import DiscordMessagePreview from "./DiscordMessagePreview";
import { DASHBOARD_GUILDS, MAX_ATTACHMENT_BYTES, emptyDraft, type MessageDraft, type DashboardSnapshot, type DashboardMessage } from "@/lib/discord-dashboard-types";
import { useTranslation } from "./LanguageProvider";
import styles from "./DiscordDashboard.module.css";

type Template = { id: string; name: string; draft: MessageDraft };
type Notice = { text: string; values?: Record<string, string | number>; error?: boolean; url?: string };

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, credentials: "same-origin", cache: "no-store" });
  if (response.status === 401) { window.location.assign("/login"); throw new Error("Sign in to continue."); }
  let result;
  try { result = await response.json(); } catch { throw new Error("The website could not complete the request. Your draft has been kept."); }
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}
function post<T>(payload: object, files: File[] = []) {
  if (files.length) {
    const body = new FormData(); body.set("payload", JSON.stringify(payload));
    files.forEach(file => body.append("files", file, file.name));
    return api<T>("/api/admin/bot", { method: "POST", body });
  }
  return api<T>("/api/admin/bot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
function restoreDraft(value: Partial<MessageDraft>): MessageDraft {
  const blank = emptyDraft();
  return { content: typeof value?.content === "string" ? value.content : "", allowEveryone: value?.allowEveryone === true,
    embed: Object.fromEntries(Object.entries(blank.embed).map(([key, fallback]) => [key, typeof value?.embed?.[key as keyof MessageDraft["embed"]] === "string" ? value.embed[key as keyof MessageDraft["embed"]] : fallback])) as MessageDraft["embed"],
    links: Array.isArray(value?.links) ? value.links.filter(link => typeof link?.label === "string" && typeof link?.url === "string").slice(0, 5) : [],
  };
}
const formatted = (text: string, names: Record<string, string> = {}) => <DiscordMessagePreview text={text} names={names} />;

export default function DiscordDashboard({ userId }: { userId: string }) {
  const { t, locale } = useTranslation();
  const [guildId, setGuildId] = useState<string>(DASHBOARD_GUILDS[0].id);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [channelId, setChannelId] = useState("");
  const [tab, setTab] = useState("compose");
  const [draft, setDraft] = useState<MessageDraft>(emptyDraft);
  const [files, setFiles] = useState<File[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [before, setBefore] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [lookup, setLookup] = useState("");
  const [editing, setEditing] = useState<DashboardMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [deleting, setDeleting] = useState<DashboardMessage | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [memberStatus, setMemberStatus] = useState("");
  const textArea = useRef<HTMLTextAreaElement>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const historyVersion = useRef(0);
  const sendAttempt = useRef<{ signature: string; nonce: string } | null>(null);
  const key = `discord-dashboard:${userId}`;
  const selectedChannel = snapshot?.channels.find(channel => channel.id === channelId);
  const guild = DASHBOARD_GUILDS.find(item => item.id === guildId)!;
  const errorNotice = (error: unknown) => setNotice({ error: true, text: error instanceof Error ? error.message : "The request could not be completed." });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.draft) setDraft(restoreDraft(data.draft));
        if (Array.isArray(data.templates)) setTemplates(data.templates.filter((item: Template) => typeof item?.id === "string" && typeof item?.name === "string" && item.draft).slice(0, 100).map((item: Template) => ({ ...item, draft: restoreDraft(item.draft) })));
      }
    } catch { setStorageFailed(true); }
    setStorageReady(true);
  }, [key]);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem(key, JSON.stringify({ draft, templates })); }
    catch { setStorageFailed(true); }
  }, [draft, templates, key, storageReady]);

  const loadSnapshot = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true); setSnapshot(null);
    try {
      const result = await api<DashboardSnapshot>(`/api/admin/bot?guildId=${guildId}`);
      if (version !== generation.current) return;
      setSnapshot(result);
      setChannelId(current => result.channels.some(channel => channel.id === current) ? current : "");
    } catch (error) { if (version === generation.current) errorNotice(error); }
    finally { if (version === generation.current) setLoading(false); }
  }, [guildId]);
  useEffect(() => { void loadSnapshot(); return () => { generation.current++; }; }, [loadSnapshot]);

  useEffect(() => {
    historyVersion.current++;
    setMessages([]); setBefore(null); setHistoryLoaded(false); setHistoryLoading(false);
    setEditing(null); setDeleting(null); setLookup("");
  }, [guildId, channelId]);
  useEffect(() => {
    let cancelled = false;
    setMembers([]); setMemberStatus("");
    if (mentionQuery.trim().length < 2) return;
    const timer = setTimeout(async () => {
      setMemberStatus("Searching…");
      try {
        const result = await post<{ members: typeof members }>({ action: "members", guildId, query: mentionQuery });
        if (!cancelled) { setMembers(result.members); setMemberStatus(result.members.length ? "" : "No members found."); }
      } catch (error) { if (!cancelled) setMemberStatus(error instanceof Error ? error.message : "Could not search members."); }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mentionQuery, guildId]);

  function changeGuild(value: string) {
    generation.current++; historyVersion.current++;
    setGuildId(value); setChannelId(""); setSnapshot(null); setLoading(true); setNotice(null); setMentionQuery(""); setMembers([]);
    setDraft(current => ({ ...current, allowEveryone: false }));
  }
  function insert(beforeText: string, afterText = "") {
    const element = textArea.current;
    const start = element?.selectionStart ?? draft.content.length, end = element?.selectionEnd ?? start;
    const selected = draft.content.slice(start, end) || (afterText ? "text" : "");
    const content = draft.content.slice(0, start) + beforeText + selected + afterText + draft.content.slice(end);
    if (content.length > 2000) return;
    setDraft(current => ({ ...current, content }));
    requestAnimationFrame(() => { element?.focus(); element?.setSelectionRange(start + beforeText.length, start + beforeText.length + selected.length); });
  }
  function attach(incoming: File[]) {
    const next = [...files, ...incoming];
    if (next.length > 10 || next.reduce((size, file) => size + file.size, 0) > MAX_ATTACHMENT_BYTES) { setNotice({ error: true, text: "Choose up to ten attachments, with a combined size of 4 MB." }); return; }
    if (next.some(file => file.size === 0)) { setNotice({ error: true, text: "Empty files cannot be attached." }); return; }
    sendAttempt.current = null; setFiles(next);
  }
  async function send() {
    if (locked.current || !selectedChannel?.canSend || loading) return;
    if (draft.allowEveryone && /@(everyone|here)\b/.test(draft.content) && !window.confirm(t("Notify everyone mentioned in #{channel} on {server}?", { channel: selectedChannel.name, server: snapshot?.guild.name || guild.name }))) return;
    locked.current = true; setBusy(true); setNotice(null);
    const signature = JSON.stringify({ guildId, channelId, draft, files: files.map(file => [file.name, file.size, file.lastModified]) });
    if (sendAttempt.current?.signature !== signature) sendAttempt.current = { signature, nonce: crypto.randomUUID().replaceAll("-", "") };
    try {
      const result = await post<{ message: DashboardMessage }>({ action: "send", guildId, channelId, draft, nonce: sendAttempt.current!.nonce }, files);
      setNotice({ text: "Message sent to #{channel} in {server}.", values: { channel: selectedChannel.name, server: snapshot?.guild.name || guild.name }, url: result.message.url });
      setDraft(emptyDraft()); setFiles([]); sendAttempt.current = null;
      historyVersion.current++; setHistoryLoaded(false); setMessages([]); setBefore(null);
    } catch (error) { errorNotice(error); }
    finally { locked.current = false; setBusy(false); }
  }
  async function history(older = false) {
    if (!channelId || historyLoading || busy) return;
    const version = ++historyVersion.current;
    setHistoryLoading(true); setNotice(null);
    try {
      const result = await post<{ messages: DashboardMessage[]; before: string | null }>({ action: "history", guildId, channelId, ...(older && before ? { before } : {}) });
      if (version !== historyVersion.current) return;
      setMessages(current => older ? [...current, ...result.messages.filter(message => !current.some(row => row.id === message.id))] : result.messages);
      setBefore(result.before); setHistoryLoaded(true);
    } catch (error) { if (version === historyVersion.current) errorNotice(error); }
    finally { if (version === historyVersion.current) setHistoryLoading(false); }
  }
  async function findMessage() {
    if (locked.current || !channelId) return;
    const match = lookup.trim().match(/^https:\/\/(?:www\.)?discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)$/);
    const messageId = /^\d{15,20}$/.test(lookup.trim()) ? lookup.trim() : match?.[3];
    if (!messageId || (match && (match[1] !== guildId || match[2] !== channelId))) { setNotice({ error: true, text: "Paste a message ID or a Discord link from the selected server and channel." }); return; }
    locked.current = true; setBusy(true); setNotice(null);
    try {
      const result = await post<{ message: DashboardMessage }>({ action: "message", guildId, channelId, messageId });
      setMessages(current => [result.message, ...current.filter(message => message.id !== result.message.id)]);
      setHistoryLoaded(true);
    } catch (error) { errorNotice(error); }
    finally { locked.current = false; setBusy(false); }
  }
  async function modify(action: "edit" | "delete", message: DashboardMessage) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setNotice(null);
    try {
      const result = await post<{ message?: DashboardMessage }>({ action, guildId, channelId: message.channelId, messageId: message.id, ...(action === "edit" ? { content: editText } : {}) });
      historyVersion.current++; setHistoryLoading(false);
      setMessages(current => action === "delete" ? current.filter(row => row.id !== message.id) : current.map(row => row.id === message.id ? result.message! : row));
      setEditing(null); setDeleting(null);
      setNotice({ text: action === "edit" ? "Message updated. Embeds and attachments were preserved." : "Message deleted." });
    } catch (error) { errorNotice(error); }
    finally { locked.current = false; setBusy(false); }
  }
  function saveTemplate() {
    if (!templateName.trim()) return;
    if (templates.length >= 100 && !templates.some(item => item.name === templateName.trim())) { setNotice({ error: true, text: "Remove a template before adding another (100 maximum)." }); return; }
    const existing = templates.find(item => item.name === templateName.trim());
    if (existing && !window.confirm(t("Replace the template “{name}”?", { name: existing.name }))) return;
    setTemplates(current => [{ id: existing?.id || crypto.randomUUID(), name: templateName.trim(), draft: structuredClone(draft) }, ...current.filter(item => item.id !== existing?.id)]);
    setTemplateName(""); setNotice({ text: "Template saved in this browser. Attachments are added separately when sending." });
  }
  const names = Object.fromEntries([...(snapshot?.roles || []), ...members].map(item => [item.id, item.name]));
  const hasEmbed = Object.entries(draft.embed).some(([key, value]) => key !== "color" && key !== "url" && value);
  const hasContent = !!draft.content.trim() || hasEmbed || files.length > 0 || draft.links.length > 0;
  const setEmbed = (key: keyof MessageDraft["embed"], value: string) => setDraft(current => ({ ...current, embed: { ...current.embed, [key]: value } }));

  return <div className={styles.dashboard}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>DISCORD / ADMIN</span><h1>{t("Messages")}</h1><p>{t("Write something worth sharing.")}</p></div>
      <div className={styles.identity}><span className={styles.avatar}>{snapshot?.bot.avatar ? <img src={snapshot.bot.avatar} alt="" /> : "S"}</span><div><strong>{snapshot?.bot.name || t("Discord bot")}</strong><span>{loading ? t("Loading channels…") : snapshot ? t("Ready to send") : t("Connection unavailable")}</span></div></div>
    </header>
    <div className={styles.destination}>
      <label>{t("Server")}<select aria-label={t("Server")} value={guildId} disabled={busy} onChange={event => changeGuild(event.target.value)}>{DASHBOARD_GUILDS.map(item => <option key={item.id} value={item.id}>{item.name}{"testing" in item ? t(" · Testing") : ""}</option>)}</select></label>
      <label>{t("Channel")}<select aria-label={t("Channel")} value={channelId} disabled={loading || !snapshot || busy} onChange={event => { historyVersion.current++; setChannelId(event.target.value); setNotice(null); }}>
        <option value="">{loading ? t("Loading channels…") : t("Choose a channel")}</option>
        {snapshot?.channels.map(channel => <option key={channel.id} value={channel.id}>#{channel.name}{channel.category ? ` · ${channel.category}` : ""}{!channel.canSend ? t(" (read only)") : ""}</option>)}
      </select></label>
      <button className={styles.secondary} onClick={() => void loadSnapshot()} disabled={loading || busy}>{t("Refresh channels")}</button>
      {"testing" in guild && <span className={styles.testing}>{t("Test server")}</span>}
    </div>
    <nav className={styles.tabs} aria-label={t("Message tools")}>{[["compose", "Compose"], ["history", "Recent messages"], ["templates", "Templates"]].map(([value, label]) => <button key={value} aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>{t(label)}{value === "templates" && templates.length > 0 && <span>{templates.length}</span>}</button>)}</nav>
    {notice && <div className={notice.error ? styles.error : styles.notice} role={notice.error ? "alert" : "status"}><span>{t(notice.text, notice.values)} {notice.url && <a href={notice.url} target="_blank" rel="noopener noreferrer">{t("View in Discord")}</a>}</span><button aria-label={t("Dismiss notification")} onClick={() => setNotice(null)}>×</button></div>}
    {storageFailed && <p className={styles.error}>{t("Browser storage is unavailable. Keep this tab open to retain your draft and templates.")}</p>}

    {tab === "compose" && <div className={styles.columns}>
      <section className={styles.panel} aria-label={t("Message composer")}><div className={styles.panelTitle}><h2>{t("New message")}</h2><span>{storageFailed ? t("Unsaved draft") : t("Draft saved in this browser")}</span></div>
        <fieldset disabled={busy} className={styles.editorFields}>
          <DiscordMessageEditor inputRef={textArea} value={draft.content} disabled={busy} onChange={content => setDraft(current => ({ ...current, content }))} onSubmit={() => void send()} />
          <details className={styles.details}><summary>{t("Mention a member or role")}</summary><div className={styles.detailsBody}>
            <label>{t("Find a member")}<input value={mentionQuery} onChange={event => setMentionQuery(event.target.value)} placeholder={t("Type at least two characters")} maxLength={80} /></label>
            {memberStatus && <p className={styles.help}>{t(memberStatus)}</p>}
            <div className={styles.chips}>{members.map(member => <button key={member.id} onClick={() => insert(`<@${member.id}> `)}>@{member.name}</button>)}</div>
            <label>{t("Mention a role")}<select aria-label={t("Mention a role")} value="" onChange={event => { if (event.target.value) insert(`<@&${event.target.value}> `); }}><option value="">{t("Choose a role")}</option>{snapshot?.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          </div></details>
          <details className={styles.details}><summary>{t("Embed & link buttons")}</summary><div className={styles.detailsBody}>
            <div className={styles.embedHeading}><label>{t("Embed title")}<input maxLength={256} value={draft.embed.title} onChange={event => setEmbed("title", event.target.value)} placeholder={t("Announcement title")} /></label><label>{t("Color")}<input type="color" value={draft.embed.color} onChange={event => setEmbed("color", event.target.value)} /></label></div>
            <label>{t("Description")}<textarea rows={5} maxLength={4096} value={draft.embed.description} onChange={event => setEmbed("description", event.target.value)} placeholder={t("Add more detail…")} /></label>
            <div className={styles.twoFields}><label>{t("Image URL")}<input type="url" value={draft.embed.image} onChange={event => setEmbed("image", event.target.value)} placeholder="https://…" /></label><label>{t("Thumbnail URL")}<input type="url" value={draft.embed.thumbnail} onChange={event => setEmbed("thumbnail", event.target.value)} placeholder="https://…" /></label></div>
            <label>{t("Title link")}<input type="url" value={draft.embed.url} onChange={event => setEmbed("url", event.target.value)} placeholder="https://…" /></label>
            <label>{t("Footer")}<input maxLength={2048} value={draft.embed.footer} onChange={event => setEmbed("footer", event.target.value)} placeholder={t("Optional footer")} /></label>
            {draft.links.map((link, index) => <div className={styles.linkRow} key={index}><label>{t("Button label")}<input maxLength={80} value={link.label} onChange={event => setDraft(current => ({ ...current, links: current.links.map((item, i) => i === index ? { ...item, label: event.target.value } : item) }))} /></label><label>{t("Button URL")}<input type="url" value={link.url} onChange={event => setDraft(current => ({ ...current, links: current.links.map((item, i) => i === index ? { ...item, url: event.target.value } : item) }))} /></label><button className={styles.textButton} aria-label={t("Remove link {number}", { number: index + 1 })} onClick={() => setDraft(current => ({ ...current, links: current.links.filter((_, i) => i !== index) }))}>×</button></div>)}
            <button className={styles.secondary} disabled={draft.links.length >= 5 || busy} onClick={() => setDraft(current => ({ ...current, links: [...current.links, { label: "", url: "" }] }))}>{t("Add link button")}</button>
          </div></details>
          <div className={styles.attachments}><label className={styles.fileButton}>{t("Attach files")}<input type="file" multiple aria-label={t("Attach files")} onChange={event => { attach(Array.from(event.target.files || [])); event.target.value = ""; }} /></label><span>{t("Up to 10 files · 4 MB total")}</span></div>
          {files.length > 0 && <ul className={styles.fileList}>{files.map((file, index) => <li key={index}><span>{file.name} <small>{Math.ceil(file.size / 1000)} {t("KB")}</small></span><button aria-label={t("Remove {name}", { name: file.name })} onClick={() => { sendAttempt.current = null; setFiles(current => current.filter((_, i) => i !== index)); }}>×</button></li>)}</ul>}
          <label className={styles.checkbox}><input type="checkbox" checked={draft.allowEveryone} onChange={event => setDraft(current => ({ ...current, allowEveryone: event.target.checked }))} />{t("Allow @everyone and @here notifications")}</label>
          <div className={styles.sendRow}><button className={styles.textButton} onClick={() => { if (window.confirm(t("Clear this draft and its attachments?"))) { setDraft(emptyDraft()); setFiles([]); sendAttempt.current = null; } }}>{t("Clear draft")}</button><div><span>{selectedChannel ? t("To #{channel}", { channel: selectedChannel.name }) : t("Choose a channel to send")}</span><button className={styles.primary} disabled={busy || loading || !selectedChannel?.canSend || !hasContent} onClick={() => void send()}>{busy ? t("Sending…") : t("Send message")}</button></div></div>
        </fieldset>
        <details className={styles.details}><summary>{t("Save as a template")}</summary><div className={styles.templateSave}><input aria-label={t("Template name")} placeholder={t("Template name")} maxLength={80} value={templateName} onChange={event => setTemplateName(event.target.value)} /><button className={styles.secondary} disabled={!templateName.trim() || !hasContent || busy || !storageReady} onClick={saveTemplate}>{t("Save template")}</button></div><p className={styles.help}>{t("Templates stay in this browser. Files are attached separately.")}</p></details>
      </section>
      <aside className={styles.previewColumn}><section className={styles.panel}><div className={styles.panelTitle}><h2>{t("Live preview")}</h2><span>DISCORD</span></div><div className={styles.previewChannel}># {selectedChannel?.name || t("choose-a-channel")}</div><div className={styles.previewMessage}><span className={styles.avatar}>{snapshot?.bot.avatar ? <img src={snapshot.bot.avatar} alt="" /> : "S"}</span><div className={styles.previewContent}><div className={styles.author}><strong>{snapshot?.bot.name || t("Your bot")}</strong><span>APP</span><small>{t("Today")}</small></div><div className={styles.messageText}>{draft.content ? formatted(draft.content, names) : !hasEmbed && !files.length && !draft.links.length ? <span className={styles.placeholder}>{t("Your message will appear here.")}</span> : null}</div>
        {hasEmbed && <div className={styles.embed} style={{ borderLeftColor: draft.embed.color }}><strong>{draft.embed.title}</strong><div className={styles.messageText}>{formatted(draft.embed.description, names)}</div>{draft.embed.image && <p className={styles.imageHint}>{t("Image:")} {draft.embed.image}</p>}{draft.embed.thumbnail && <p className={styles.imageHint}>{t("Thumbnail:")} {draft.embed.thumbnail}</p>}<small>{draft.embed.footer}</small></div>}
        <div className={styles.chips}>{draft.links.map((link, index) => <span key={index}>{link.label || t("Link button")}</span>)}</div>
        {files.map((file, index) => <div className={styles.previewFile} key={index}>{file.name}</div>)}
      </div></div><p className={styles.previewNote}>{t("Approximate preview. Discord applies the final formatting.")}</p></section></aside>
    </div>}

    {tab === "history" && <section className={styles.panel} aria-label={t("Recent messages")}><div className={styles.panelTitle}><div><h2>{t("Recent bot messages")}</h2><p>{t("Read directly from the selected Discord channel.")}</p></div><button className={styles.secondary} disabled={!selectedChannel?.canRead || historyLoading || busy} onClick={() => void history()}>{historyLoading ? t("Loading…") : historyLoaded ? t("Refresh messages") : t("Load messages")}</button></div>
      <div className={styles.lookup}><input aria-label={t("Message link or ID")} value={lookup} onChange={event => setLookup(event.target.value)} placeholder={t("Find an older message by its Discord link or ID")} /><button className={styles.secondary} disabled={!channelId || !lookup.trim() || busy || historyLoading} onClick={() => void findMessage()}>{t("Find message")}</button></div>
      {!messages.length && <div className={styles.empty}><span>≡</span><h3>{!channelId ? t("Choose a channel") : historyLoading ? t("Loading messages…") : historyLoaded ? t("No bot messages in this batch") : t("Your messages, in one place")}</h3><p>{!channelId ? t("Select a server and channel above to browse its messages.") : historyLoaded ? t("Load older messages or paste a message link to find a specific post.") : t("Load the latest messages to edit text, delete a post, or open it in Discord.")}</p></div>}
      <div className={styles.historyList}>{messages.map(message => <article className={styles.historyItem} key={message.id}><div className={styles.historyMeta}><time>{new Date(message.timestamp).toLocaleString(locale)}</time><a href={message.url} target="_blank" rel="noopener noreferrer">{t("Open in Discord")}</a></div><div className={styles.messageText}>{formatted(message.content, names)}</div>{message.embeds.map((embed, index) => <div className={styles.embed} key={index}><strong>{embed.title}</strong><div className={styles.messageText}>{embed.description}</div></div>)}{message.attachments.map(file => <a className={styles.attachmentLink} key={file.id} href={file.url} target="_blank" rel="noopener noreferrer">{file.name}</a>)}<div className={styles.historyActions}>{message.manageable ? <><button className={styles.secondary} disabled={busy || historyLoading} onClick={() => { setEditing(message); setEditText(message.content); }}>{t("Edit text")}</button><button className={styles.danger} disabled={busy || historyLoading} onClick={() => setDeleting(message)}>{t("Delete")}</button></> : <span>{t("Interactive post · manage in the desktop app")}</span>}</div></article>)}</div>
      {before && <div className={styles.loadMore}><button className={styles.secondary} disabled={historyLoading || busy} onClick={() => void history(true)}>{historyLoading ? t("Loading…") : t("Load older messages")}</button></div>}
    </section>}

    {tab === "templates" && <section className={styles.panel}><div className={styles.panelTitle}><div><h2>{t("Your templates")}</h2><p>{t("Saved in this browser for your account. Desktop templates are separate.")}</p></div><button className={styles.secondary} onClick={() => setTab("compose")}>{t("New message")}</button></div>{!templates.length ? <div className={styles.empty}><span>▤</span><h3>{t("Keep your best messages handy")}</h3><p>{t("Write a message, then use “Save as a template” below the composer.")}</p></div> : <div className={styles.templateGrid}>{templates.map(template => <article className={styles.templateCard} key={template.id}><h3>{template.name}</h3><p>{template.draft.content || template.draft.embed.title || t("Embed and link template")}</p><div><button className={styles.secondary} disabled={busy} onClick={() => { if ((hasContent || files.length) && !window.confirm(t("Replace your current draft with this template?"))) return; setDraft(structuredClone(template.draft)); setFiles([]); sendAttempt.current = null; setTab("compose"); }}>{t("Use template")}</button><button className={styles.textButton} aria-label={t("Delete template {name}", { name: template.name })} onClick={() => { if (window.confirm(t("Delete the template “{name}”?", { name: template.name }))) setTemplates(current => current.filter(item => item.id !== template.id)); }}>{t("Delete")}</button></div></article>)}</div>}</section>}

    {(editing || deleting) && <div className={styles.modalBackdrop}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="message-dialog-title" onKeyDown={event => { if (event.key === "Escape" && !busy) { setEditing(null); setDeleting(null); } if (event.key === "Tab") { const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled)')); const first = elements[0], last = elements.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }}><h2 id="message-dialog-title">{editing ? t("Edit message text") : t("Delete this message?")}</h2><p>{editing ? t("Embeds, link buttons and attachments will be kept. Edits will not send new mention notifications.") : t("This permanently removes the message from Discord.")}</p>{editing && <textarea autoFocus aria-label={t("Updated message text")} maxLength={2000} value={editText} disabled={busy} onChange={event => setEditText(event.target.value)} rows={7} />}<div className={styles.modalActions}><button autoFocus={!editing} className={styles.secondary} disabled={busy} onClick={() => { setEditing(null); setDeleting(null); }}>{t("Cancel")}</button><button className={deleting ? styles.danger : styles.primary} disabled={busy} onClick={() => void modify(editing ? "edit" : "delete", (editing || deleting)!)}>{busy ? t("Saving…") : editing ? t("Save changes") : t("Delete message")}</button></div>{notice?.error && <p role="alert" className={styles.error}>{t(notice.text, notice.values)}</p>}</section></div>}
  </div>;
}
