"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Home", href: "/" },
  { name: "Indoor Temp", href: "/indoor-temp" },
  { name: "Design", href: "/design" },
  { name: "Thermal Energy", href: "/thermal-energy" },
  { name: "Heat Flow", href: "/heat-flow" },
  { name: "Dashboard", href: "/dashboard" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Do not render navbar on the landing page
  if (pathname === "/") {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/80 bg-[#F4EFE6]/92 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1550px] items-center justify-center px-4 sm:px-8">
        {/* Desktop Nav Items: Centered with No Logo */}
        <div className="hidden items-center gap-1.5 rounded-full border border-border/90 bg-[#FCFAF6]/95 px-3 py-1.5 shadow-md shadow-[#9C7F6A]/10 backdrop-blur-md md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-full px-4 py-1.5 text-xs font-medium tracking-wide transition-all duration-200 ${
                  isActive
                    ? "bg-accent text-white font-semibold shadow-sm shadow-accent/40"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Mobile View: Centered Nav Toggle */}
        <div className="flex w-full items-center justify-between md:hidden">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Workspaces
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-none border border-border bg-card text-foreground transition-colors hover:bg-muted"
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-border bg-[#F4EFE6]/98 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex flex-col space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between rounded-none px-3 py-2 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-l-2 border-accent bg-accent/15 font-semibold text-accent"
                      : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span>{item.name}</span>
                  {isActive && (
                    <span className="font-mono text-[10px] text-accent font-bold">ACTIVE</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
