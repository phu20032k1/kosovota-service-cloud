import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildMaintenanceSchedules } from "@/lib/maintenance";
import { hasRole } from "@/lib/auth";
import { normalizePhone as normalizeVietnamPhone, isValidVietnamPhone } from "@/lib/phone";
import { queueActivationCompletedNotifications } from "@/lib/notifications/events";
type JsonObject = Record<string, unknown>;

function errorResponse(message: string, status = 400, detail?: unknown) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(process.env.NODE_ENV !== "production" && detail
        ? { detail: detail instanceof Error ? detail.message : String(detail) }
        : {}),
    },
    { status },
  );
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown) {
  const result = readString(value);
  return result || null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readNestedObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function parseInstallationDate(value: unknown) {
  const raw = readString(value);
  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function machineStatusFromForm(value: unknown) {
  const status = readString(value).toLowerCase();

  if (status === "cần hỗ trợ" || status === "can ho tro") {
    return "NEEDS_SUPPORT";
  }

  if (status === "lỗi nhẹ" || status === "loi nhe") {
    return "ACTIVE_WARNING";
  }

  return "ACTIVE";
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const machineId = url.searchParams.get("machineId")?.trim();
    const rawStep = url.searchParams.get("step");
    const step = rawStep ? Number(rawStep) : undefined;

    if (rawStep && (!Number.isInteger(step) || (step !== 1 && step !== 2))) {
      return errorResponse("step chỉ được là 1 hoặc 2");
    }

    const where = {
      ...(machineId ? { machineId } : {}),
      ...(step ? { step } : {}),
    };
    const auth = await hasRole(request, ["ADMIN", "CSKH"]);
    if (!auth) {
      if (!machineId || !step) {
        return errorResponse("Chỉ được kiểm tra trạng thái kích hoạt của một máy cụ thể", 403);
      }
      const activation = await prisma.activation.findUnique({
        where: { machineId_step: { machineId, step } },
        select: { id: true, machineId: true, step: true },
      });
      return NextResponse.json({ success: true, data: activation ? [activation] : [] });
    }

    

    const activations = await prisma.activation.findMany({
      where,
      include: {
        machine: {
          include: {
            customer: true,
            maintenanceSchedules: { orderBy: { dueDate: "asc" } },
          },
        },
      },
      orderBy: [{ machineId: "asc" }, { step: "asc" }],
    });
    return NextResponse.json({ success: true, data: activations });
  } catch (error) {
    console.error("GET /api/activations failed", error);
    return errorResponse("Không tải được dữ liệu kích hoạt", 500, error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["DEALER", "KTV"]);
  if (!auth?.user.dealerCode) return errorResponse("Cần đăng nhập Đại lý hoặc KTV đã liên kết đại lý", 401);
  let body: JsonObject;

  try {
    body = (await request.json()) as JsonObject;
  } catch {
    return errorResponse("Dữ liệu JSON không hợp lệ");
  }

  const machineId = readString(body.machineId);
  const step = Number(body.step);

  if (!machineId) {
    return errorResponse("Thiếu machineId");
  }

  if (step !== 1 && step !== 2) {
    return errorResponse("step chỉ được là 1 hoặc 2");
  }

  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: { id: true, model: true },
    });

    if (!machine) {
      return errorResponse("Không tìm thấy máy", 404);
    }

    if (step === 1) {
      const completed = await prisma.activation.findUnique({ where: { machineId_step: { machineId, step: 2 } }, select: { id: true } });
      if (completed) return errorResponse("Máy đã hoàn tất kích hoạt, không thể ghi đè bước 1", 409);
      return saveStepOne(body, machineId);
    }

    return saveStepTwo({ ...body, dealerCode: auth.user.dealerCode, installerName: readString(body.installerName) || auth.user.name, installerPhone: normalizeVietnamPhone(readString(body.installerPhone)) || auth.user.phone }, machineId, machine.model);
  } catch (error) {
    console.error("POST /api/activations failed", error);
    return errorResponse("Không thể lưu dữ liệu kích hoạt", 500, error);
  }
}

