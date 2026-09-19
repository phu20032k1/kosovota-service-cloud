import { NextRequest, NextResponse } from "next/server";
import { PRODUCTS } from "@/data/products";
import { hasRole } from "@/lib/auth";
import {
  getMaintenancePlanConfig,
  saveMaintenancePlanConfig,
} from "@/lib/maintenance-config";

const EDITABLE_MODELS = new Set(["RO_UNDER_30", "BCN_HOT_COLD", "BCN_COLUMN", "INDUSTRIAL"]);

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  const products = PRODUCTS.filter((product) => EDITABLE_MODELS.has(product.modelCode));
  const data = await Promise.all(products.map(async (product) => ({
    ...(await getMaintenancePlanConfig(product.modelCode)),
    name: product.name,
    category: product.category,
  })));
  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

  try {
    const body = await request.json();
    const modelCode = typeof body.modelCode === "string" ? body.modelCode.trim().toUpperCase() : "";
    if (!EDITABLE_MODELS.has(modelCode)) {
      return NextResponse.json({ success: false, message: "Model không hợp lệ." }, { status: 400 });
    }

    const result = await saveMaintenancePlanConfig({
      modelCode,
      items: body.items,
      userId: auth.user.id,
      applyExisting: body.applyExisting !== false,
    });

    return NextResponse.json({
      success: true,
      message: body.applyExisting === false
        ? "Đã lưu chu kỳ mới cho các máy kích hoạt sau."
        : `Đã lưu chu kỳ và cập nhật ${result.recreatedSchedules} lịch tương lai của ${result.affectedMachines} máy.`,
      data: result,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Không lưu được cấu hình chu kỳ.",
    }, { status: 400 });
  }
}
