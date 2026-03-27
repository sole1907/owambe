'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type Vendor = {
  id: string
  name: string
  slug: string
  city: string
  is_active: boolean
  is_featured: boolean
  rating: number
  review_count: number
  price_min: number | null
  price_max: number | null
  vendor_categories: { name: string; slug: string } | null
}

export default function AdminVendorsPage() {
  const { token } = useAuth()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => {
    if (!token) return
    api
      .get<Vendor[]>('/admin/vendors', token)
      .then(setVendors)
      .finally(() => setLoading(false))
  }, [token])

  const handleToggleActive = async (vendor: Vendor) => {
    await api.patch(`/admin/vendors/${vendor.id}`, { isActive: !vendor.is_active }, token ?? undefined)
    setVendors((prev) =>
      prev.map((v) => (v.id === vendor.id ? { ...v, is_active: !v.is_active } : v)),
    )
  }

  const filtered =
    filter === 'active'
      ? vendors.filter((v) => v.is_active)
      : filter === 'inactive'
      ? vendors.filter((v) => !v.is_active)
      : vendors

  if (loading) return <p className="text-gray-400 text-sm">Loading vendors...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-1">{vendors.length} total</p>
        </div>
        <Link
          href="/admin/vendors/new"
          className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition"
        >
          + Add vendor
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg capitalize transition ${
              filter === f
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {f}{' '}
            <span className="text-xs opacity-70">
              (
              {f === 'all'
                ? vendors.length
                : f === 'active'
                ? vendors.filter((v) => v.is_active).length
                : vendors.filter((v) => !v.is_active).length}
              )
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 font-medium text-gray-500">Category</th>
              <th className="px-4 py-3 font-medium text-gray-500">City</th>
              <th className="px-4 py-3 font-medium text-gray-500">Price range</th>
              <th className="px-4 py-3 font-medium text-gray-500">Rating</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No vendors
                </td>
              </tr>
            ) : (
              filtered.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{vendor.name}</span>
                      {vendor.is_featured && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                          Featured
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {vendor.vendor_categories?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{vendor.city}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {vendor.price_min
                      ? `₦${vendor.price_min.toLocaleString()}${vendor.price_max ? ` – ₦${vendor.price_max.toLocaleString()}` : '+'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {vendor.rating > 0 ? `${vendor.rating} (${vendor.review_count})` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(vendor)}
                      className={`text-xs px-2 py-1 rounded-full font-medium transition ${
                        vendor.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {vendor.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/vendors/${vendor.id}`}
                      className="text-xs text-gray-400 hover:text-black transition"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
