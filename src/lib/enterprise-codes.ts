import { formatSequence, nextSequence } from "@/lib/id-sequence";

function yearMonth() {
  const now = new Date();
  return `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function createMovementCode() {
  const period = yearMonth();
  return `KHO-${period}-${formatSequence(await nextSequence(`STOCK_MOVEMENT:${period}`), 6)}`;
}

export async function createTicketCode() {
  const period = yearMonth();
  return `YC-${period}-${formatSequence(await nextSequence(`SUPPORT_TICKET:${period}`), 6)}`;
}

export async function createPaymentBatchCode() {
  const period = yearMonth();
  return `DS-${period}-${formatSequence(await nextSequence(`PAYMENT_BATCH:${period}`), 5)}`;
}
