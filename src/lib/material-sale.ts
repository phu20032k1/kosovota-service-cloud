export type MaterialSaleStatus = "DRAFT" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export type MaterialSaleLine = {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
};

export type MaterialSaleOrder = {
  status: MaterialSaleStatus;
  lines: MaterialSaleLine[];
  warehouseId: string | null;
  note: string;
  total: number;
  updatedAt: string | null;
};

const SEPARATOR = "\n[material-sale-order]\n";
const STATUSES: MaterialSaleStatus[] = ["DRAFT", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

export function materialSaleTotal(lines: MaterialSaleLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}

export function readMaterialSale(description: string | null | undefined): { summary: string; order: MaterialSaleOrder } {
  const source = description || "";
  const index = source.lastIndexOf(SEPARATOR);
  const summary = index < 0 ? source : source.slice(0, index);
  const empty: MaterialSaleOrder = { status: "DRAFT", lines: [], warehouseId: null, note: "", total: 0, updatedAt: null };
  if (index < 0) return { summary, order: empty };
  try {
    const parsed = JSON.parse(source.slice(index + SEPARATOR.length)) as Partial<MaterialSaleOrder>;
    if (!parsed || !Array.isArray(parsed.lines) || !STATUSES.includes(parsed.status as MaterialSaleStatus)) return { summary, order: empty };
    const lines = parsed.lines.filter((line): line is MaterialSaleLine => Boolean(
      line && typeof line.itemId === "string" && typeof line.sku === "string" &&
      typeof line.name === "string" && typeof line.unit === "string" &&
      Number.isSafeInteger(line.quantity) && line.quantity > 0 &&
      Number.isSafeInteger(line.unitPrice) && line.unitPrice >= 0,
    ));
    return { summary, order: {
      status: parsed.status as MaterialSaleStatus,
      lines,
      warehouseId: typeof parsed.warehouseId === "string" ? parsed.warehouseId : null,
      note: typeof parsed.note === "string" ? parsed.note : "",
      total: materialSaleTotal(lines),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    } };
  } catch {
    return { summary, order: empty };
  }
}

export function writeMaterialSale(description: string | null | undefined, order: MaterialSaleOrder) {
  const { summary } = readMaterialSale(description);
  return `${summary}${SEPARATOR}${JSON.stringify(order)}`;
}
