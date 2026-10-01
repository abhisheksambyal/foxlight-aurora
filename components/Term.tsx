"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY, type TermKey } from "@/lib/glossary";

type Pos = { left: number; top: number; width: number; above: boolean };

/**
 * A technical term with a one-line explanation. Hover (mouse), tap (touch) or focus (keyboard) to show it.
 * The tip is fixed-positioned and clamped to the viewport, so it never causes sideways scrolling.
 */
export function Term({ k, children, icon }: { k: TermKey; children: React.ReactNode; icon?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const mouse = useRef(false);
  const id = useId();
  const [pos, setPos] = useState<Pos | null>(null);

  const show = () => {
    const r = ref.current!.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth - 16);
    const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, 8), window.innerWidth - width - 8);
    const above = r.top > 140;
    setPos({ left, width, above, top: above ? r.top - 8 : r.bottom + 8 });
  };
  const hide = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && hide();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-describedby={pos ? id : undefined}
        className={`${icon ? "whitespace-nowrap " : ""}cursor-help underline decoration-faint decoration-dotted underline-offset-4 hover:decoration-muted focus:outline-none focus-visible:decoration-great`}
        onPointerDown={(e) => (mouse.current = e.pointerType === "mouse")}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={(e) => e.pointerType === "mouse" && hide()}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.stopPropagation();
          if (!mouse.current) (pos ? hide : show)();
        }}
      >
        {children}
        {icon && (
          <svg viewBox="0 0 16 16" className="ml-1 inline size-3 align-[-1px] text-faint" aria-hidden>
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" />
            <path d="M8 7v4M8 4.6v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {pos &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="pointer-events-none fixed z-50 rounded-xl border border-line bg-surface px-3 py-2 text-left text-xs leading-relaxed font-normal tracking-normal text-ink normal-case shadow-xl shadow-black/50"
            style={{ left: pos.left, top: pos.top, width: pos.width, transform: pos.above ? "translateY(-100%)" : undefined }}
          >
            {GLOSSARY[k]}
          </span>,
          document.body,
        )}
    </>
  );
}
