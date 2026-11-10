import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

/** Safe HTML from Markdown (articles / casino editorial reviews). */
export function renderMarkdown(md: string | null | undefined): string {
  const src = (md || "").trim();
  if (!src) return "";
  const raw = marked.parse(src, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel", "loading"],
  });
}
