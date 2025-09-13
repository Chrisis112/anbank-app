'use client';

import { useState } from "react";
import Link from "next/link";
import { useAuthStore } from "../../store/authStore";
import { FaBars } from "react-icons/fa";
export default function Header() {

  const { user, logout } = useAuthStore();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-gray-900 border-b border-gray-800 text-white">
      <link
        href="https://fonts.googleapis.com/css?family=Orbitron:wght@500;700&display=swap"
        rel="stylesheet"
      />
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
        {/* Логотип */}

        {/* Десктоп меню */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/forum" className="hover:text-indigo-400 transition-colors">
Forum
          </Link>
          {user && (
            <Link href="/profile" className="hover:text-indigo-400 transition-colors">
Profile
            </Link>
          )}
        </nav>

        {/* Мобильная кнопка меню */}
        <div className="md:hidden">
          <button onClick={() => setMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle menu">
            <FaBars size={20} />
          </button>
        </div>
      </div>

      {/* Мобильное меню */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-800 p-4 space-y-4 bg-gray-900">
          <Link href="/forum" className="block hover:text-indigo-400" onClick={() => setMobileMenuOpen(false)}>
          </Link>
          {user && (
            <Link href="/profile" className="block hover:text-indigo-400" onClick={() => setMobileMenuOpen(false)}>
Profile
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
