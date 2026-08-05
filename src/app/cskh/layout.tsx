import type { ReactNode } from "react";

export default function CustomerCareLayout({ children }: { children: ReactNode }) {
  return (
    <div className="cskh-scroll-shell">
      {children}
      <style>{`
        .cskh-scroll-shell .ticket-list-scroll {
          max-height: min(68vh, 760px);
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
        }

        .cskh-scroll-shell .overflow-x-auto {
          max-height: min(72vh, 820px);
          overflow: auto;
          overscroll-behavior: contain;
          scrollbar-gutter: stable both-edges;
        }

        .cskh-scroll-shell table thead {
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .cskh-scroll-shell .modal-body {
          max-height: min(72vh, 760px);
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .cskh-scroll-shell * {
          scrollbar-width: thin;
          scrollbar-color: rgb(148 163 184) transparent;
        }
      `}</style>
    </div>
  );
}
