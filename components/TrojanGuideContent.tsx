"use client";
import { useTranslation } from "@/components/LanguageProvider";

import { useEffect, useRef } from "react";

export default function TrojanGuideContent({ html }: { html: string }) {
  const { t } = useTranslation();
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
      if (parent?.tagName.toLowerCase() === "a") {
        if (parent.dataset.guideImageLink) parent.title = t("Open image bigger");
        return;
      }

      const link = document.createElement("a");
      link.href = src;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.className = "block";
      link.title = t("Open image bigger");
      link.dataset.guideImageLink = "true";

      image.parentNode?.insertBefore(link, image);
      link.appendChild(image);
    });

    const codeBlocks = root.querySelectorAll("pre");

    codeBlocks.forEach((pre) => {
      const wrapper = document.createElement("div");
      wrapper.className =
        "trojan-code-copy-wrapper relative my-6 overflow-hidden rounded-xl border border-line bg-inset";

      const header = document.createElement("div");
      header.className =
        "flex items-center gap-2 border-b border-line bg-elevated px-4 py-2";
      header.textContent = t("Code");

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = t("Copy");
      button.className =
        "absolute right-3 top-2 rounded-lg border border-accent/25 bg-accent-strong/10 px-3 py-1 text-xs font-bold text-accent backdrop-blur hover:bg-accent-strong/20";

      button.addEventListener("click", async () => {
        const text = pre.textContent || "";

        try {
          await navigator.clipboard.writeText(text);
          button.textContent = t("Copied!");
          setTimeout(() => {
            button.textContent = t("Copy");
          }, 1200);
        } catch {
          button.textContent = t("Failed");
          setTimeout(() => {
            button.textContent = t("Copy");
          }, 1200);
        }
      });

      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
      wrapper.appendChild(button);
    });
  }, [html, t]);

  return (
    <div
      ref={contentRef}
      className="prose prose-invert mt-8 max-w-none text-foreground leading-7 [&_h2]:mt-8 [&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:text-xl [&_a]:text-accent [&_blockquote]:border-l-accent [&_blockquote]:bg-accent-strong/5 [&_blockquote]:px-4 [&_code]:rounded-md [&_code]:border [&_code]:border-accent/25 [&_code]:bg-black/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-accent [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h3]:font-semibold [&_h3]:tracking-tight [&_img]:mx-auto [&_img]:my-6 [&_img]:max-h-[420px] [&_img]:w-auto [&_img]:max-w-full sm:[&_img]:max-w-2xl [&_img]:cursor-zoom-in [&_img]:rounded-xl [&_img]:border [&_img]:border-accent/20 [&_img]:bg-inset [&_img]:object-contain [&_img]:shadow-[0_0_32px_rgba(16,185,129,0.12)] [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-none [&_pre]:border-0 [&_pre]:bg-transparent [&_pre]:p-4 [&_pre]:pr-20 [&_pre]:font-mono [&_pre]:text-accent [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-bold [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
