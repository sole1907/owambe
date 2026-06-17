'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'

const NAV = [
  { href: '/vendor/dashboard', label: 'Dashboard' },
  { href: '/vendor/inquiries', label: 'Inquiries' },
  { href: '/vendor/profile', label: 'My Profile' },
  { href: '/vendor/availability', label: 'Availability' },
]

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'vendor')) {
      router.replace('/login')
    }
  }, [user, isLoading, router])

  if (isLoading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col py-8 px-4 shrink-0">
        <div className="mb-8 px-2">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Vendor Portal</p>
          <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name || user.email}</p>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                pathname === item.href
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="mt-4 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 transition text-left"
        >
          Sign out
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 max-w-3xl">
        {children}
      </main>
    </div>
  )
}
