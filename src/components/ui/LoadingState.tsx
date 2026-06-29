import { Icon } from "./Icon";
export function LoadingState({ label = "Đang tải dữ liệu..." }: { label?: string }) { return <div className="loading-state"><span className="animate-spin"><Icon name="refresh" size={22}/></span><span>{label}</span></div>; }
