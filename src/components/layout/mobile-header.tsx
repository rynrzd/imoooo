"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ACCOUNT_NAV, NAV_SECTIONS } from "@/config/nav";
import { Brand } from "./brand";
import { NavLinks, NavSections } from "./nav-links";
import { GlobalSearch } from "./global-search";
import { NotificationCenter } from "./notification-center";

/** Header mobile avec menu de navigation dans un panneau latéral. */
export function MobileHeader() {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
      <Brand />
      <div className="flex items-center gap-1">
        <GlobalSearch variant="icon" />
        <NotificationCenter />
        <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Ouvrir le menu" />
          }
        >
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 gap-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>
              <Brand />
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
            <NavSections sections={NAV_SECTIONS} onNavigate={close} />
            <NavLinks items={ACCOUNT_NAV} onNavigate={close} />
          </div>
        </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
