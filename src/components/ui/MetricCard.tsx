import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function MetricCard({ label, value, icon, tone = "emerald", hint }: { label: string; value: ReactNode; icon: IconName; tone?: "emerald"|"blue"|"amber"|"rose"|"violet"|"slate"; hint?: string }) {
  return <article className="metric-card"><span className={`metric-icon metric-${tone}`}><Icon name={icon} size={20}/></span><div><p className="metric-label">{label}</p><p className="metric-value">{value}</p>{hint && <p className="metric-hint">{hint}</p>}</div></article>;
}
