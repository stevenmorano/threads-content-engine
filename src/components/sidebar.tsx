"use client";

import {
  BookOpenText,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Search,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { Brand } from "@/components/brand";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/research", label: "Research", icon: Search },
  { href: "/dashboard/library", label: "Source library", icon: BookOpenText },
  { href: "/dashboard/drafts", label: "Draft approvals", icon: FileCheck2 },
  { href: "/dashboard/settings", label: "Connections", icon: Settings2 },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Brand />
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link className={active ? "nav-link nav-link-active" : "nav-link"} href={href} key={href}>
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <span className="eyebrow">Signed in as</span>
        <span className="sidebar-email">{email}</span>
        <form action={logoutAction}>
          <button className="nav-link nav-button" type="submit">
            <LogOut aria-hidden="true" size={18} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
