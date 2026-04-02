'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type Vendor = {
  id: string
  name: string
  slug: string
  description: string
  city: string
  price_min: number | null
  price_max: number | null
  rating: number
  review_count: number
  whatsapp: string | null
  vendor_categories: { name: string; slug: string }
}

function formatNaira(value: number) {
  if (value >= 1000000) return `₦${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `₦${(value / 1000).toFixed(0)}k`
  return `₦${value}`
}

type Props = { eventId: string }

export default function VendorsSection({ eventId }: Props) {
  const { token } = useAuth()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    api
      .get<Vendor[]>(`/events/${eventId}/recommended-vendors`, token)
      .then(setVendors)
      .finally(() => setLoading(false))
  }, [eventId, token])

  if (loading) return <p className="text-gray-400 text-sm">Finding vendors for your event...</p>

  if (vendors.length === 0) {
    return (
      <div>
        <p className="text-gray-500 text-sm mb-4">
          No vendors found matching your event location and budget yet.
        </p>
        <Link href="/vendors" className="text-black text-sm font-medium hover:underline">
          Browse all vendors →
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Recommended Vendors</h2>
          <p className="text-xs text-gray-400 mt-0.5">Based on your event city and budget</p>
        </div>
        <Link href="/vendors" className="text-sm text-black font-medium hover:underline">
          Browse all
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {vendors.map((vendor) => {
          const whatsappUrl = vendor.whatsapp
            ? `https://wa.me/${vendor.whatsapp.replace(/\D/g, '')}?text=Hi, I found you on Owambe and I'm interested in your services.`
            : null

          return (
            <div
              key={vendor.id}
              className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-gray-300 transition"
            >
              <div className="flex items-start justify-between mb-1">
                <Link href={`/vendors/${vendor.slug}`} className="font-semibold text-gray-900 text-sm hover:underline">
                  {vendor.name}
                </Link>
                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                  ★ {vendor.rating}
                </span>
              </div>

              <p className="text-xs text-gray-500 mb-2">
                {vendor.vendor_categories?.name} · {vendor.city}
              </p>

              <p className="text-xs text-gray-500 line-clamp-2 mb-3">{vendor.description}</p>

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">
                  {vendor.price_min && vendor.price_max
                    ? `${formatNaira(vendor.price_min)} – ${formatNaira(vendor.price_max)}`
                    : 'Price on request'}
                </span>
                {whatsappUrl ? (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition"
                  >
                    WhatsApp
                  </a>
                ) : (
                  <Link
                    href={`/vendors/${vendor.slug}`}
                    className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                  >
                    View
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
