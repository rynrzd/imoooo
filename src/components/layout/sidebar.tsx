"use client";

import { ACCOUNT_NAV, NAV_SECTIONS } from "@/config/nav";
import { Brand } from "./brand";
import { GlobalSearch } from "./global-search";
import { NavLinks, NavSections } from "./nav-links";
import { NotificationCenter } from "./notification-center";
import { UserMenu } from "./user-menu";

/** Sidebar fixe (desktop). Sur mobile, la navigation passe par le Sheet du header. */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center justify-between px-5">
        <Brand />
        <NotificationCenter />
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pt-2 pb-4">
        <div className="px-1">
          <GlobalSearch />
        </div>
        <NavSections sections={NAV_SECTIONS} />
        <div className="mt-auto flex flex-col gap-4">
          <NavLinks items={ACCOUNT_NAV} />
        </div>
      </div>

      <div className="border-t border-border p-3">
        <UserMenu />
      </div>
    </aside>
  );
}
