"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject, type ReactNode } from "react";
import { formatDiscordText, insertDiscordLink, type FormatKind, type TextSelection } from "@/lib/discord-formatting";
import { useTranslation } from "./LanguageProvider";
import styles from "./DiscordDashboard.module.css";

type Props = { value: string; onChange: (value: string) => void; onSubmit?: () => void; disabled?: boolean; inputRef?: RefObject<HTMLTextAreaElement | null>; label?: string };
const emojis = ["😀", "😂", "😎", "🤔", "👀", "❤️", "🔥", "🎉", "✅", "❌", "⚠️", "📢", "📌", "💰", "💎", "🎮", "🏆", "🚗", "👋", "👍", "🙏", "💪", "✨", "🕒"];

function EyeOff() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.8 5.2c.7-.1 1.4-.2 2.2-.2 6 0 10 7 10 7a17 17 0 0 1-3 3.6M6.3 6.3C3.6 8.3 2 12 2 12s4 7 10 7c1.6 0 3.1-.5 4.4-1.2" /></svg>; }

export default function DiscordMessageEditor({ value, onChange, onSubmit, disabled, inputRef, label = "Message content" }: Props) {
  const { t, locale } = useTranslation();
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef || ownRef;
  const selection = useRef({ start: 0, end: 0 });
  const pendingSelection = useRef<TextSelection | null>(null);
  const history = useRef<{ past: TextSelection[]; future: TextSelection[]; value: string; lastTyping: number }>({ past: [], future: [], value, lastTyping: 0 });
  const [revision, setRevision] = useState(0);
  const [panel, setPanel] = useState<"link" | "emoji" | null>(null);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState("");
  const linkInput = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const next = pendingSelection.current;
    if (next && next.text === value) {
      pendingSelection.current = null;
      ref.current?.focus(); ref.current?.setSelectionRange(next.start, next.end);
      selection.current = { start: next.start, end: next.end };
    }
  }, [value, ref]);
  useEffect(() => {
    if (history.current.value !== value) { history.current = { past: [], future: [], value, lastTyping: 0 }; setRevision(count => count + 1); }
  }, [value]);
  useEffect(() => { if (panel === "link") linkInput.current?.focus(); }, [panel]);
  function range() { return { start: ref.current?.selectionStart ?? selection.current.start, end: ref.current?.selectionEnd ?? selection.current.end }; }
  function focus(result: TextSelection) {
    pendingSelection.current = result;
    selection.current = { start: result.start, end: result.end };
    ref.current?.focus(); ref.current?.setSelectionRange(result.start, result.end);
  }
  function commit(result: TextSelection, typing = false) {
    if (disabled) return;
    if (result.text.length > 2000) { setError("This formatting would exceed Discord’s 2,000-character message limit."); return; }
    const state = history.current;
    if (!typing || Date.now() - state.lastTyping > 700) state.past.push({ text: value, ...selection.current });
    if (state.past.length > 100) state.past.shift();
    state.future = []; state.value = result.text; state.lastTyping = typing ? Date.now() : 0;
    selection.current = { start: result.start, end: result.end };
    setRevision(revision + 1); setError(""); onChange(result.text);
    if (!typing) focus(result);
  }
  function undo(redo = false) {
    if (disabled) return;
    const state = history.current, from = redo ? state.future : state.past, to = redo ? state.past : state.future;
    const result = from.pop(); if (!result) return;
    to.push({ text: value, ...range() }); state.value = result.text; state.lastTyping = 0;
    setRevision(count => count + 1); setError(""); onChange(result.text); focus(result);
  }
  function format(kind: FormatKind) { const { start, end } = range(); selection.current = { start, end }; commit(formatDiscordText(value, start, end, kind, { text: t("text"), hidden: t("hidden text"), code: t("code"), codeBlock: t("your code here"), list: t("List item") })); setPanel(null); }
  function button(kind: FormatKind, title: string, icon: ReactNode, shortcut?: string) {
    return <button type="button" className={kind === "spoiler" ? styles.spoilerTool : undefined} aria-label={t(title)} data-tooltip={shortcut ? `${t(title)} · ${shortcut}` : t(title)} onMouseDown={event => event.preventDefault()} onClick={() => format(kind)}>{icon}{kind === "spoiler" && <span>{t("Spoiler")}</span>}</button>;
  }
  function openLink() {
    selection.current = range();
    setLinkLabel(value.slice(selection.current.start, selection.current.end)); setLinkUrl(""); setError(""); setPanel(panel === "link" ? null : "link");
  }
  function addLink() {
    try { const result = insertDiscordLink(value, selection.current.start, selection.current.end, linkLabel.trim() || t("link text"), linkUrl); commit(result); if (result.text.length <= 2000) setPanel(null); }
    catch { setError("Enter a valid http:// or https:// link."); }
  }
  return <fieldset disabled={disabled} className={styles.messageEditor}>
    <div className={styles.toolbar} role="group" aria-label={t("Text formatting")}>
      <div className={styles.toolGroup}>
        {button("bold", "Bold", <b>B</b>, "Ctrl+B")}{button("italic", "Italic", <i>I</i>, "Ctrl+I")}{button("underline", "Underline", <u>U</u>, "Ctrl+U")}{button("strike", "Strikethrough", <s>S</s>)}
        {button("spoiler", "Spoiler — hide text", <EyeOff />)}
      </div>
      <div className={styles.toolGroup}>
        {button("code", "Inline code", <span className={styles.codeIcon}>&lt;/&gt;</span>)}{button("codeblock", "Code block", <span className={styles.codeIcon}>[&nbsp;]</span>)}
        <button type="button" aria-label={t("Insert link")} data-tooltip={t("Insert link · Ctrl+K")} aria-expanded={panel === "link"} onMouseDown={event => event.preventDefault()} onClick={openLink}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" transform="translate(1 0) scale(.9)" /></svg></button>
        <button type="button" aria-label={t("Insert emoji")} data-tooltip={t("Insert emoji")} aria-expanded={panel === "emoji"} onMouseDown={event => event.preventDefault()} onClick={() => { selection.current = range(); setPanel(panel === "emoji" ? null : "emoji"); }}>☺</button>
      </div>
      <div className={styles.toolGroup}>
        <select className={styles.paragraphSelect} aria-label={t("Paragraph style")} value="" onChange={event => { if (event.target.value) format(event.target.value as FormatKind); }}><option value="">{t("Text style")}</option><option value="h1">{t("Heading 1")}</option><option value="h2">{t("Heading 2")}</option><option value="h3">{t("Heading 3")}</option><option value="subtext">{t("Small text")}</option></select>
        {button("bullet", "Bullet list", <span>• ≡</span>)}{button("numbered", "Numbered list", <span>1. ≡</span>)}{button("quote", "Block quote", <span className={styles.quoteIcon}>❝</span>)}
      </div>
      <div className={`${styles.toolGroup} ${styles.undoGroup}`}>
        <button type="button" aria-label={t("Undo")} data-tooltip={t("Undo · Ctrl+Z")} disabled={disabled || !history.current.past.length} onMouseDown={event => event.preventDefault()} onClick={() => undo()}>↶</button>
        <button type="button" aria-label={t("Redo")} data-tooltip={t("Redo · Ctrl+Shift+Z")} disabled={disabled || !history.current.future.length} onMouseDown={event => event.preventDefault()} onClick={() => undo(true)}>↷</button>
      </div>
    </div>
    {panel === "link" && <div className={styles.inlinePanel} role="group" aria-label={t("Insert a text link")} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addLink(); } if (event.key === "Escape") { setPanel(null); focus({ text: value, ...selection.current }); } }}><label>{t("Link text")}<input value={linkLabel} maxLength={200} onChange={event => setLinkLabel(event.target.value)} placeholder={t("Text to display")} /></label><label>URL<input ref={linkInput} value={linkUrl} maxLength={2048} onChange={event => setLinkUrl(event.target.value)} placeholder="https://example.com" type="url" /></label><button type="button" className={styles.secondary} onClick={addLink}>{t("Add link")}</button><button type="button" className={styles.textButton} aria-label={t("Close link editor")} onClick={() => setPanel(null)}>×</button></div>}
    {panel === "emoji" && <div className={styles.emojiPanel} role="group" aria-label={t("Emoji picker")} onKeyDown={event => { if (event.key === "Escape") { setPanel(null); focus({ text: value, ...selection.current }); } }}>{emojis.map(emoji => <button type="button" key={emoji} aria-label={t("Insert {emoji}", { emoji })} onClick={() => { const { start, end } = selection.current; commit({ text: value.slice(0, start) + emoji + value.slice(end), start: start + emoji.length, end: start + emoji.length }); setPanel(null); }}>{emoji}</button>)}</div>}
    <textarea ref={ref} disabled={disabled} className={styles.composer} aria-label={t(label)} placeholder={t("What would you like to say?")} maxLength={2000} value={value}
      onSelect={() => { selection.current = range(); }}
      onChange={event => commit({ text: event.target.value, start: event.target.selectionStart, end: event.target.selectionEnd }, true)}
      onKeyDown={event => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
        const key = event.key.toLowerCase();
        if (key === "enter" && onSubmit) { event.preventDefault(); onSubmit(); }
        if (key === "b" || key === "i" || key === "u") { event.preventDefault(); format(({ b: "bold", i: "italic", u: "underline" } as const)[key]); }
        if (key === "k") { event.preventDefault(); openLink(); }
        if (key === "z" || key === "y") { event.preventDefault(); undo(key === "y" || event.shiftKey); }
      }} />
    <div className={styles.editorFooter}><span>{t("Select text to format · No selection? Spoiler hides the whole message.")}</span><span>{value.length.toLocaleString(locale)} / {(2000).toLocaleString(locale)}</span></div>
    {error && <p className={styles.formatError} role="alert">{t(error)}</p>}
  </fieldset>;
}
