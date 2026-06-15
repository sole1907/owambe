'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type VendorProfile = {
  name: string
  commitment_fee_percentage: number
  service_fee: number | null
  has_material_costs: boolean
  rating: number
  review_count: number
  is_active: boolean
  vendor_categories: { name: string }
}

export default function VendorDashboardPage() {
  const { token } = useAuth()
  const [profile, setProfile] = useState<VendorProfile | null>(null)

  useEffect(() => {
    if (!token) return
    api.get<VendorProfile>('/vendor-portal/profile', token).then(setProfile).catch(() => null)
  }, [token])

  const incomplete = profile && (!profile.service_fee)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome back{profile ? `, ${profile.name}` : ''}
      </h1>
      <p className="text-gray-500 text-sm mb-8">Manage your profile and availability from here.</p>

      {incomplete && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <span className="font-medium">Your profile is incomplete.</span> Please set your service fee and other pricing details so clients can book you.{' '}
          <Link href="/vendor/profile" className="underline font-medium">Complete profile →</Link>
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
