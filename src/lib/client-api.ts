export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: unknown;
};

/**
 * Parse an API response without exposing JSON.parse errors such as
 * "Unexpected end of JSON input" to the operator.
 */
export async function readApiResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const raw = await response.text();
  const text = raw.trim();

  if (!text) {
    throw new Error(
      response.ok
        ? "Máy chủ không trả về dữ liệu. Hãy tải lại trang hoặc kiểm tra API."
        : `Máy chủ trả lỗi HTTP ${response.status} nhưng không có nội dung phản hồi.`,
    );
  }

  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    const looksLikeHtml = /^<!doctype html|^<html/i.test(text);
    throw new Error(
      looksLikeHtml
        ? `Máy chủ trả về trang lỗi HTTP ${response.status} thay vì dữ liệu JSON. Hãy kiểm tra log triển khai và cập nhật cơ sở dữ liệu.`
        : `Phản hồi từ máy chủ không đúng định dạng JSON (HTTP ${response.status}).`,
    );
  }
}
