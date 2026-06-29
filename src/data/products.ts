import type { IconName } from "@/components/ui/Icon";

export type ProductPlanItem = {
  title: string;
  monthsAfterInstallation?: number;
  daysAfterInstallation?: number;
  customerCare?: boolean;
};

export type KosovotaProduct = {
  slug: string;
  modelCode: string;
  aliases: string[];
  name: string;
  category: string;
  tagline: string;
  description: string;
  icon: IconName;
  accent: string;
  highlights: string[];
  maintenancePlan: ProductPlanItem[];
};

export const PRODUCTS: KosovotaProduct[] = [
  {
    slug: "may-loc-nuoc-ro-gia-dinh",
    modelCode: "RO_UNDER_30",
    aliases: ["RO_GIA_DINH", "RO", "RO_UNDER_30", "MAY_RO_DUOI_30L"],
    name: "Máy lọc nước RO gia đình dưới 30L/h",
    category: "Gia đình",
    tagline: "Dòng máy RO được quản lý trọn vòng đời bằng QR định danh.",
    description:
      "Phù hợp cho nhu cầu nước uống trực tiếp tại gia đình, được kích hoạt bảo hành, lưu lịch sử dịch vụ và tự động nhắc thay lõi trên KOSOVOTA Service Cloud.",
    icon: "droplet",
    accent: "from-emerald-500 to-teal-700",
    highlights: [
      "QR định danh riêng cho từng máy",
      "Theo dõi lịch thay lõi 3, 6, 9, 12 và 24 tháng",
      "Lưu ảnh lắp đặt, bảo hành và báo cáo dịch vụ",
    ],
    maintenancePlan: [
      { title: "Tặng quà kích hoạt bảo hành", daysAfterInstallation: 4, customerCare: true },
      { title: "Chăm sóc trải nghiệm sản phẩm", monthsAfterInstallation: 1, customerCare: true },
      { title: "Thay lõi số 1", monthsAfterInstallation: 3 },
      { title: "Thay lõi 1,2,3", monthsAfterInstallation: 6 },
      { title: "Thay lõi số 1", monthsAfterInstallation: 9 },
      { title: "Thay lõi 1,2,3 và lõi chức năng 5,6,7,8,9", monthsAfterInstallation: 12 },
      { title: "Thay lõi 1,2,3 và màng RO", monthsAfterInstallation: 24 },
    ],
  },
  {
    slug: "may-loc-nuoc-nong-lanh-bcn",
    modelCode: "BCN_HOT_COLD",
    aliases: ["BCN", "BCN_NONG_LANH", "BCN_HOT_COLD"],
    name: "Máy lọc nước nóng lạnh BCN",
    category: "Nóng lạnh",
    tagline: "Một thiết bị, đồng bộ vận hành nóng lạnh và lịch bảo trì lõi lọc.",
    description:
      "Dòng máy BCN nóng lạnh được quản lý theo seri, vị trí lắp đặt và lịch chăm sóc định kỳ để đại lý xử lý nhanh các yêu cầu thay lõi, bảo hành và sửa chữa.",
    icon: "activity",
    accent: "from-sky-500 to-blue-800",
    highlights: [
      "Quản lý vị trí máy và thông tin khách hàng",
      "Theo dõi lõi 1,2,3, lõi T33 và màng RO",
      "Điều phối đại lý kỹ thuật gần nhất",
    ],
    maintenancePlan: [
      { title: "Tặng quà kích hoạt bảo hành", daysAfterInstallation: 4, customerCare: true },
      { title: "Chăm sóc trải nghiệm sản phẩm", monthsAfterInstallation: 1, customerCare: true },
      { title: "Thay lõi 1,2,3", monthsAfterInstallation: 3 },
      { title: "Thay lõi 1,2,3", monthsAfterInstallation: 6 },
      { title: "Thay lõi 1,2,3", monthsAfterInstallation: 9 },
      { title: "Thay lõi 1,2,3 và lõi T33", monthsAfterInstallation: 12 },
      { title: "Thay lõi 1,2,3, lõi T33 và màng RO", monthsAfterInstallation: 24 },
    ],
  },
  {
    slug: "may-bcn-co-cot-loc",
    modelCode: "BCN_COLUMN",
    aliases: ["BCN_CO_COT_LOC", "BCN_COLUMN", "BCN_COLUMN_FILTER"],
    name: "Máy BCN có cột lọc",
    category: "BCN tích hợp",
    tagline: "Giải pháp BCN tích hợp cột lọc với lịch chăm sóc riêng theo cấu hình.",
    description:
      "Hệ thống theo dõi lõi 1,2, lõi T33 và màng RO theo đúng chu kỳ, đồng thời lưu toàn bộ ảnh báo cáo trước và sau khi đại lý thực hiện dịch vụ.",
    icon: "package",
    accent: "from-cyan-500 to-indigo-700",
    highlights: [
      "Lịch thay lõi riêng cho cấu hình có cột lọc",
      "Ảnh xác thực lõi cũ, lõi mới và máy hoàn thành",
      "Cảnh báo sắp đến hạn và quá hạn trên bản đồ",
    ],
    maintenancePlan: [
      { title: "Tặng quà kích hoạt bảo hành", daysAfterInstallation: 4, customerCare: true },
      { title: "Chăm sóc trải nghiệm sản phẩm", monthsAfterInstallation: 1, customerCare: true },
      { title: "Thay lõi 1,2", monthsAfterInstallation: 3 },
      { title: "Thay lõi 1,2", monthsAfterInstallation: 6 },
      { title: "Thay lõi 1,2", monthsAfterInstallation: 9 },
      { title: "Thay lõi 1,2 và lõi T33", monthsAfterInstallation: 12 },
      { title: "Thay lõi 1,2, lõi T33 và màng RO", monthsAfterInstallation: 24 },
    ],
  },
  {
    slug: "ban-lay-nuoc-cong-cong",
    modelCode: "WATER_STATION",
    aliases: ["BC04-U", "BC06-U", "BAN_LAY_NUOC_4_VOI", "BAN_LAY_NUOC_6_VOI"],
    name: "Bàn lấy nước công cộng",
    category: "Bàn cấp nước",
    tagline: "Quản lý seri, vị trí lắp đặt và lịch sử sửa chữa của bàn lấy nước.",
    description:
      "Dòng BC04-U và BC06-U được lưu đúng thông tin seri và dung tích. Lịch thay lõi không tự sinh từ bàn lấy nước để tránh áp sai chu kỳ của hệ thống lọc nguồn.",
    icon: "package",
    accent: "from-cyan-500 to-sky-800",
    highlights: [
      "Hỗ trợ model BC04-U và BC06-U",
      "Lưu dung tích 240L hoặc 320L từ file seri",
      "Không tự áp lịch lõi lọc sai thiết bị",
    ],
    maintenancePlan: [],
  },
  {
    slug: "he-thong-loc-nuoc-cong-nghiep",
    modelCode: "INDUSTRIAL",
    aliases: ["CN", "CONG_NGHIEP", "INDUSTRIAL", "HE_THONG_CONG_NGHIEP", "HT100-RU", "HT250-RU", "HT350-RU"],
    name: "Hệ thống lọc nước công nghiệp",
    category: "Công nghiệp",
    tagline: "Quản lý thiết bị, vật tư và lịch dịch vụ cho hệ thống công suất lớn.",
    description:
      "Dòng hệ thống công nghiệp được quản lý theo điểm lắp đặt, lịch thay lõi PP 20 inch, màng RO và vật liệu lọc; phù hợp cho điều phối đội kỹ thuật theo khu vực.",
    icon: "building",
    accent: "from-slate-600 to-slate-950",
    highlights: [
      "Theo dõi lõi PP 20 inch, màng RO và vật liệu lọc",
      "Quản lý lịch sử sửa chữa theo từng hệ thống",
      "Điều phối đại lý có đúng năng lực kỹ thuật",
    ],
    maintenancePlan: [
      { title: "Tặng quà kích hoạt bảo hành", daysAfterInstallation: 4, customerCare: true },
      { title: "Chăm sóc trải nghiệm sản phẩm", monthsAfterInstallation: 1, customerCare: true },
      { title: "Thay lõi PP 20 inch", monthsAfterInstallation: 6 },
      { title: "Thay lõi PP 20 inch", monthsAfterInstallation: 12 },
      { title: "Thay lõi PP 20 inch, màng RO và vật liệu lọc", monthsAfterInstallation: 24 },
    ],
  },
];

