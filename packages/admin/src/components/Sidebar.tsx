'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Key, Users, ToggleLeft, SignOut, MagnifyingGlass, FileText, Gear } from '@phosphor-icons/react';
import { signOut } from 'next-auth/react';

const navItems = [
  { href: '/dashboard/api-keys', label: 'API Keys', icon: Key },
  { href: '/dashboard/users', label: 'Users', icon: Users },
  { href: '/dashboard/features', label: 'Features', icon: ToggleLeft },
  { href: '/dashboard/content', label: 'Content', icon: FileText },
  { href: '/dashboard/search-logs', label: 'Search Logs', icon: MagnifyingGlass },
  { href: '/dashboard/system', label: 'System', icon: Gear },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-lg font-bold">Faces of Plants</h1>
        <p className="text-xs text-gray-400">Admin Console</p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white mt-auto"
      >
        <SignOut size={18} />
        Sign Out
      </button>
    </aside>
  );
}
