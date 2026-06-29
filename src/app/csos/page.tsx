"use client";

import { useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";

type TaskStatus =
  | "NEW"
  | "CALLED_NO_ANSWER"
  | "CUSTOMER_ACCEPTED"
  | "CUSTOMER_SELF_SERVICE"
  | "CUSTOMER_REJECTED"
  | "RESCHEDULED"
  | "COMPLAINT"
  | "ASSIGNED"
  | "COMPLETED";

type ServiceOrder = {
  id: string;
  orderCode: string;
  machineId: string;
  customerName: string;
  customerPhone: string;
  address?: string | null;
  serviceType: string;
  status: TaskStatus;
  dueDate?: string | null;
  reports?: {
  id: string;
  products?: string | null;
  oldCorePhoto?: string | null;
  newCorePhoto?: string | null;
  finalPhoto?: string | null;
  note?: string | null;
}[];
};

type SosTicket = {
  id: string;
  machineId: string;
  customerName: string;
  customerPhone: string;
  address?: string | null;
  note?: string | null;
  status: string;
  priority: string;
  createdAt: string;
};

type Dealer = {
  id: string;
  dealerCode: string;
  name: string;
  phone: string;
  services?: string | null;
  distanceKm?: number;
};

const statuses: { value: TaskStatus; label: string }[] = [
  { value: "NEW", label: "Chờ xử lý" },
  { value: "CALLED_NO_ANSWER", label: "Đã gọi – chưa liên lạc được" },
  { value: "CUSTOMER_ACCEPTED", label: "KH đồng ý + dịch vụ" },
  { value: "CUSTOMER_SELF_SERVICE", label: "KH tự thay" },
  { value: "CUSTOMER_REJECTED", label: "KH từ chối" },
  { value: "RESCHEDULED", label: "Hẹn lại ngày khác" },
  { value: "COMPLAINT", label: "Khiếu nại" },
  { value: "ASSIGNED", label: "Đã giao đại lý" },
  { value: "COMPLETED", label: "Hoàn thành" },
];


function toDateOnly(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleDateString("vi-VN");
}

function todayOnly() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function CsosPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [sosTickets, setSosTickets] = useState<SosTicket[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "week" | "done">("all");
  const [loading, setLoading] = useState(true);
  const [viewReportOrder, setViewReportOrder] = useState<ServiceOrder | null>(null);

  async function loadOrders() {
    setLoading(true);

    const res = await fetch("/api/service-orders", {
      cache: "no-store",
    });

    const json = await res.json();

    if (json.success) {
      setOrders(json.data);
    }
    const sosRes = await fetch("/api/sos-tickets", {
  cache: "no-store",
});

const sosJson = await sosRes.json();

if (sosJson.success) {
  setSosTickets(sosJson.data);
}

    setLoading(false);
  }

  useEffect(() => {
  loadOrders();

  const interval = setInterval(() => {
    loadOrders();
  }, 30000);

  return () => clearInterval(interval);
}, []);

  async function updateStatus(orderId: string, status: TaskStatus) {
    const res = await fetch(`/api/service-orders/${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const json = await res.json();

    if (json.success) {
      await loadOrders();
    } else {
      alert(json.message || "Không cập nhật được trạng thái");
    }
  }

  async function openDealerShortlist(order: ServiceOrder) {
    setSelectedOrder(order);
    setDealers([]);

    const res = await fetch("/api/dealers/shortlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machineId: order.machineId, serviceType: order.serviceType, limit: 10 }),
    });

    const json = await res.json();

    if (json.success) {
      setDealers(json.data);
    } else {
      alert(json.message || "Không tìm được đại lý gần nhất");
    }
  }

async function createOrderFromSos(ticket: SosTicket) {
  const ok = confirm("Tạo lệnh sửa chữa khẩn cấp từ SOS này?");
  if (!ok) return;

  const res = await fetch("/api/service-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      machineId: ticket.machineId,
      customerName: ticket.customerName,
      customerPhone: ticket.customerPhone,
      address: ticket.address,
      serviceType: "SOS - Máy hỏng cần sửa ngay",
      status: "NEW",
      dueDate: new Date().toISOString(),
    }),
  });

  const json = await res.json();

  if (!json.success) {
    alert(json.message || "Không tạo được lệnh SOS");
    return;
  }

  await fetch(`/api/sos-tickets/${ticket.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "ORDER_CREATED",
    }),
  });

  alert("Đã tạo lệnh sửa chữa khẩn cấp");
  await loadOrders();
}
 
   
  async function generateTodayOrders() {
  const ok = confirm(
    "Sinh lệnh dịch vụ từ các lịch bảo trì đã đến hạn?"
  );

  if (!ok) return;

  const res = await fetch("/api/maintenance-schedules/generate-orders", {
    method: "POST",
  });

  const json = await res.json();

  if (json.success) {
    alert(json.message || "Đã sinh lệnh");
    await loadOrders();
  } else {
    alert(json.message || "Không sinh được lệnh");
  }
}

  async function assignDealer(dealer: Dealer) {
    if (!selectedOrder) return;

    const res = await fetch("/api/service-orders/assign-dealer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: selectedOrder.id,
        dealerId: dealer.id,
      }),
    });

    const json = await res.json();

    if (json.success) {
      alert(`Đã giao lệnh cho ${dealer.name}`);
      setSelectedOrder(null);
      setDealers([]);
      await loadOrders();
    } else {
      alert(json.message || "Không giao được đại lý");
    }
  }

  const counts = useMemo(() => {
    const today = todayOnly();
    const week = addDays(7);

    return {
      overdue: orders.filter(
        (o) => toDateOnly(o.dueDate) < today && o.status !== "COMPLETED",
      ).length,
      today: orders.filter(
        (o) => toDateOnly(o.dueDate) === today && o.status !== "COMPLETED",
      ).length,
      week: orders.filter((o) => {
        const d = toDateOnly(o.dueDate);
        return d >= today && d <= week && o.status !== "COMPLETED";
      }).length,
      done: orders.filter((o) => o.status === "COMPLETED").length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const today = todayOnly();
    const week = addDays(7);

    return orders.filter((order) => {
      const d = toDateOnly(order.dueDate);

      const matchSearch =
        !keyword ||
        order.machineId.toLowerCase().includes(keyword) ||
        order.customerName.toLowerCase().includes(keyword) ||
        order.customerPhone.includes(keyword) ||
        order.orderCode.toLowerCase().includes(keyword);

      if (!matchSearch) return false;

      if (filter === "overdue") return d < today && order.status !== "COMPLETED";
      if (filter === "today") return d === today && order.status !== "COMPLETED";
      if (filter === "week") return d >= today && d <= week && order.status !== "COMPLETED";
      if (filter === "done") return order.status === "COMPLETED";

      return true;
    });
  }, [orders, search, filter]);

  return (
    <main className="min-h-screen bg-slate-100">
      <OperationsHeader title="Hệ điều hành CSOS" subtitle="Lịch chăm sóc, cuộc gọi, SOS và điều phối dịch vụ" />

      <div className="mx-auto max-w-[1480px] space-y-6 p-4 sm:p-5">
        <label className="relative block surface-card p-3"><Icon name="search" size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"/><input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm số điện thoại, tên khách hàng, mã lệnh hoặc ID máy..."
          className="w-full bg-white pl-11"
        /></label>

        {sosTickets.filter((t) => t.status === "NEW").length > 0 && (
  <section className="rounded-2xl border-2 border-red-500 bg-red-50 p-5">
    <h2 className="mb-4 text-xl font-black text-red-700">
      SOS KHẨN CẤP
    </h2>

    <div className="space-y-3">
      {sosTickets
        .filter((ticket) => ticket.status === "NEW")
        .map((ticket) => (
          <div
            key={ticket.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm"
          >
            <div>
              <p className="font-black text-red-700">
                {ticket.machineId} - {ticket.customerName}
              </p>
              <p className="text-sm">
                SĐT:{" "}
                <a
                  href={`tel:${ticket.customerPhone}`}
                  className="font-bold text-blue-600 underline"
                >
                  {ticket.customerPhone}
                </a>
              </p>
              <p className="text-sm">Địa chỉ: {ticket.address || "Chưa có"}</p>
              <p className="text-sm">Lỗi: {ticket.note || "Khách không nhập"}</p>
            </div>

            <button type="button"
              onClick={() => createOrderFromSos(ticket)}
              className="rounded-xl bg-red-600 px-5 py-3 font-black text-white"
            >
              TẠO LỆNH KHẨN
            </button>
          </div>
        ))}
    </div>
  </section>
)}


        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button type="button" onClick={() => setFilter("overdue")} className="rounded-2xl bg-red-600 p-5 text-left text-white">
            <p className="text-sm font-bold">QUÁ HẠN</p>
            <p className="text-4xl font-black">{counts.overdue}</p>
          </button>

          <button type="button" onClick={() => setFilter("today")} className="rounded-2xl bg-yellow-400 p-5 text-left text-slate-900">
            <p className="text-sm font-bold">HÔM NAY</p>
            <p className="text-4xl font-black">{counts.today}</p>
          </button>

          <button type="button" onClick={() => setFilter("week")} className="rounded-2xl bg-purple-600 p-5 text-left text-white">
            <p className="text-sm font-bold">TUẦN NÀY</p>
            <p className="text-4xl font-black">{counts.week}</p>
          </button>

          <button type="button" onClick={() => setFilter("done")} className="rounded-2xl bg-green-600 p-5 text-left text-white">
            <p className="text-sm font-bold">HOÀN THÀNH</p>
            <p className="text-4xl font-black">{counts.done}</p>
          </button>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
  <p className="font-bold text-slate-700">
    Hiển thị: {filteredOrders.length} lệnh
  </p>

  <div className="flex flex-wrap gap-2">
    <button type="button"
      onClick={generateTodayOrders}
      className="rounded-xl bg-green-600 px-5 py-2 font-bold text-white"
    >
      SINH LỆNH HÔM NAY
    </button>

    <button type="button"
      onClick={() => setFilter("all")}
      className="rounded-xl border bg-white px-5 py-2 font-bold"
    >
      HIỆN TẤT CẢ
    </button>
  </div>
</div>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1150px] w-full text-sm">
              <thead className="bg-slate-800 text-left text-white">
                <tr>
                  <th className="p-4">STT</th>
                  <th className="p-4">Ngày</th>
                  <th className="p-4">Mã lệnh</th>
                  <th className="p-4">ID máy</th>
                  <th className="p-4">Khách hàng</th>
                  <th className="p-4">SĐT</th>
                  <th className="p-4">Dịch vụ</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4">Hành động</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-6" colSpan={9}>
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td className="p-6" colSpan={9}>
                      Chưa có lệnh dịch vụ.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, index) => (
                    <tr key={order.id} className="border-b">
                      <td className="p-4">{index + 1}</td>
                      <td className="p-4 font-semibold">{formatDate(order.dueDate)}</td>
                      <td className="p-4 font-bold">{order.orderCode}</td>
                      <td className="p-4 font-bold text-green-700">{order.machineId}</td>
                      <td className="p-4">{order.customerName}</td>
                      <td className="p-4">
                        <a className="font-bold text-blue-600 underline" href={`tel:${order.customerPhone}`}>
                          {order.customerPhone}
                        </a>
                      </td>
                      <td className="p-4">{order.serviceType}</td>
                      <td className="p-4">
                        <select
                          value={order.status}
                          onChange={(e) =>
                            updateStatus(order.id, e.target.value as TaskStatus)
                          }
                          className="rounded-lg border px-3 py-2"
                        >
                          {statuses.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="space-x-2 p-4">
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="rounded-lg bg-blue-600 px-3 py-2 font-bold text-white"
                        >
                          Gọi
                        </a>

                        <button type="button"
                          onClick={() => openDealerShortlist(order)}
                          className="rounded-lg bg-green-600 px-3 py-2 font-bold text-white"
                        >
                          Tìm đại lý
                        </button>
                        {order.reports && order.reports.length > 0 && (
  <button type="button"
    onClick={() => setViewReportOrder(order)}
    className="rounded-lg bg-purple-600 px-3 py-2 font-bold text-white"
  >
    Xem báo cáo
  </button>
)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {viewReportOrder && viewReportOrder.reports && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-black">
          Báo cáo dịch vụ - {viewReportOrder.orderCode}
        </h2>

        <button type="button"
          onClick={() => setViewReportOrder(null)}
          className="rounded-lg border px-4 py-2 font-bold"
        >
          Đóng
        </button>
      </div>

      <div className="space-y-6">
        {viewReportOrder.reports.map((report) => (
          <div key={report.id} className="rounded-2xl border p-4">
            <p className="font-bold">
              Sản phẩm thay thế: {report.products || "Chưa có"}
            </p>

            <p className="mt-1 text-sm text-slate-600">
              Ghi chú: {report.note || "Không có"}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {report.oldCorePhoto && (
                <div>
                  <p className="mb-1 font-bold">Ảnh lõi cũ</p>
                  <img
                    src={report.oldCorePhoto}
                    alt="Ảnh lõi cũ"
                    className="h-48 w-full rounded-xl object-cover"
                  />
                </div>
              )}

              {report.newCorePhoto && (
                <div>
                  <p className="mb-1 font-bold">Ảnh lõi mới</p>
                  <img
                    src={report.newCorePhoto}
                    alt="Ảnh lõi mới"
                    className="h-48 w-full rounded-xl object-cover"
                  />
                </div>
              )}

              {report.finalPhoto && (
                <div>
                  <p className="mb-1 font-bold">Ảnh hoàn thành</p>
                  <img
                    src={report.finalPhoto}
                    alt="Ảnh hoàn thành"
                    className="h-48 w-full rounded-xl object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black">
                Chọn đại lý cho {selectedOrder.orderCode}
              </h2>

              <button type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg border px-4 py-2 font-bold"
              >
                Đóng
              </button>
            </div>

            {dealers.length === 0 ? (
              <p>Không có đại lý phù hợp hoặc máy chưa có tọa độ.</p>
            ) : (
              <div className="space-y-3">
                {dealers.map((dealer) => (
                  <div
                    key={dealer.id}
                    className="flex items-center justify-between gap-4 rounded-xl border p-4"
                  >
                    <div>
                      <p className="font-black">
                        {dealer.dealerCode} - {dealer.name}
                      </p>
                      <p className="text-sm text-slate-600">
                        SĐT: {dealer.phone}
                      </p>
                      <p className="text-sm text-slate-600">
                        Dịch vụ: {dealer.services || "Chưa cập nhật"}
                      </p>
                      <p className="text-sm font-bold text-green-700">
                        Khoảng cách: {dealer.distanceKm ?? "?"} km
                      </p>
                    </div>

                    <button type="button"
                      onClick={() => assignDealer(dealer)}
                      className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white"
                    >
                      CHỌN
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}