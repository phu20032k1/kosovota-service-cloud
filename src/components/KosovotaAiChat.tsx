"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const INTRO_MESSAGE = `Tớ là A.I KOSOVOTA. Tớ có thể:

• Tra cứu thông tin máy, số serial và thời hạn bảo hành.
• Hướng dẫn sử dụng, vệ sinh và bảo trì thiết bị.
• Hỗ trợ kiểm tra các lỗi cơ bản của máy.
• Hướng dẫn tạo và theo dõi yêu cầu sửa chữa.
• Hỗ trợ kiểm tra lịch bảo trì định kỳ.
• Tìm đại lý hoặc trung tâm dịch vụ KOSOVOTA.
• Hỗ trợ thao tác trên hệ thống quản lý KOSOVOTA.

Bạn cần tớ hỗ trợ việc gì?`;

const SUGGESTIONS = [
  "Kiểm tra bảo hành",
  "Máy đang gặp lỗi",
  "Hướng dẫn bảo trì",
  "Tìm trung tâm dịch vụ",
];

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function getLocalReply(question: string) {
  const text = normalizeText(question);

  const greetingWords = [
    "chao",
    "xin chao",
    "hello",
    "hi",
    "alo",
    "hey",
  ];

  if (greetingWords.some((word) => text.includes(word))) {
    return INTRO_MESSAGE;
  }

  if (
    text.includes("bao hanh") ||
    text.includes("serial") ||
    text.includes("thoi han bao hanh")
  ) {
    return `Để kiểm tra bảo hành, bạn hãy gửi cho tớ:

• Số serial của máy.
• Mã sản phẩm hoặc tên dòng máy.
• Số điện thoại khách hàng nếu có.

Tính năng tra cứu tự động sẽ hoạt động sau khi hệ thống được kết nối với cơ sở dữ liệu máy và bảo hành.`;
  }

  if (
    text.includes("bao tri") ||
    text.includes("ve sinh") ||
    text.includes("bao duong")
  ) {
    return `Tớ có thể hỗ trợ bảo trì thiết bị theo các bước:

1. Kiểm tra tình trạng hoạt động của máy.
2. Vệ sinh các bộ phận theo hướng dẫn.
3. Kiểm tra linh kiện cần thay thế.
4. Kiểm tra lịch bảo trì gần nhất.
5. Tạo lịch bảo trì tiếp theo.

Bạn hãy gửi tên máy hoặc số serial để tớ hướng dẫn cụ thể hơn.`;
  }

  if (
    text.includes("loi") ||
    text.includes("hong") ||
    text.includes("sua chua") ||
    text.includes("khong hoat dong") ||
    text.includes("khong chay")
  ) {
    return `Tớ sẽ hỗ trợ kiểm tra lỗi máy. Bạn hãy cung cấp:

• Tên hoặc model máy.
• Số serial.
• Hiện tượng đang gặp.
• Mã lỗi hiển thị trên máy nếu có.
• Ảnh hoặc video tình trạng máy nếu có.

Nếu lỗi không thể xử lý từ xa, tớ sẽ hướng dẫn tạo yêu cầu kỹ thuật.`;
  }

  if (
    text.includes("dai ly") ||
    text.includes("trung tam") ||
    text.includes("ky thuat vien") ||
    text.includes("noi sua")
  ) {
    return `Tớ có thể giúp bạn tìm đại lý hoặc trung tâm dịch vụ gần nhất.

Bạn hãy cho tớ biết tỉnh/thành phố và quận/huyện hiện tại. Ví dụ:

"Hà Nội, quận Cầu Giấy"

Khi dịch vụ bản đồ được cấu hình, tớ sẽ tìm trên dữ liệu đại lý và vị trí KOSOVOTA.`;
  }

  if (
    text.includes("dang nhap") ||
    text.includes("tai khoan") ||
    text.includes("mat khau") ||
    text.includes("otp")
  ) {
    return `Tớ có thể hỗ trợ vấn đề đăng nhập như:

• Không nhận được mã OTP.
• Quên mật khẩu.
• Tài khoản bị khóa.
• Không truy cập được trang quản trị.
• Kiểm tra quyền của tài khoản.

Bạn hãy mô tả lỗi hoặc gửi nội dung thông báo đang xuất hiện.`;
  }

  if (
    text.includes("chuc nang") ||
    text.includes("lam duoc gi") ||
    text.includes("giup duoc gi")
  ) {
    return INTRO_MESSAGE;
  }

  return `Tớ đã nhận được câu hỏi của bạn.

Tớ chưa tìm thấy dữ liệu phù hợp. Bạn có thể hỏi theo một trong các nội dung:

• Kiểm tra bảo hành máy.
• Máy đang gặp lỗi.
• Hướng dẫn bảo trì.
• Tìm trung tâm dịch vụ.
• Hỗ trợ đăng nhập.

