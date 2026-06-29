import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Notice({ kind, children }: { kind: "success"|"error"|"warning"|"info"; children: ReactNode }) {
  const icon = kind === "success" ? "check" : kind === "error" || kind === "warning" ? "alert" : "info";
  return <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}><Icon name={icon} size={19}/><div>{children}</div></div>;
}
