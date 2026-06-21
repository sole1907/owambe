'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

const BASE_NAV = [
  { href: '/vendor/dashboard', label: 'Dashboard' },
  { href: '/vendor/inquiries', label: 'Inquiries' },
  { href: '/vendor/payments', label: 'Payments' },
  { href: '/vendor/bank', label: 'Bank Account' },
  { href: '/vendor/profile', label: 'My Profile' },
  { href: '/vendor/availability', label: 'Availability' },
]

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [categorySlug, setCategorySlug] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'vendor')) {
      router.replace('/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (!token) return
    api
      .get<{ vendor_categories: { slug: string } | null }>('/vendor-portal/profile', token)
      .then((profile) => setCategorySlug(profile.vendor_categories?.slug ?? null))
      .catch(() => {})
  }, [token])

  const nav = [
    ...BASE_NAV,
    ...(categorySlug === 'caterers' ? [{ href: '/vendor/menu', label: 'Menu' }] : []),
    ...(categorySlug === 'decorators' ? [{ href: '/vendor/decorator', label: 'Decorator' }] : []),
  ]

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
          {nav.map((item) => (
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
