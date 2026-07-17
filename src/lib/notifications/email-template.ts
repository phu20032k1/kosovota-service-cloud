export function renderEmailHtml(input: { title: string; content: string; footer?: string }) {
  const safeTitle = escapeHtml(input.title);
  const safeContent = escapeHtml(input.content).replace(/\n/g, "<br />");
  const footer = escapeHtml(input.footer || "KOSO VOTA Service Cloud");
  return `
  <div style="margin:0;background:#f6f8fb;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#0f766e;color:#ffffff;padding:22px 26px">
        <h1 style="margin:0;font-size:22px;line-height:1.35">${safeTitle}</h1>
      </div>
      <div style="padding:26px;font-size:15px;line-height:1.7">
        ${safeContent}
      </div>
      <div style="padding:18px 26px;background:#f8fafc;color:#64748b;font-size:12px">
        ${footer}
      </div>
    </div>
  </div>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
