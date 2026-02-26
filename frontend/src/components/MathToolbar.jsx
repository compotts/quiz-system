import { useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * Returns true if position pos is inside $...$ or $$...$$ in value.
 */
function isInsideMath(value, pos) {
  const s = value ?? "";
  if (pos <= 0 || pos > s.length) return false;
  let i = 0;
  while (i < s.length) {
    if (s.substring(i, i + 2) === "$$") {
      const close = s.indexOf("$$", i + 2);
      if (close !== -1 && pos > i && pos < close + 2) return true;
      i = close !== -1 ? close + 2 : s.length;
      continue;
    }
    if (s[i] === "$") {
      let j = i + 1;
      for (;;) {
        const next = s.indexOf("$", j);
        if (next === -1) break;
        if (s[next + 1] === "$") { j = next + 2; continue; }
        if (pos > i && pos <= next) return true;
        break;
      }
      i = i + 1;
      continue;
    }
    i++;
  }
  return false;
}

/**
 * Buttons insert LaTeX at cursor in the target input/textarea.
 * Props: targetRef (ref to input), value (string), onChange (string => void)
 */
export default function MathToolbar({ targetRef, value, onChange, className = "", label }) {
  const { t } = useTranslation();
  const cursorAfterRef = useRef(null);

  /** @param {string} snippet - LaTeX to insert. @param {number} [cursorOffset] - position inside snippet to place cursor (default: end). */
  const insert = (snippet, cursorOffset = undefined) => {
    const el = targetRef?.current;
    if (!el || onChange == null) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const str = value ?? "";
    let toInsert = snippet;
    let finalOffset = cursorOffset;
    if (isInsideMath(str, start) && snippet.startsWith("$") && snippet.endsWith("$") && snippet.length > 1 && snippet !== "$$") {
      toInsert = snippet.slice(1, -1);
      finalOffset = finalOffset !== undefined ? Math.max(0, finalOffset - 1) : toInsert.length;
    }
    const before = str.slice(0, start);
    const after = str.slice(end);
    const newVal = before + toInsert + after;
    const pos = finalOffset !== undefined ? start + finalOffset : start + toInsert.length;
    cursorAfterRef.current = pos;
    onChange(newVal);
    setTimeout(() => {
      if (targetRef?.current) {
        targetRef.current.focus();
        targetRef.current.setSelectionRange(cursorAfterRef.current, cursorAfterRef.current);
      }
    }, 0);
  };

  const wrapSelection = (left, right) => {
    const el = targetRef?.current;
    if (!el || onChange == null) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const sel = (value ?? "").slice(start, end) || "?";
    const newVal = (value ?? "").slice(0, start) + left + sel + right + (value ?? "").slice(end);
    cursorAfterRef.current = start + left.length + sel.length + right.length;
    onChange(newVal);
    setTimeout(() => {
      if (targetRef?.current) {
        targetRef.current.focus();
        targetRef.current.setSelectionRange(cursorAfterRef.current, cursorAfterRef.current);
      }
    }, 0);
  };

  const buttons = [
    { label: "x²", titleKey: "mathBtn.x2", snippet: "$x^2$" },
    { label: "xⁿ", titleKey: "mathBtn.xn", snippet: "$x^n$" },
    { label: "½", titleKey: "mathBtn.fractionHalf", snippet: "$\\frac{1}{2}$" },
    { label: "a/b", titleKey: "mathBtn.fractionAb", snippet: "$\\frac{a}{b}$" },
    { label: "—/—", titleKey: "mathBtn.fractionEmpty", snippet: "$\\frac{}{}$", cursorOffset: 7 },
    { label: "√", titleKey: "mathBtn.sqrt", snippet: "$\\sqrt{x}$" },
    { label: "2√5", titleKey: "mathBtn.coefSqrt", snippet: "$2\\sqrt{5}$" },
    { label: "∑", titleKey: "mathBtn.sum", snippet: "$\\sum_{i=1}^{n}$" },
    { label: "∫", titleKey: "mathBtn.integral", snippet: "$\\int_{a}^{b}$" },
    { label: "sin", titleKey: "mathBtn.sin", snippet: "$\\sin x$" },
    { label: "cos", titleKey: "mathBtn.cos", snippet: "$\\cos x$" },
    { label: "tan", titleKey: "mathBtn.tan", snippet: "$\\tan x$" },
    { label: "°", titleKey: "mathBtn.degrees", snippet: "$90^\\circ$" },
    { label: "α", titleKey: "mathBtn.alpha", snippet: "$\\alpha$" },
    { label: "β", titleKey: "mathBtn.beta", snippet: "$\\beta$" },
    { label: "π", titleKey: "mathBtn.pi", snippet: "$\\pi$" },
    { label: "γ", titleKey: "mathBtn.gamma", snippet: "$\\gamma$" },
    { label: "Δ", titleKey: "mathBtn.delta", snippet: "$\\Delta$" },
    { label: "≠", titleKey: "mathBtn.neq", snippet: "$\\neq$" },
    { label: "≤", titleKey: "mathBtn.leq", snippet: "$\\leq$" },
    { label: "≥", titleKey: "mathBtn.geq", snippet: "$\\geq$" },
    { label: "≈", titleKey: "mathBtn.approx", snippet: "$\\approx$" },
    { label: "∞", titleKey: "mathBtn.infinity", snippet: "$\\infty$" },
    { label: "×", titleKey: "mathBtn.times", snippet: "$\\times$" },
    { label: "÷", titleKey: "mathBtn.div", snippet: "$\\div$" },
    { label: "±", titleKey: "mathBtn.pm", snippet: "$\\pm$" },
    { label: "($)", titleKey: "mathBtn.wrapInline", snippet: "$$", wrap: true },
    { label: "($$)", titleKey: "mathBtn.wrapBlock", snippet: "$$$$", wrap: true },
  ];

  const ns = "teacher.quizPage";
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {label && <span className="mr-1 text-xs text-[var(--text-muted)]">{label}</span>}
      {buttons.map((b) => {
        const title = t(`${ns}.${b.titleKey}`);
        if (b.wrap) {
          const isBlock = b.snippet === "$$$$";
          return (
            <button
              key={b.label}
              type="button"
              title={title}
              className="rounded border border-[var(--border)] bg-[var(--bg-card)] px-1.5 py-0.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--border)]"
              onClick={() => wrapSelection(isBlock ? "$$" : "$", isBlock ? "$$" : "$")}
            >
              {b.label}
            </button>
          );
        }
        return (
          <button
            key={b.label}
            type="button"
            title={title}
            className="rounded border border-[var(--border)] bg-[var(--bg-card)] px-1.5 py-0.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)]"
            onClick={() => insert(b.snippet, b.cursorOffset)}
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}
