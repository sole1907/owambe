'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type VendorProfile = {
  name: string
  commitment_fee_percentage: number
  has_material_costs: boolean
  rating: number
  review_count: number
  is_active: boolean
  vendor_categories: { name: string }
}

export default function VendorDashboardPage() {
  const { token } = useAuth()
  const [profile, setProfile] = useState<VendorProfile | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!token) return
    Promise.all([
      api.get<VendorProfile>('/vendor-portal/profile', token).catch(() => null),
      api.get<{ pending: number }>('/vendor-portal/inquiry-counts', token).catch(() => ({ pending: 0 })),
    ]).then(([p, counts]) => {
      setProfile(p)
      setPendingCount(counts?.pending ?? 0)
    })
  }, [token])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome back{profile ? `, ${profile.name}` : ''}
      </h1>
      <p className="text-gray-500 text-sm mb-8">Manage your profile and availability from here.</p>

      {pendingCount > 0 && (
        <div className="mb-6 p-4 bg-black text-white rounded-xl flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">
              {pendingCount} pending {pendingCount === 1 ? 'inquiry' : 'inquiries'} awaiting your response
            </p>
            <p className="text-xs text-gray-300 mt-0.5">Respond within 48 hours to avoid expiry</p>
          </div>
          <Link
            href="/vendor/inquiries"
            className="shrink-0 bg-white text-black text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition"
          >
            View inquiries →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-1">Category</p>
          <p className="text-lg font-semibold text-gray-900">{profile?.vendor_categories?.name ?? '—'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-1">Rating</p>
          <p className="text-lg font-semibold text-gray-900">
            {profile ? `★ ${profile.rating} (${profile.review_count})` : '—'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-1">Commitment fee</p>
          <p className="text-lg font-semibold text-gray-900">
            {profile ? `${profile.commitment_fee_percentage}%` : '—'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-1">Status</p>
          <p className={`text-lg font-semibold ${profile?.is_active ? 'text-green-600' : 'text-red-500'}`}>
            {profile?.is_active ? 'Active' : 'Inactive'}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/vendor/profile" className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition">
          Edit profile
        </Link>
        <Link href="/vendor/availability" className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
          Manage availability
        </Link>
      </div>
    </div>
  )
}
