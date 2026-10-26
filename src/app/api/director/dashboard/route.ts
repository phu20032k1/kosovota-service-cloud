import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function labelMonth(date: Date) { return `T${date.getMonth() + 1}/${String(date.getFullYear()).slice(-2)}`; }
function normalize(value?: string | null) { return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase().replace(/[^a-z0-9]/g, ""); }

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["DIRECTOR"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Giám đốc được xem báo cáo này." }, { status: 403 });

  try {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthDates = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - (5 - index), 1));

    const [
      machines,
      dealers,
      schedules,
      orders,
      reports,
      satisfaction,
      customers,
    ] = await Promise.all([
      prisma.machine.findMany({
        select: { id: true, model: true, status: true, provinceCode: true, lat: true, lng: true, installDate: true, customerId: true, customer: { select: { name: true, phone: true, address: true } } },
      }),
      prisma.dealer.findMany({ where: { status: "APPROVED" }, select: { id: true, dealerCode: true, name: true, province: true, lat: true, lng: true, rating: true } }),
      prisma.maintenanceSchedule.findMany({ select: { id: true, machineId: true, dueDate: true, status: true, updatedAt: true } }),
      prisma.serviceOrder.findMany({ where: { createdAt: { gte: trendStart } }, select: { id: true, machineId: true, status: true, serviceFee: true, createdAt: true, updatedAt: true } }),
      prisma.serviceReport.findMany({ where: { createdAt: { gte: trendStart } }, select: { id: true, createdAt: true } }),
      prisma.customer.aggregate({ _avg: { satisfaction: true }, _count: { satisfaction: true } }),
      prisma.customer.findMany({ select: { id: true, address: true, phone: true } }),
    ]);

    const customerMachines = machines.filter((machine) => machine.customerId);
    const completedSchedules = schedules.filter((schedule) => schedule.status === "COMPLETED");
    const onTimeSchedules = completedSchedules.filter((schedule) => schedule.updatedAt.getTime() <= schedule.dueDate.getTime());
    const onTimeRate = completedSchedules.length ? Math.round(onTimeSchedules.length / completedSchedules.length * 1000) / 10 : 0;
    const overdueSchedules = schedules.filter((schedule) => schedule.status !== "COMPLETED" && schedule.dueDate < now);
    const completedOrdersMonth = orders.filter((order) => order.status === "COMPLETED" && order.updatedAt >= startMonth);
    const serviceValueMonth = completedOrdersMonth.reduce((sum, order) => sum + (order.serviceFee || 0), 0);

    const serviceProvinces = new Set(dealers.map((dealer) => normalize(dealer.province)).filter(Boolean));
    const outsideService = customerMachines.filter((machine) => {
      const province = normalize(machine.provinceCode);
      return province && !serviceProvinces.has(province);
    });

    const trend = monthDates.map((date) => {
      const key = monthKey(date);
      const monthlyOrders = orders.filter((order) => monthKey(order.createdAt) === key);
      return {
        key,
        label: labelMonth(date),
        created: monthlyOrders.length,
        completed: orders.filter((order) => order.status === "COMPLETED" && monthKey(order.updatedAt) === key).length,
        reports: reports.filter((report) => monthKey(report.createdAt) === key).length,
        value: orders.filter((order) => order.status === "COMPLETED" && monthKey(order.updatedAt) === key).reduce((sum, order) => sum + (order.serviceFee || 0), 0),
      };
    });

    const dueThisMonth = schedules.filter((schedule) => schedule.dueDate >= startMonth && schedule.dueDate <= now);
    const caredThisMonth = dueThisMonth.filter((schedule) => schedule.status === "COMPLETED");
    const monthOrders = orders.filter((order) => order.createdAt >= startMonth);
    const careFunnel = {
      due: dueThisMonth.length,
      cared: caredThisMonth.length,
      ordered: monthOrders.length,
      completed: completedOrdersMonth.length,
    };

    const dataHealth = {
      machinesMissingGps: customerMachines.filter((machine) => machine.lat == null || machine.lng == null).length,
      machinesMissingInstallDate: customerMachines.filter((machine) => !machine.installDate).length,
      machinesWithoutCustomer: machines.filter((machine) => !machine.customerId).length,
      customersMissingAddress: customers.filter((customer) => !customer.address?.trim()).length,
      dealersMissingGps: dealers.filter((dealer) => dealer.lat == null || dealer.lng == null).length,
    };

    const provinceMap = new Map<string, number>();
    for (const machine of customerMachines) {
      const province = machine.provinceCode || "Chưa xác định";
      provinceMap.set(province, (provinceMap.get(province) || 0) + 1);
    }
    const provinces = [...provinceMap.entries()].map(([province, count]) => ({ province, count })).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          managedMachines: customerMachines.length,
          onTimeRate,
          overdueSchedules: overdueSchedules.length,
          completedOrdersMonth: completedOrdersMonth.length,
          serviceValueMonth,
          satisfaction: satisfaction._avg.satisfaction || 0,
          satisfactionResponses: satisfaction._count.satisfaction,
          activeDealers: dealers.length,
          outsideService: outsideService.length,
        },
        trend,
        careFunnel,
        dataHealth,
        provinces,
        map: {
          machines: customerMachines.filter((machine) => machine.lat != null && machine.lng != null).map((machine) => ({ id: machine.id, model: machine.model, provinceCode: machine.provinceCode, lat: machine.lat, lng: machine.lng, customerName: machine.customer?.name || "Chưa có khách" })),
          dealers: dealers.filter((dealer) => dealer.lat != null && dealer.lng != null).map((dealer) => ({ id: dealer.id, dealerCode: dealer.dealerCode, name: dealer.name, province: dealer.province, lat: dealer.lat, lng: dealer.lng, rating: dealer.rating })),
        },
      },
    });
  } catch (error) {
    console.error("director dashboard failed", error);
    return NextResponse.json({ success: false, message: "Không tải được báo cáo Giám đốc." }, { status: 500 });
  }
}
