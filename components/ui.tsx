import { scoreLabel } from "@/lib/oulu";
import { TONE } from "@/lib/format";

export function Section(props: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={props.id} aria-labelledby={`${props.id}-h`} className="mt-16">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${props.id}-h`} className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
          {props.title}
        </h2>
        {props.hint && <p className="text-xs text-faint">{props.hint}</p>}
      </div>
      {props.children}
    </section>
  );
}

export function Score({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  const { label, tone } = scoreLabel(value);
  return (
    <span className={`inline-flex items-center gap-2 ${size === "lg" ? "text-base" : "text-sm"} ${TONE[tone].text}`}>
      <span className={`size-1.5 rounded-full ${TONE[tone].dot}`} />
      {label}
      <span className="font-mono text-xs text-faint tabular-nums">{value}</span>
    </span>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-2xl border border-line bg-surface/70 ${className}`}>{children}</div>;
}
