import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

function escapeHtml(s) {
  if (s == null) return "";
  const str = String(s);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Parse string into segments: { type: 'text'|'math', content: string, display?: boolean }
 * Supports $$..$$, $..$, \[..\], \(..\)
 */
function parseMath(str) {
  if (str == null || typeof str !== "string") return [{ type: "text", content: "" }];
  const segments = [];
  let i = 0;
  while (i < str.length) {
    const rest = str.slice(i);
    const nextDbl = rest.indexOf("$$");
    const nextSng = rest.indexOf("$");
    const nextBrack = rest.indexOf("\\[");
    const nextParen = rest.indexOf("\\(");
    let start = -1;
    let endMarker = "";
    let display = false;
    let skip = 0;
    if (nextBrack >= 0 && (start < 0 || nextBrack < start)) {
      const end = rest.indexOf("\\]", nextBrack + 2);
      if (end >= 0) {
        start = nextBrack;
        endMarker = "\\]";
        display = true;
        skip = 2;
      }
    }
    if (nextParen >= 0 && (start < 0 || nextParen < start)) {
      const end = rest.indexOf("\\)", nextParen + 2);
      if (end >= 0) {
        start = nextParen;
        endMarker = "\\)";
        display = false;
        skip = 2;
      }
    }
    if (nextDbl >= 0 && (start < 0 || nextDbl < start)) {
      const end = rest.indexOf("$$", nextDbl + 2);
      if (end >= 0) {
        start = nextDbl;
        endMarker = "$$";
        display = true;
        skip = 2;
      }
    }
    if (nextSng >= 0 && (start < 0 || nextSng < start)) {
      const end = rest.indexOf("$", nextSng + 1);
      if (end >= 0 && rest.slice(nextSng + 1, end).indexOf("$") < 0) {
        start = nextSng;
        endMarker = "$";
        display = false;
        skip = 1;
      }
    }
    if (start >= 0) {
      const endIdx = rest.indexOf(endMarker, start + skip);
      if (endIdx >= 0) {
        if (start > 0) segments.push({ type: "text", content: rest.slice(0, start) });
        segments.push({
          type: "math",
          content: rest.slice(start + skip, endIdx).trim(),
          display,
        });
        i += endIdx + endMarker.length;
        continue;
      }
    }
    segments.push({ type: "text", content: rest });
    break;
  }
  return segments.length ? segments : [{ type: "text", content: "" }];
}

function renderToHtml(str) {
  const segments = parseMath(str);
  let html = "";
  for (const seg of segments) {
    if (seg.type === "text") {
      html += escapeHtml(seg.content);
    } else {
      try {
        html += katex.renderToString(seg.content, {
          displayMode: !!seg.display,
          throwOnError: false,
          output: "html",
        });
      } catch (_) {
        html += escapeHtml("$" + (seg.display ? "$" : "") + seg.content + (seg.display ? "$" : "") + "$");
      }
    }
  }
  return html;
}

/**
 * Renders text with LaTeX math. Use $...$ for inline and $$...$$ for block.
 */
export default function MathText({ children, className = "", as: Tag = "span", ...props }) {
  const html = useMemo(() => {
    const text = children == null ? "" : typeof children === "string" ? children : String(children);
    return renderToHtml(text);
  }, [children]);

  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} {...props} />;
}
