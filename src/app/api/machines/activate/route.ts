import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  const { machineId, customerId } = body;

  // 1. kiểm tra máy
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
  });

  if (!machine) {
    return Response.json({ error: "Machine not found" }, { status: 404 });
  }

  // 2. cập nhật máy đã kích hoạt
  const updated = await prisma.machine.update({
    where: { id: machineId },
    data: {
      customerId: customerId || null,
      status: "ACTIVE",
    },
  });

  // 3. tạo warranty record
  await prisma.machine.update({
  where: { id: machineId },
  data: {
  customerId: customerId || null,
  status: "ACTIVE",
},
});

  return Response.json({
    success: true,
    machine: updated,
  });
}
