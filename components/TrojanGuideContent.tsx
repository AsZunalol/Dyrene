"use client";

import { useEffect, useRef } from "react";

export default function TrojanGuideContent({ html }: { html: string }) {
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const wrappers = root.querySelectorAll(".trojan-code-copy-wrapper");
    wrappers.forEach((wrapper) => {
      const pre = wrapper.querySelector("pre");
      if (pre) wrapper.replaceWith(pre);
    });

    const images = root.querySelectorAll("img");

    images.forEach((image) => {
      image.setAttribute("loading", "lazy");

      const src = image.getAttribute("src");
      if (!src) return;

      const parent = image.parentElement;
      if (parent?.tagName.toLowerCase() === "a") return;

      const link = document.createElement("a");
      link.href = src;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.className = "block";
      link.title = "Open image bigger";

      image.parentNode?.insertBefore(link, image);
      link.appendChild(image);
    });

    const codeBlocks = root.querySelectorAll("pre");

    codeBlocks.forEach((pre) => {
      const wrapper = document.createElement("div");
      wrapper.className =
        "trojan-code-copy-wrapper relative my-6 overflow-hidden rounded-2xl border border-emerald-400/25 bg-[#020617] shadow-[0_0_28px_rgba(16,185,129,0.12)]";

      const header = document.createElement("div");
      header.className =
        "flex items-center gap-2 border-b border-emerald-400/20 bg-emerald-950/20 px-4 py-2";
      header.innerHTML =
        '<span class="h-2.5 w-2.5 rounded-full bg-red-400"></span><span class="h-2.5 w-2.5 rounded-full bg-yellow-300"></span><span class="h-2.5 w-2.5 rounded-full bg-emerald-400"></span><span class="ml-2 font-mono text-xs text-emerald-300/70">terminal block</span>';

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Copy";
      button.className =
        "absolute right-3 top-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200 backdrop-blur hover:bg-emerald-500/20";

      button.addEventListener("click", async () => {
        const text = pre.textContent || "";

        try {
          await navigator.clipboard.writeText(text);
          button.textContent = "Copied!";
          setTimeout(() => {
            button.textContent = "Copy";
          }, 1200);
        } catch {
          button.textContent = "Failed";
          setTimeout(() => {
            button.textContent = "Copy";
          }, 1200);
        }
      });

      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
      wrapper.appendChild(button);
    });
  }, [html]);

  return (
    <div
      ref={contentRef}
      className="prose prose-invert mt-8 max-w-none text-emerald-50/90 [&_a]:text-emerald-300 [&_blockquote]:border-l-emerald-400 [&_blockquote]:bg-emerald-500/5 [&_blockquote]:px-4 [&_code]:rounded-md [&_code]:border [&_code]:border-emerald-400/25 [&_code]:bg-black/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-emerald-200 [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h3]:font-black [&_h3]:tracking-tight [&_img]:mx-auto [&_img]:my-6 [&_img]:max-h-[420px] [&_img]:w-auto [&_img]:max-w-full sm:[&_img]:max-w-2xl [&_img]:cursor-zoom-in [&_img]:rounded-2xl [&_img]:border [&_img]:border-emerald-400/20 [&_img]:bg-black/40 [&_img]:object-contain [&_img]:shadow-[0_0_32px_rgba(16,185,129,0.12)] [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-none [&_pre]:border-0 [&_pre]:bg-transparent [&_pre]:p-4 [&_pre]:pr-20 [&_pre]:font-mono [&_pre]:text-emerald-200 [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-bold [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
