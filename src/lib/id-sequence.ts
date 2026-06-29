import { prisma } from "@/lib/prisma";

export async function nextSequence(key: string) {
  const row = await prisma.idSequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

export function formatSequence(value: number, length = 4) {
  return String(value).padStart(length, "0");
}
