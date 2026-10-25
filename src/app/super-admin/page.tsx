import { UserManagementConsole } from "@/components/UserManagementConsole";

export default function SuperAdminPage() {
  return (
    <>
      <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
          CSKH hiện vận hành Toàn quốc. Phạm vi tỉnh cũ chỉ được giữ làm dữ liệu tham chiếu và không giới hạn quyền truy cập.
        </div>
      </div>
      <UserManagementConsole mode="super" />
    </>
  );
}
