import Link from "next/link";
import { Icon } from "./Icon";

export function Brand({ compact = false, inverse = false, className = "", size = "md", href = "/" }: { compact?: boolean; inverse?: boolean; className?: string; size?: "md" | "lg"; href?: string }) {
  const large = size === "lg";
  return (
    <Link href={href} className={`group inline-flex items-center gap-3 ${className}`} aria-label="KOSOVOTA">
      <span className={`brand-mark ${large ? "h-[52px] w-[52px] rounded-[17px]" : ""} ${inverse ? "brand-mark-inverse" : ""}`}><Icon name="droplet" size={large ? 28 : compact ? 20 : 24} strokeWidth={2.4}/></span>
      {!compact && <span className="leading-none"><strong className={`block ${large ? "text-[20px]" : "text-[17px]"} font-extrabold tracking-[.12em] ${inverse ? "text-white" : "text-slate-950"}`}>KOSOVOTA</strong><span className={`mt-1 block ${large ? "text-[11px]" : "text-[10px]"} font-semibold tracking-[.12em] ${inverse ? "text-white/60" : "text-slate-500"}`}>SERVICE CLOUD</span></span>}
    </Link>
  );
}