Khi API dữ liệu được cấu hình, câu trả lời sẽ được đối chiếu theo từng máy và khách hàng.`;
}

export default function KosovotaAiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-message",
      role: "assistant",
      content:
        'Xin chào 👋 Hãy nhập "chào" hoặc chọn một câu hỏi bên dưới để bắt đầu.',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    });
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function sendMessage(value: string) {
    const cleanValue = value.trim();

    if (!cleanValue || isTyping) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: cleanValue,
    };

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
    ]);

    setInput("");
    setIsTyping(true);

    timeoutRef.current = window.setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: getLocalReply(cleanValue),
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        assistantMessage,
      ]);

      setIsTyping(false);
    }, 500);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  return (
    <>
      {isOpen && (
        <section
          role="dialog"
          aria-label="Trợ lý A.I KOSOVOTA"
          className="fixed bottom-24 right-4 z-[9999] flex w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[24px] border border-emerald-100 bg-white shadow-[0_24px_80px_rgba(2,44,34,0.25)] sm:right-5"
          style={{
            height: "min(620px, calc(100dvh - 120px))",
          }}
        >
          {/* Phần đầu khung chat */}
          <header className="flex items-center justify-between bg-[linear-gradient(135deg,#059669,#047857,#065f46)] px-4 py-3.5 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-white/20 text-sm font-black shadow-inner">
                AI
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-sm font-extrabold">
                  A.I KOSOVOTA
                </h2>

                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-50">
                  <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,0.18)]" />
                  Đang trực tuyến
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Đóng cửa sổ chat"
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/20"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 6L18 18M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          {/* Nội dung tin nhắn */}
          <div className="flex-1 overflow-y-auto bg-[#f4f8f6] px-3.5 py-4">
            <div className="space-y-3">
              {messages.map((message) => {
                const isAssistant = message.role === "assistant";

                return (
                  <div
                    key={message.id}
                    className={
                      isAssistant
                        ? "flex items-end gap-2"
                        : "flex justify-end"
                    }
                  >
                    {isAssistant && (
                      <div className="grid h-8 w-8 flex-none place-items-center rounded-xl bg-[linear-gradient(135deg,#10b981,#047857)] text-[10px] font-black text-white shadow-sm">
                        AI
                      </div>
                    )}

                    <div
                      className={
                        isAssistant
                          ? "max-w-[82%] whitespace-pre-line rounded-2xl rounded-bl-md border border-emerald-100 bg-white px-3.5 py-2.5 text-[13px] leading-6 text-slate-700 shadow-sm"
                          : "max-w-[82%] whitespace-pre-line rounded-2xl rounded-br-md bg-[#047857] px-3.5 py-2.5 text-[13px] leading-6 text-white shadow-sm"
                      }
                    >
                      {message.content}
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex items-end gap-2">
                  <div className="grid h-8 w-8 flex-none place-items-center rounded-xl bg-[linear-gradient(135deg,#10b981,#047857)] text-[10px] font-black text-white">
                    AI
                  </div>

                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-emerald-100 bg-white px-4 py-3 shadow-sm">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Câu hỏi gợi ý */}
          <div className="border-t border-slate-100 bg-white px-3.5 pt-3">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={isTyping}
                  onClick={() => sendMessage(suggestion)}
                  className="flex-none rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Ô nhập tin nhắn */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-slate-100 bg-white p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isTyping}
              placeholder="Nhập câu hỏi..."
              aria-label="Nhập câu hỏi cho A.I KOSOVOTA"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              aria-label="Gửi tin nhắn"
              className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-[#047857] text-white shadow-md hover:-translate-y-0.5 hover:bg-[#065f46] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M21 3L10.5 13.5M21 3L14.5 21L10.5 13.5M21 3L3 9.5L10.5 13.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </section>
      )}

      {/* Nút tròn mở chat */}
      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        aria-label={isOpen ? "Đóng A.I KOSOVOTA" : "Mở A.I KOSOVOTA"}
        aria-expanded={isOpen}
        className="fixed bottom-5 right-4 z-[9999] grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-[linear-gradient(145deg,#10b981,#047857)] text-white shadow-[0_15px_40px_rgba(5,150,105,0.42)] hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(5,150,105,0.5)] sm:right-5"
      >
        {isOpen ? (
          <svg
            viewBox="0 0 24 24"
            width="28"
            height="28"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 6L18 18M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              width="29"
              height="29"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M7.5 18.5L4 20L5 16.5C3.7 15.1 3 13.4 3 11.5C3 7.36 7.03 4 12 4C16.97 4 21 7.36 21 11.5C21 15.64 16.97 19 12 19C10.38 19 8.86 18.64 7.5 18.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 11.5H8.01M12 11.5H12.01M16 11.5H16.01"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            <span className="absolute right-0 top-0 h-4 w-4 rounded-full border-2 border-white bg-amber-400" />
          </>
        )}
      </button>
    </>
  );
}
