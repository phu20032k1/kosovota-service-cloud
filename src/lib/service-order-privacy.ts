const FIELD_ROLES = new Set(["DEALER", "CTV", "KTV"]);
const LOCKED_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

type ProtectableOrder = {
  status?: string | null;
  customerName?: string;
  customerPhone?: string;
  address?: string | null;
  machine?: ({ customer?: unknown } & Record<string, unknown>) | null;
};

export function protectServiceOrderCustomerData<T extends ProtectableOrder>(order: T, role: string): T {
  if (!FIELD_ROLES.has(role) || !LOCKED_STATUSES.has(order.status || "")) return order;

  const machine = order.machine
    ? {
        ...order.machine,
        customer: null,
        sharedPhones: null,
      }
    : order.machine;

  return {
    ...order,
    customerName: "Thông tin đã khóa",
    customerPhone: "",
    address: null,
    machine,
    customerDataLocked: true,
  } as T;
}
