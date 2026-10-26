const FIELD_ROLES = new Set(["DEALER", "CTV", "KTV"]);
const LOCKED_STATUSES = new Set(["COMPLETED", "CANCELLED"]);
const PRE_ACCEPT_ROLES = new Set(["DEALER", "CTV"]);

type ProtectableOrder = {
  status?: string | null;
  customerName?: string;
  customerPhone?: string;
  address?: string | null;
  machine?: unknown;
};

function sanitizedMachine(machine: unknown) {
  return machine && typeof machine === "object"
    ? {
        ...(machine as Record<string, unknown>),
        customer: null,
        sharedPhones: null,
      }
    : machine;
}

export function protectServiceOrderCustomerData<T extends ProtectableOrder>(order: T, role: string): T {
  const status = order.status || "";
  if (!FIELD_ROLES.has(role)) return order;

  if (PRE_ACCEPT_ROLES.has(role) && status === "ASSIGNED") {
    return {
      ...order,
      customerName: "Khách hàng",
      customerPhone: "",
      address: null,
      machine: sanitizedMachine(order.machine),
      customerDataLocked: true,
      preAcceptLocked: true,
    } as T;
  }

  if (!LOCKED_STATUSES.has(status)) return order;

  return {
    ...order,
    customerName: "Thông tin đã khóa",
    customerPhone: "",
    address: null,
    machine: sanitizedMachine(order.machine),
    customerDataLocked: true,
  } as T;
}