async function saveStepOne(body: JsonObject, machineId: string) {
  const ownerName = readString(body.ownerName);
  const ownerPhone = normalizeVietnamPhone(readString(body.ownerPhone));
  const ownerEmail = readOptionalString(body.ownerEmail ?? body.email ?? body.customerEmail);
  const address = readOptionalString(body.address);
  const mode = readString(body.mode).toLowerCase() || "normal";

  const location = readNestedObject(body.location);
  const latitude =
    readNumber(body.lat) ??
    readNumber(body.latitude) ??
    readNumber(location.latitude) ??
    readNumber(location.lat);
  const longitude =
    readNumber(body.lng) ??
    readNumber(body.longitude) ??
    readNumber(location.longitude) ??
    readNumber(location.lng);

  const photos = readNestedObject(body.photos);
  const buildingPhoto =
    readOptionalString(body.buildingPhoto) ?? readOptionalString(photos.building);
  const machinePhoto =
    readOptionalString(body.machinePhoto) ?? readOptionalString(photos.machine);
  const summaryPhoto =
    readOptionalString(body.summaryPhoto) ?? readOptionalString(photos.summary);

  if (!ownerName) {
    return errorResponse("Thiếu tên chủ nhà");
  }

  if (!isValidVietnamPhone(ownerPhone)) {
    return errorResponse("Số điện thoại chủ nhà không hợp lệ");
  }

  if (latitude === null || longitude === null) {
    return errorResponse("Thiếu tọa độ GPS");
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return errorResponse("Tọa độ GPS không hợp lệ");
  }

  const isTestMode = readString(body.note).toLowerCase().includes("test");
  if (!isTestMode) {
    if (mode === "quick") {
      if (!summaryPhoto) {
        return errorResponse("Chế độ cực nhanh yêu cầu ảnh tóm tắt");
      }
    } else if (!buildingPhoto || !machinePhoto) {
      return errorResponse("Cần ảnh mặt tiền và ảnh vị trí máy");
    }
  }

  const finalBuildingPhoto = mode === "quick" ? summaryPhoto : buildingPhoto;
  const finalMachinePhoto = mode === "quick" ? summaryPhoto : machinePhoto;

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { phone: ownerPhone },
      create: {
        name: ownerName,
        phone: ownerPhone,
        email: ownerEmail,
        address,
      },
      update: {
        name: ownerName,
        ...(ownerEmail ? { email: ownerEmail } : {}),
        ...(address ? { address } : {}),
      },
    });

    const activation = await tx.activation.upsert({
      where: {
        machineId_step: {
          machineId,
          step: 1,
        },
      },
      create: {
        machineId,
        step: 1,
        ownerName,
        ownerPhone,
        note: readOptionalString(body.note) ?? `Chế độ kích hoạt: ${mode}`,
      },
      update: {
        ownerName,
        ownerPhone,
        note: readOptionalString(body.note) ?? `Chế độ kích hoạt: ${mode}`,
      },
    });

    const updatedMachine = await tx.machine.update({
      where: { id: machineId },
      data: {
        customerId: customer.id,
        lat: latitude,
        lng: longitude,
        buildingPhoto: finalBuildingPhoto,
        machinePhoto: finalMachinePhoto,
        status: "ACTIVATING",
      },
      include: {
        customer: true,
        activations: { orderBy: { step: "asc" } },
      },
    });

    await tx.adminLog.create({
      data: {
        action: "ACTIVATION_STEP_1_SAVED",
        target: machineId,
        detail: `Đã lưu bước 1 cho máy ${machineId}, khách hàng ${ownerPhone}`,
      },
    });

    return { activation, machine: updatedMachine };
  });

  return NextResponse.json({
    success: true,
    message: "Đã lưu kích hoạt bước 1",
    data: result,
  });
}

