import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { geocodeAddress } from "@/lib/maps/geocode";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function machineIdsFromBody(body: Record<string, unknown>) {
  if (Array.isArray(body.machineIds)) return uniqueStrings(body.machineIds);
  if (Array.isArray(body.ids)) return uniqueStrings(body.ids);
  return uniqueStrings([body.machineId, body.id]);
}

function hasUsableCoordinates(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001);
}

const ACTIVE_ORDER_STATUSES = new Set([
  "NEW",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "CALLED_NO_ANSWER",
  "CUSTOMER_ACCEPTED",
  "RESCHEDULED",
  "COMPLAINT",
]);

type ResolvedCoordinates = { lat: number; lng: number } | null;

async function backfillMachineGpsFromCustomerAddress<T extends {
  id: string;
  lat: number | null;
  lng: number | null;
  customer: { address: string | null } | null;
  serviceOrders: { status: string }[];
}>(machines: T[]) {
  const candidates = machines
    .filter((machine) => !hasUsableCoordinates(machine.lat, machine.lng) && Boolean(machine.customer?.address?.trim()))
    .sort((a, b) => {
      const aActive = a.serviceOrders.some((order) => ACTIVE_ORDER_STATUSES.has(order.status)) ? 1 : 0;
      const bActive = b.serviceOrders.some((order) => ACTIVE_ORDER_STATUSES.has(order.status)) ? 1 : 0;
      return bActive - aActive;
    })
    .slice(0, 40);

  if (!candidates.length) return 0;

  const geocodeCache = new Map<string, Promise<ResolvedCoordinates>>();
  const geocodeCached = (address: string) => {
    const key = address.trim().toLowerCase();
    const cached = geocodeCache.get(key);
    if (cached) return cached;
    const pending = geocodeAddress(address)
      .then((location) => location && hasUsableCoordinates(location.lat, location.lng)
        ? { lat: location.lat, lng: location.lng }
        : null)
      .catch((error) => {
        console.warn(`Không tự ghim được GPS máy từ địa chỉ khách hàng ${address}:`, error);
        return null;
      });
    geocodeCache.set(key, pending);
    return pending;
  };

  let updatedCount = 0;
  for (let index = 0; index < candidates.length; index += 5) {
    const batch = candidates.slice(index, index + 5);
    await Promise.all(batch.map(async (machine) => {
      const address = machine.customer?.address?.trim();
      if (!address) return;
      const location = await geocodeCached(address);
      if (!location) return;
      await prisma.machine.update({
        where: { id: machine.id },
        data: { lat: location.lat, lng: location.lng },
      });
      machine.lat = location.lat;
      machine.lng = location.lng;
      updatedCount += 1;
    }));
  }

  return updatedCount;
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  try {
    const scopes = auth.user.provinceScope?.split(",").map((v: string) => v.trim()).filter(Boolean) || [];
    const machines = await prisma.machine.findMany({
      where: auth.user.role === "CSKH" && scopes.length ? { provinceCode: { in: scopes } } : undefined,
      include: {
        customer: true,
        activations: { orderBy: { step: "asc" } },
        serviceOrders: true,
        serviceReports: true,
        maintenanceSchedules: { orderBy: { dueDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const gpsBackfilledCount = await backfillMachineGpsFromCustomerAddress(machines);

    return NextResponse.json({
      success: true,
      data: machines,
      gpsBackfilledCount,
      message: gpsBackfilledCount
        ? `Đã tự ghim GPS cho ${gpsBackfilledCount} máy từ địa chỉ khách hàng.`
        : undefined,
    });
  } catch (error) {
    console.error("GET /api/machines failed", error);
    return NextResponse.json({ success: false, message: "Không tải được danh sách máy." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được tạo máy." }, { status: 403 });
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim().toUpperCase() : "";
    const model = typeof body.model === "string" ? body.model.trim().toUpperCase() : "";
    if (!id || !model) return NextResponse.json({ success: false, message: "ID máy và model là bắt buộc." }, { status: 400 });
    const manufactureDate = body.manufactureDate ? new Date(body.manufactureDate) : null;
    if (manufactureDate && Number.isNaN(manufactureDate.getTime())) return NextResponse.json({ success: false, message: "Ngày sản xuất không hợp lệ." }, { status: 400 });
    const machine = await prisma.machine.create({
      data: {
        id,
        model,
        name: typeof body.name === "string" ? body.name.trim() || null : null,
        capacity: typeof body.capacity === "string" ? body.capacity.trim() || null : null,
        specification: typeof body.specification === "string" ? body.specification.trim() || null : null,
        warrantyMonths: Number.isInteger(body.warrantyMonths) ? body.warrantyMonths : null,
        serial: typeof body.serial === "string" ? body.serial.trim() || null : null,
        provinceCode: typeof body.provinceCode === "string" ? body.provinceCode.trim() || null : null,
        status: typeof body.status === "string" ? body.status : "NEW",
        manufactureDate,
      },
    });
    await prisma.adminLog.create({ data: { userId: auth.user.id, action: "CREATE_MACHINE", target: id } });
    return NextResponse.json({ success: true, data: machine }, { status: 201 });
  } catch (error) {
    console.error("POST /api/machines failed", error);
    return NextResponse.json({ success: false, message: "Không thể tạo máy; ID hoặc seri có thể đã tồn tại." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xóa máy." }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({}));
    const requestedIds = machineIdsFromBody(body);
    const machineIds = requestedIds.map((id) => id.toUpperCase());

    if (!machineIds.length) {
      return NextResponse.json({ success: false, message: "Vui lòng chọn máy cần xóa." }, { status: 400 });
    }

    const existingMachines = await prisma.machine.findMany({
      where: { id: { in: machineIds } },
      select: { id: true },
    });
    const existingIds = existingMachines.map((machine) => machine.id);

    if (!existingIds.length) {
      return NextResponse.json({ success: false, message: "Không tìm thấy máy cần xóa." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const serviceOrders = await tx.serviceOrder.findMany({
        where: { machineId: { in: existingIds } },
        select: { id: true },
      });
      const serviceOrderIds = serviceOrders.map((order) => order.id);

      const supportTickets = await tx.supportTicket.findMany({
        where: { machineId: { in: existingIds } },
        select: { id: true },
      });
      const supportTicketIds = supportTickets.map((ticket) => ticket.id);

      if (supportTicketIds.length) {
        await tx.ticketMessage.deleteMany({ where: { ticketId: { in: supportTicketIds } } });
        await tx.supportTicket.deleteMany({ where: { id: { in: supportTicketIds } } });
      }

      await tx.sosTicket.deleteMany({ where: { machineId: { in: existingIds } } });

      if (serviceOrderIds.length) {
        await tx.paymentLine.deleteMany({ where: { serviceOrderId: { in: serviceOrderIds } } });
        await tx.stockMovement.deleteMany({ where: { serviceOrderId: { in: serviceOrderIds } } });
        await tx.serviceReport.deleteMany({
          where: {
            OR: [
              { machineId: { in: existingIds } },
              { orderId: { in: serviceOrderIds } },
            ],
          },
        });
        await tx.serviceOrder.deleteMany({ where: { id: { in: serviceOrderIds } } });
      } else {
        await tx.serviceReport.deleteMany({ where: { machineId: { in: existingIds } } });
      }

      await tx.maintenanceSchedule.deleteMany({ where: { machineId: { in: existingIds } } });
      await tx.activation.deleteMany({ where: { machineId: { in: existingIds } } });
      await tx.machine.deleteMany({ where: { id: { in: existingIds } } });
      await tx.adminLog.createMany({
        data: existingIds.map((machineId) => ({
          userId: auth.user.id,
          action: "DELETE_MACHINE",
          target: machineId,
          detail: "Xóa máy cùng dữ liệu kích hoạt, bảo trì, ticket và lệnh dịch vụ liên quan.",
        })),
      });
    });

    return NextResponse.json({
      success: true,
      data: { deletedIds: existingIds },
      message: existingIds.length === 1 ? "Đã xóa máy." : `Đã xóa ${existingIds.length} máy.`,
    });
  } catch (error) {
    console.error("DELETE /api/machines failed", error);
    return NextResponse.json({ success: false, message: "Không xóa được máy." }, { status: 500 });
  }
}
