"use client";

import { useState, type ReactNode } from "react";
import { useTranslation } from "./LanguageProvider";
import styles from "./DiscordDashboard.module.css";

function Spoiler({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  return <button type="button" className={styles.spoilerPreview} aria-label={t(revealed ? "Hide spoiler" : "Reveal spoiler")} aria-expanded={revealed} onClick={() => setRevealed(value => !value)}><span aria-hidden={!revealed}>{children}</span></button>;
}
function inline(text: string, names: Record<string, string>, depth = 0): ReactNode {
  if (depth > 8) return text;
  const pattern = /\\([\\`*_{}\[\]()#+\-.!~|>])|`([^`\n]+)`|\|\|([\s\S]+?)\|\||\*\*\*([\s\S]+?)\*\*\*|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*([^*\n]+)\*|_([^_\n]+)_|<@[!&]?(\d+)>|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const nodes: ReactNode[] = []; let offset = 0, match;
  while ((match = pattern.exec(text))) {
    nodes.push(text.slice(offset, match.index));
    const nested = (value: string) => inline(value, names, depth + 1);
    const key = match.index;
    if (match[1]) nodes.push(match[1]);
    else if (match[2]) nodes.push(<code key={key}>{match[2]}</code>);
    else if (match[3]) nodes.push(<Spoiler key={`${key}:${match[3]}`}>{nested(match[3])}</Spoiler>);
    else if (match[4]) nodes.push(<strong key={key}><em>{nested(match[4])}</em></strong>);
    else if (match[5]) nodes.push(<strong key={key}>{nested(match[5])}</strong>);
    else if (match[6]) nodes.push(<u key={key}>{nested(match[6])}</u>);
    else if (match[7]) nodes.push(<s key={key}>{nested(match[7])}</s>);
    else if (match[8] || match[9]) nodes.push(<em key={key}>{nested(match[8] || match[9])}</em>);
    else if (match[10]) nodes.push(<span className={styles.mention} key={key}>@{names[match[10]] || match[10]}</span>);
    else if (match[11]) nodes.push(<a key={key} href={match[12]} target="_blank" rel="noopener noreferrer">{match[11]}</a>);
    offset = pattern.lastIndex;
  }
  nodes.push(text.slice(offset)); return nodes;
}
export default function DiscordMessagePreview({ text, names = {} }: { text: string; names?: Record<string, string> }) {
  // React escapes all user text; code blocks remain literal and never parse spoilers.
  return <div className={styles.markdownPreview}>{text.split(/(```[\s\S]*?```)/g).map((block, blockIndex) => {
    if (block.startsWith("```")) {
      const code = block.slice(3, -3).replace(/^[\w+-]*\n/, "").replace(/\n$/, "");
      return <pre key={blockIndex}><code>{code}</code></pre>;
    }
    // Parse inline spoilers before line formatting so a whole multi-line message stays hidden.
    if (/\|\|[\s\S]*\n[\s\S]*\|\|/.test(block)) return <div key={blockIndex}>{inline(block, names)}</div>;
    return <div key={blockIndex}>{block.split("\n").map((line, index) => {
      const heading = line.match(/^(#{1,3}) (.*)$/);
      if (heading) return <div key={index} className={styles[`heading${heading[1].length}`]}>{inline(heading[2], names)}</div>;
      if (line.startsWith("-# ")) return <div key={index} className={styles.subtextPreview}>{inline(line.slice(3), names)}</div>;
      if (line.startsWith("> ")) return <blockquote key={index}>{inline(line.slice(2), names)}</blockquote>;
      const list = line.match(/^(\s*)([-*]|\d+\.) (.*)$/);
      if (list) return <div key={index} className={styles.listPreview} style={{ paddingLeft: `${Math.min(list[1].length, 16) * .5}rem` }}><span>{/\d/.test(list[2]) ? list[2] : "•"}</span><div>{inline(list[3], names)}</div></div>;
      return <div key={index}>{line ? inline(line, names) : <br />}</div>;
    })}</div>;
  })}</div>;
}