async function saveStepTwo(body: JsonObject, machineId: string, model: string) {
  const dealerCode = readString(body.dealerCode).toUpperCase();
  const installerName = readString(body.installerName);
  const installerPhone = normalizeVietnamPhone(readString(body.installerPhone));
  const installationDate = parseInstallationDate(
    body.installationDate ?? body.installDate,
  );
  const bankAccount = readString(body.bankAccount);
  const bankOwner = readString(body.bankOwner ?? body.accountHolder);
  const bankName = readString(body.bankName);
  const note = readOptionalString(body.note ?? body.ownerNote);

  if (!installationDate) {
    return errorResponse("Ngày lắp đặt không hợp lệ");
  }

  if (!dealerCode) {
    return errorResponse("Thiếu mã đại lý");
  }

  if (!installerName) {
    return errorResponse("Thiếu tên người lắp đặt");
  }

  if (!isValidVietnamPhone(installerPhone)) {
    return errorResponse("Số điện thoại người lắp không hợp lệ");
  }

  if (!bankAccount || !bankOwner || !bankName) {
    return errorResponse("Thiếu thông tin tài khoản nhận quà");
  }

  const [stepOne, dealer] = await Promise.all([
    prisma.activation.findUnique({
      where: {
        machineId_step: {
          machineId,
          step: 1,
        },
      },
      select: { id: true },
    }),
    prisma.dealer.findUnique({
      where: { dealerCode },
      select: { id: true, status: true, name: true, phone: true, email: true, dealerCode: true },
    }),
  ]);

  if (!stepOne) {
    return errorResponse("Phải hoàn thành kích hoạt bước 1 trước", 409);
  }

  if (!dealer) {
    return errorResponse("Mã đại lý không tồn tại", 404);
  }

  if (dealer.status !== "APPROVED") {
    return errorResponse("Đại lý chưa được duyệt", 409);
  }

  const status = machineStatusFromForm(body.machineStatus);
  const scheduleData = buildMaintenanceSchedules(machineId, installationDate, model);

  const result = await prisma.$transaction(async (tx) => {
    const activation = await tx.activation.upsert({
      where: {
        machineId_step: {
          machineId,
          step: 2,
        },
      },
      create: {
        machineId,
        step: 2,
        dealerCode,
        installerName,
        installerPhone,
        bankAccount,
        bankOwner,
        bankName,
        note,
      },
      update: {
        dealerCode,
        installerName,
        installerPhone,
        bankAccount,
        bankOwner,
        bankName,
        note,
      },
    });

    await tx.machine.update({
      where: { id: machineId },
      data: {
        installDate: installationDate,
        status,
      },
    });

    await tx.maintenanceSchedule.deleteMany({ where: { machineId } });
    await tx.maintenanceSchedule.createMany({ data: scheduleData });

    await tx.adminLog.create({
      data: {
        action: "ACTIVATION_COMPLETED",
        target: machineId,
        detail: `Hoàn tất kích hoạt máy ${machineId}, đại lý ${dealerCode}`,
      },
    });

    const completedMachine = await tx.machine.findUniqueOrThrow({
      where: { id: machineId },
      include: {
        customer: true,
        activations: { orderBy: { step: "asc" } },
        maintenanceSchedules: { orderBy: { dueDate: "asc" } },
      },
    });

    return { activation, machine: completedMachine };
  });

  await queueActivationCompletedNotifications({
    machineId,
    model,
    warrantyMonths: result.machine.warrantyMonths,
    installDate: result.machine.installDate,
    customer: result.machine.customer,
    dealer,
    installerName,
    installerPhone,
    maintenanceCount: scheduleData.length,
  });

  return NextResponse.json({
    success: true,
    message: scheduleData.length
      ? "Kích hoạt máy thành công và đã sinh lịch bảo trì"
      : "Kích hoạt máy thành công. Model này chưa cấu hình lịch bảo trì tự động.",
    data: result,
  });
}
