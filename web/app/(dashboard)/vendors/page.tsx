'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type Category = { id: string; name: string; slug: string }
type Vendor = {
  id: string
  name: string
  slug: string
  description: string
  city: string
  price_min: number | null
  price_max: number | null
  service_fee: number | null
  rating: number
  review_count: number
  is_featured: boolean
  photos: string[]
  capacity: number | null
  vendor_categories: Category
}

function formatNaira(value: number) {
  if (value >= 1000000) return `₦${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `₦${(value / 1000).toFixed(0)}k`
  return `₦${value}`
}

export default function VendorsPage() {
  const { token } = useAuth()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedCity, setSelectedCity] = useState('')

  useEffect(() => {
    if (!token) return
    api.get<Category[]>('/vendors/categories', token).then(setCategories)
  }, [token])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedCategory) params.set('category', selectedCategory)
    if (selectedCity) params.set('city', selectedCity)
    api
      .get<Vendor[]>(`/vendors?${params.toString()}`, token)
      .then(setVendors)
      .finally(() => setLoading(false))
  }, [token, selectedCategory, selectedCity])

  const CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Enugu']

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Find Vendors</h1>
        <p className="text-gray-500 text-sm mt-1">Browse our curated directory of event vendors</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>

        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="">All cities</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        {(selectedCategory || selectedCity) && (
          <button
            onClick={() => { setSelectedCategory(''); setSelectedCity('') }}
            className="text-sm text-gray-400 hover:text-black"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading vendors...</p>
      ) : vendors.length === 0 ? (
        <p className="text-gray-400 text-sm">No vendors found for these filters.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => {
            const isVenue = vendor.vendor_categories?.slug === 'venues'
            const priceLabel = vendor.service_fee
              ? formatNaira(vendor.service_fee)
              : vendor.price_min && vendor.price_max
              ? `${formatNaira(vendor.price_min)} – ${formatNaira(vendor.price_max)}`
              : 'Price on request'

            return (
              <Link
                key={vendor.id}
                href={`/vendors/${vendor.slug}`}
                className="block bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-black transition"
              >
                {/* Photo */}
                {vendor.photos?.[0] ? (
                  <div className="relative w-full h-36">
                    <Image
                      src={vendor.photos[0]}
                      alt={vendor.name}
                      fill
                      className="object-cover"
                    />
                    {vendor.is_featured && (
                      <span className="absolute top-2 left-2 text-xs bg-black text-white px-2 py-0.5 rounded-full">
                        Featured
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="relative w-full h-36 bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-300 text-sm">No photo yet</span>
                    {vendor.is_featured && (
                      <span className="absolute top-2 left-2 text-xs bg-black text-white px-2 py-0.5 rounded-full">
                        Featured
                      </span>
                    )}
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between mb-0.5 gap-2">
                    <h2 className="font-semibold text-gray-900 text-sm leading-tight">{vendor.name}</h2>
                    <span className="text-xs text-gray-500 shrink-0">★ {vendor.rating} ({vendor.review_count})</span>
                  </div>

                  <p className="text-xs text-gray-500 mb-2">
                    {vendor.vendor_categories?.name} · {vendor.city}
                  </p>

                  {/* Venue capacity badge */}
                  {isVenue && vendor.capacity && (
                    <span className="inline-block text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium mb-2">
                      Up to {vendor.capacity.toLocaleString()} guests
                    </span>
                  )}

                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{vendor.description}</p>

                  <p className="text-xs font-semibold text-gray-900">{priceLabel}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
