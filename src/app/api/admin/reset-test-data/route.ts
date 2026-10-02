import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const CONFIRMATION = "RESET_ALL_TEST_DATA";
const ROOT_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Chỉ Admin được reset dữ liệu test." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (body.confirmation !== CONFIRMATION) {
    return NextResponse.json(
      { success: false, message: "Thiếu xác nhận reset dữ liệu." },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const counts: Record<string, number> = {};

      // Xóa từ bảng con tới bảng cha để không vi phạm khóa ngoại.
      counts.ticketMessages = (await tx.ticketMessage.deleteMany()).count;
      counts.customerActivities = (await tx.customerActivity.deleteMany()).count;
      counts.paymentLines = (await tx.paymentLine.deleteMany()).count;
      counts.serviceReports = (await tx.serviceReport.deleteMany()).count;
      counts.stockMovements = (await tx.stockMovement.deleteMany()).count;
      counts.supportTickets = (await tx.supportTicket.deleteMany()).count;
      counts.serviceOrders = (await tx.serviceOrder.deleteMany()).count;
      counts.maintenanceSchedules = (await tx.maintenanceSchedule.deleteMany()).count;
      counts.sosTickets = (await tx.sosTicket.deleteMany()).count;
      counts.activations = (await tx.activation.deleteMany()).count;
      counts.stockBalances = (await tx.stockBalance.deleteMany()).count;
      counts.paymentBatches = (await tx.paymentBatch.deleteMany()).count;
      counts.warehouses = (await tx.warehouse.deleteMany()).count;
      counts.machines = (await tx.machine.deleteMany()).count;
      counts.customers = (await tx.customer.deleteMany()).count;
      counts.dealers = (await tx.dealer.deleteMany()).count;
      counts.inventoryItems = (await tx.inventoryItem.deleteMany()).count;
      counts.salesLeads = (await tx.salesLead.deleteMany()).count;
      counts.notifications = (await tx.notification.deleteMany()).count;
      counts.otpCodes = (await tx.otpCode.deleteMany()).count;
      counts.idSequences = (await tx.idSequence.deleteMany()).count;
      counts.trashItems = (await tx.trashItem.deleteMany()).count;

      // Giữ nguyên tài khoản gốc để người quản trị không tự khóa mình khỏi hệ thống.
      counts.users = (await tx.user.deleteMany({
        where: { role: { notIn: ROOT_ROLES } },
      })).count;

      // Làm sạch log test cũ; sau transaction sẽ ghi lại đúng một log RESET.
      counts.adminLogs = (await tx.adminLog.deleteMany()).count;

      return counts;
    }, { timeout: 30_000 });

    await writeAudit({
      request,
      userId: auth.user.id,
      action: "RESET_ALL_TEST_DATA",
      target: "KOSOVOTA",
      detail: {
        preservedRoles: ROOT_ROLES,
        deleted: result,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Đã xóa sạch dữ liệu test. Tài khoản ADMIN/SUPER_ADMIN được giữ lại.",
      data: result,
    });
  } catch (error) {
    console.error("POST /api/admin/reset-test-data failed", error);
    return NextResponse.json(
      { success: false, message: "Reset dữ liệu test thất bại. Không có dữ liệu nào được xóa dở dang." },
      { status: 500 },
    );
  }
}
