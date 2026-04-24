"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/folders", label: "Folders", icon: FolderNavIcon },
  { href: "/print", label: "Print", icon: PrintIcon },
  { href: "/trash", label: "Trash", icon: TrashIcon },
  { href: "/my", label: "My", icon: UserIcon },
];

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke={active ? "var(--accent)" : "var(--text-muted)"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderNavIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
        stroke={active ? "var(--accent)" : "var(--text-muted)"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrintIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 16V4h10v12M7 16H5a2 2 0 0 1-2-2v-4h18v4a2 2 0 0 1-2 2h-2M7 16h10v6H7v-6Z"
        stroke={active ? "var(--accent)" : "var(--text-muted)"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
        stroke={active ? "var(--accent)" : "var(--text-muted)"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 0c4.42 0 8 2.24 8 5v2H4v-2c0-2.76 3.58-5 8-5Z"
        stroke={active ? "var(--accent)" : "var(--text-muted)"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 20,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 4,
        background: "var(--bg-card)",
        borderRadius: "var(--radius-full)",
        padding: "6px 8px",
        zIndex: 50,
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              textDecoration: "none",
              fontSize: 10,
              fontWeight: active ? 700 : 500,
              color: active ? "var(--accent)" : "var(--text-muted)",
              padding: "6px 12px",
              borderRadius: "var(--radius-full)",
              background: active ? "var(--accent-subtle)" : "transparent",
              transition: "all 0.2s",
            }}
          >
            <Icon active={active} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
