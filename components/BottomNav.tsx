"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/home", label: "홈", icon: HomeIcon },
  { href: "/print", label: "Print", icon: PrintIcon },
  { href: "/chat", label: "Chat", icon: ChatIcon },
  { href: "/trash", label: "Trash", icon: TrashIcon },
  { href: "/my", label: "My", icon: UserIcon },
];

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke={active ? "#3b82f6" : "#8b8b9e"}
        strokeWidth="1.8"
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
        stroke={active ? "#3b82f6" : "#8b8b9e"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H6a2 2 0 0 1-2-2V6Z"
        stroke={active ? "#3b82f6" : "#8b8b9e"}
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
        stroke={active ? "#3b82f6" : "#8b8b9e"}
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
        stroke={active ? "#3b82f6" : "#8b8b9e"}
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
        left: 0,
        right: 0,
        bottom: 0,
        height: 56,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        borderTop: "1px solid var(--border-subtle)",
        background: "rgba(10,10,15,0.85)",
        backdropFilter: "blur(12px)",
        zIndex: 50,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
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
              color: active ? "#3b82f6" : "#8b8b9e",
              minWidth: 56,
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
