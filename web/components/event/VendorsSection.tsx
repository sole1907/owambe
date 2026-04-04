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

type ChecklistItem = { id: string; title: string; is_completed: boolean }

type Props = {
  eventId: string
  initialCategory?: string
  checklistItems?: ChecklistItem[]
}

export default function VendorsSection({ eventId, initialCategory, checklistItems = [] }: Props) {
  const { token } = useAuth()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(initialCategory ?? '')
  const [booked, setBooked] = useState<Record<string, boolean>>({})
  const [bookingId, setBookingId] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    api
      .get<Vendor[]>(`/events/${eventId}/recommended-vendors`, token)
      .then(setVendors)
      .finally(() => setLoading(false))
  }, [eventId, token])

  // Sync when parent changes the pre-selected category (checklist CTA click)
  useEffect(() => {
    if (initialCategory !== undefined) setActiveCategory(initialCategory)
  }, [initialCategory])

  const handleBookVendor = async (vendor: Vendor) => {
    setBookingId(vendor.id)
    // Find first uncompleted checklist item matching this vendor's category
    const categorySlug = vendor.vendor_categories?.slug ?? ''
    const match = checklistItems.find(
      (item) => !item.is_completed && item.title.toLowerCase().includes(categorySlug.replace(/-/g, ' ').split('s')[0]),
    )
    if (match) {
      await api.patch(`/events/checklist/${match.id}`, { isCompleted: true }, token ?? undefined)
    }
    setBooked((prev) => ({ ...prev, [vendor.id]: true }))
    setBookingId(null)
  }

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

  const categories = Array.from(
    new Map(vendors.map((v) => [v.vendor_categories?.slug, v.vendor_categories?.name])).entries(),
  ).filter(([slug]) => slug)

  const filtered = activeCategory
    ? vendors.filter((v) => v.vendor_categories?.slug === activeCategory)
    : vendors

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

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setActiveCategory('')}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              activeCategory === '' ? 'bg-black text-white border-black' : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            All
          </button>
          {categories.map(([slug, name]) => (
            <button
              key={slug}
              onClick={() => setActiveCategory(slug ?? '')}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                activeCategory === slug ? 'bg-black text-white border-black' : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((vendor) => {
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
                <div className="flex gap-2">
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
                  {booked[vendor.id] ? (
                    <span className="text-xs text-green-600 font-medium px-3 py-1.5">Booked ✓</span>
                  ) : (
                    <button
                      onClick={() => handleBookVendor(vendor)}
                      disabled={bookingId === vendor.id}
                      className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      {bookingId === vendor.id ? '...' : 'Mark booked'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
