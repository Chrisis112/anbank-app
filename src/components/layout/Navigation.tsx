"use client";

import React, { useState } from "react";
import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Menu, X } from "react-feather"; // или можно heroicons

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { href: "/", label:"Home" },
    { href: "/chat", label: "Chat" },
    { href: "/profile", label: "Profile" }
  ];

  return (
    <nav className="fixed top-0 left-0 w-full bg-crypto-panel backdrop-blur-md border-b border-white/10 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          {/* Логотип */}
          <Link href="/" className="font-orbitron text-xl text-crypto-accent neon">
            CryptoChat
          </Link>

          {/* Десктоп меню */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-crypto-primaryLight hover:text-crypto-accent transition"
              >
                {link.label}
              </Link>
            ))}
            <WalletMultiButton className="!bg-crypto-primary hover:!bg-crypto-accent transition" />
          </div>

          {/* Мобильная кнопка */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-crypto-accent focus:outline-none"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Мобильное меню */}
      {isOpen && (
        <div className="md:hidden bg-crypto-dark border-t border-white/10">
          <div className="px-4 py-3 flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-crypto-primaryLight hover:text-crypto-accent transition"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex gap-3 items-center">
              <WalletMultiButton className="!bg-crypto-primary hover:!bg-crypto-accent w-full transition" />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
