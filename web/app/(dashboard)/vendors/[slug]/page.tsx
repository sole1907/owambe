'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'
import { capture } from '@/lib/posthog'

type Vendor = {
  id: string
  name: string
  slug: string
  description: string
  city: string
  location: string
  price_min: number | null
  price_max: number | null
  rating: number
  review_count: number
  phone: string | null
  whatsapp: string | null
  instagram: string | null
  website: string | null
  photos: string[]
  is_featured: boolean
  vendor_categories: { name: string; slug: string }
}

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function VendorProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const { token } = useAuth()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    api
      .get<Vendor>(`/vendors/${slug}`, token)
      .then(setVendor)
      .finally(() => setLoading(false))
  }, [slug, token])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Vendor not found.</p>
        <Link href="/vendors" className="text-black text-sm font-medium hover:underline mt-2 inline-block">
          Back to vendors
        </Link>
      </div>
    )
  }

  const whatsappUrl = vendor.whatsapp
    ? `https://wa.me/${vendor.whatsapp.replace(/\D/g, '')}?text=Hi, I found you on Owambe and I'm interested in your services.`
    : null

  return (
    <div className="max-w-2xl">
      <Link href="/vendors" className="text-sm text-gray-400 hover:text-black mb-4 inline-block">
        ← Back to vendors
      </Link>

      {/* Photo placeholder */}
      <div className="w-full h-56 bg-gray-100 rounded-2xl mb-6 flex items-center justify-center">
        <span className="text-gray-300 text-sm">No photos yet</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {vendor.vendor_categories?.name} · {vendor.location}, {vendor.city}
          </p>
        </div>
        {vendor.is_featured && (
          <span className="text-xs bg-black text-white px-3 py-1 rounded-full">Featured</span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm font-medium text-gray-700">★ {vendor.rating}</span>
        <span className="text-sm text-gray-400">({vendor.review_count} reviews)</span>
      </div>

      {/* Pricing */}
      {(vendor.price_min || vendor.price_max) && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-400 mb-1">Starting price</p>
          <p className="text-lg font-semibold text-gray-900">
            {vendor.price_min && vendor.price_max
              ? `${formatNaira(vendor.price_min)} – ${formatNaira(vendor.price_max)}`
              : vendor.price_min
              ? `From ${formatNaira(vendor.price_min)}`
              : 'Price on request'}
          </p>
        </div>
      )}

      {/* Description */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">About</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{vendor.description}</p>
      </div>

      {/* Contact buttons */}
      <div className="flex flex-col gap-3">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => capture('vendor_contact_clicked', { vendor_slug: slug, vendor_name: vendor.name, method: 'whatsapp' })}
            className="flex items-center justify-center gap-2 w-full py-3 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition"
          >
            Contact on WhatsApp
          </a>
        )}
        {vendor.phone && (
          <a
            href={`tel:${vendor.phone}`}
            onClick={() => capture('vendor_contact_clicked', { vendor_slug: slug, vendor_name: vendor.name, method: 'phone' })}
            className="flex items-center justify-center gap-2 w-full py-3 border border-gray-300 text-gray-800 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            Call {vendor.phone}
          </a>
        )}
        {vendor.instagram && (
          <a
            href={`https://instagram.com/${vendor.instagram.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => capture('vendor_contact_clicked', { vendor_slug: slug, vendor_name: vendor.name, method: 'instagram' })}
            className="flex items-center justify-center gap-2 w-full py-3 border border-gray-300 text-gray-800 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            View on Instagram ({vendor.instagram})
          </a>
        )}
      </div>
    </div>
  )
}
