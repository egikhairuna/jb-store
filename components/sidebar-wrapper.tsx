"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

// Pages that should render with NO sidebar
const PATHS_WITHOUT_SIDEBAR = ["/login"];

export function SidebarWrapper() {
  const pathname = usePathname();

  if (PATHS_WITHOUT_SIDEBAR.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return <Sidebar />;
}
