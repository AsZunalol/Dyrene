export type FormatKind = "bold" | "italic" | "underline" | "strike" | "spoiler" | "code" | "codeblock" | "quote" | "bullet" | "numbered" | "h1" | "h2" | "h3" | "subtext";
export type TextSelection = { text: string; start: number; end: number };
const inline: Partial<Record<FormatKind, string>> = { bold: "**", italic: "*", underline: "__", strike: "~~", spoiler: "||", code: "`" };
const prefixes: Partial<Record<FormatKind, string>> = { quote: "> ", bullet: "- ", h1: "# ", h2: "## ", h3: "### ", subtext: "-# " };

export function formatDiscordText(text: string, start: number, end: number, kind: FormatKind,
  placeholders = { text: "text", hidden: "hidden text", code: "code", codeBlock: "your code here", list: "List item" }): TextSelection {
  start = Math.max(0, Math.min(start, text.length)); end = Math.max(start, Math.min(end, text.length));
  if (kind === "spoiler" && start === end && text) { start = 0; end = text.length; }
  const marker = inline[kind];
  if (marker) {
    const selected = text.slice(start, end);
    // Leave the original words selected so the next button can combine styles.
    const italicAround = kind !== "italic" || ((text.slice(0, start).match(/\*+$/)?.[0].length || 0) % 2 === 1 && (text.slice(end).match(/^\*+/)?.[0].length || 0) % 2 === 1);
    if (italicAround && start >= marker.length && text.slice(start - marker.length, start) === marker && text.slice(end, end + marker.length) === marker) {
      return { text: text.slice(0, start - marker.length) + selected + text.slice(end + marker.length), start: start - marker.length, end: end - marker.length };
    }
    const italicWithin = kind !== "italic" || ((selected.match(/^\*+/)?.[0].length || 0) % 2 === 1 && (selected.match(/\*+$/)?.[0].length || 0) % 2 === 1);
    if (italicWithin && selected.length > marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
      const unwrapped = selected.slice(marker.length, -marker.length);
      return { text: text.slice(0, start) + unwrapped + text.slice(end), start, end: start + unwrapped.length };
    }
    const words = selected || (kind === "spoiler" ? placeholders.hidden : kind === "code" ? placeholders.code : placeholders.text);
    return { text: text.slice(0, start) + marker + words + marker + text.slice(end), start: start + marker.length, end: start + marker.length + words.length };
  }
  const lineStart = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1;
  const lastSelected = end > start && text[end - 1] === "\n" ? end - 1 : end;
  const nextLine = text.indexOf("\n", lastSelected);
  const lineEnd = nextLine < 0 ? text.length : nextLine;
  const block = text.slice(lineStart, lineEnd);
  if (kind === "codeblock") {
    const selected = text.slice(start, end);
    if (text.slice(Math.max(0, start - 4), start) === "```\n" && text.slice(end, end + 4) === "\n```") {
      return { text: text.slice(0, start - 4) + selected + text.slice(end + 4), start: start - 4, end: end - 4 };
    }
    const content = block || placeholders.codeBlock;
    return { text: text.slice(0, lineStart) + "```\n" + content + "\n```" + text.slice(lineEnd), start: lineStart + 4, end: lineStart + 4 + content.length };
  }
  const lines = (block || (kind === "numbered" || kind === "bullet" ? placeholders.list : placeholders.text)).split("\n");
  const prefix = prefixes[kind];
  const numbered = kind === "numbered";
  const already = lines.every(line => numbered ? /^\d+\. /.test(line) : !!prefix && line.startsWith(prefix));
  const output = lines.map((line, index) => {
    if (already) return numbered ? line.replace(/^\d+\. /, "") : line.slice(prefix!.length);
    // Replace the previous paragraph style rather than stacking headings and list markers.
    const plain = line.replace(/^(?:#{1,3} |-# |> |[-*] |\d+\. )/, "");
    return (numbered ? `${index + 1}. ` : prefix || "") + plain;
  }).join("\n");
  return { text: text.slice(0, lineStart) + output + text.slice(lineEnd), start: lineStart, end: lineStart + output.length };
}

export function insertDiscordLink(text: string, start: number, end: number, label: string, href: string): TextSelection {
  const parsed = new URL(href);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Enter a valid http:// or https:// link.");
  const safeLabel = (label.trim() || "link text").replace(/[\[\]\\\r\n]/g, "");
  const safeUrl = parsed.href.replace(/\(/g, "%28").replace(/\)/g, "%29");
  const content = `[${safeLabel}](${safeUrl})`;
  return { text: text.slice(0, start) + content + text.slice(end), start: start + content.length, end: start + content.length };
}