export const CONSUMABLE_PRODUCTS = [
  {
    slug: "bo-loi-thay-the-kosovota",
    name: "Bộ lõi thay thế KOSOVOTA",
    category: "Vật tư định kỳ",
    icon: "package",
    description: "Lõi 1,2,3, lõi chức năng, lõi T33 và màng RO được ghi nhận theo từng lần dịch vụ.",
  },
  {
    slug: "vat-lieu-loc-tong",
    name: "Vật liệu lọc tổng",
    category: "Vật tư hệ thống",
    icon: "settings",
    description: "Vật liệu và lõi PP 20 inch dành cho hệ thống lọc tổng, BCN và công nghiệp.",
  },
] as const;

export function findProductBySlug(slug: string) {
  return PRODUCTS.find((product) => product.slug === slug);
}

const UNKNOWN_PRODUCT: KosovotaProduct = {
  slug: "thiet-bi-chua-phan-loai",
  modelCode: "UNKNOWN",
  aliases: [],
  name: "Thiết bị KOSOVOTA",
  category: "Chưa phân loại",
  tagline: "Thiết bị chưa được cấu hình chu kỳ bảo trì.",
  description: "Admin cần bổ sung model và chu kỳ bảo trì trước khi hệ thống tự sinh lịch.",
  icon: "settings",
  accent: "from-slate-500 to-slate-800",
  highlights: ["Không tự sinh lịch bảo trì sai model"],
  maintenancePlan: [],
};

export function findProductByModel(model: string) {
  const normalized = model.trim().toUpperCase();
  return (
    PRODUCTS.find(
      (product) =>
        product.modelCode === normalized ||
        product.aliases.some((alias) => alias.toUpperCase() === normalized),
    ) ?? UNKNOWN_PRODUCT
  );
}
