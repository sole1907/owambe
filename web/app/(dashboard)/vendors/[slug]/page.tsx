'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'
import { capture } from '@/lib/posthog'

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  users: { full_name: string | null }
  events: { title: string; event_type: string }
}

type Vendor = {
  id: string
  name: string
  slug: string
  description: string
  city: string
  location: string
  price_min: number | null
  price_max: number | null
  service_fee: number | null
  per_unit_cost: number | null
  per_unit_label: string | null
  has_material_costs: boolean
  commitment_fee_percentage: number
  cancellation_policy: {
    full_refund_days: number
    partial_refund_days: number
    partial_refund_percentage: number
  } | null
  balance_payment_methods: string[]
  rating: number
  review_count: number
  phone: string | null
  whatsapp: string | null
  email: string | null
  instagram: string | null
  website: string | null
  photos: string[]
  videos: string[]
  capacity: number | null
  is_featured: boolean
  vendor_categories: { name: string; slug: string }
}

type MenuPricingTier = {
  id: string
  min_servings: number
  max_servings: number | null
  price_per_serving: number
}

type MenuItemWithTiers = {
  id: string
  name: string
  category: string
  description: string | null
  caterer_menu_pricing_tiers: MenuPricingTier[]
}

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)
}

function PhotoCarousel({ photos }: { photos: string[] }) {
  const [current, setCurrent] = useState(0)

  if (!photos || photos.length === 0) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-2xl mb-6 flex items-center justify-center">
        <span className="text-gray-300 text-sm">No photos yet</span>
      </div>
    )
  }

  return (
    <div className="relative mb-6">
      <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-gray-100">
        <Image
          src={photos[current]}
          alt={`Photo ${current + 1}`}
          fill
          className="object-cover"
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={() => setCurrent((c) => (c - 1 + photos.length) % photos.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition"
            >
              ‹
            </button>
            <button
              onClick={() => setCurrent((c) => (c + 1) % photos.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-1.5 h-1.5 rounded-full transition ${i === current ? 'bg-white' : 'bg-white/50'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition relative ${i === current ? 'border-black' : 'border-transparent'}`}
            >
              <Image src={url} alt="" fill className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function VideoSection({ videos }: { videos: string[] }) {
  if (!videos || videos.length === 0) return null

  const getEmbedUrl = (url: string) => {
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`
    const vm = url.match(/vimeo\.com\/(\d+)/)
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`
    return null
  }

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Videos</h2>
      <div className="space-y-4">
        {videos.map((url, i) => {
          const embed = getEmbedUrl(url)
          return embed ? (
            <div key={i} className="relative aspect-video rounded-xl overflow-hidden bg-black">
              <iframe
                src={embed}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              ▶ Video {i + 1}
            </a>
          )
        })}
      </div>
    </div>
  )
}

export default function VendorDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { token } = useAuth()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemWithTiers[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    Promise.all([
      api.get<Vendor>(`/vendors/${slug}`, token),
      api.get<Review[]>(`/vendors/${slug}/reviews`, token).catch(() => []),
      api.get<MenuItemWithTiers[]>(`/vendors/${slug}/menu`, token).catch(() => []),
    ]).then(([v, r, m]) => {
      setVendor(v)
      setReviews(r)
      setMenuItems(m)
    }).finally(() => setLoading(false))
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

  const isVenue = vendor.vendor_categories?.slug === 'venues'
  const isCaterer = vendor.vendor_categories?.slug === 'caterers'

  const menuByCategory = menuItems.reduce<Record<string, MenuItemWithTiers[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <div className="max-w-2xl">
      <Link href="/vendors" className="text-sm text-gray-400 hover:text-black mb-4 inline-block">
        ← Back to vendors
      </Link>

      <PhotoCarousel photos={vendor.photos} />

      {/* Header */}
      <div className="flex items-start justify-between mb-2 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {vendor.vendor_categories?.name} · {vendor.location}, {vendor.city}
          </p>
        </div>
        {vendor.is_featured && (
          <span className="text-xs bg-black text-white px-3 py-1 rounded-full shrink-0">Featured</span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-medium text-gray-700">★ {vendor.rating}</span>
        <span className="text-sm text-gray-400">({vendor.review_count} reviews)</span>
        {isVenue && vendor.capacity && (
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 font-medium">
            Capacity: {vendor.capacity.toLocaleString()} guests
          </span>
        )}
      </div>

      {/* Pricing */}
      {(vendor.price_min || vendor.price_max || vendor.service_fee) && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-400 mb-2">Pricing</p>
          {vendor.service_fee && (
            <p className="text-sm text-gray-700 mb-1">
              <span className="font-medium">Service fee:</span> {formatNaira(vendor.service_fee)}
            </p>
          )}
          {vendor.has_material_costs && vendor.per_unit_cost && (
            <p className="text-sm text-gray-700 mb-1">
              <span className="font-medium">Materials:</span> {formatNaira(vendor.per_unit_cost)}{' '}
              {vendor.per_unit_label || 'per unit'}
            </p>
          )}
          {(vendor.price_min || vendor.price_max) && (
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {vendor.price_min && vendor.price_max
                ? `${formatNaira(vendor.price_min)} – ${formatNaira(vendor.price_max)}`
                : vendor.price_min
                ? `From ${formatNaira(vendor.price_min)}`
                : 'Price on request'}
            </p>
          )}
        </div>
      )}

      {/* Menu (caterers only) */}
      {isCaterer && menuItems.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Menu</h2>
          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            {Object.entries(menuByCategory).map(([cat, catItems]) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat}</p>
                <div className="space-y-1">
                  {catItems.map((item) => {
                    const prices = item.caterer_menu_pricing_tiers.map((t) => t.price_per_serving).sort((a, b) => a - b)
                    const minPrice = prices[0]
                    const maxPrice = prices[prices.length - 1]
                    const priceRange = minPrice && maxPrice && minPrice !== maxPrice
                      ? `${formatNaira(minPrice)}–${formatNaira(maxPrice)}/head`
                      : minPrice
                      ? `${formatNaira(minPrice)}/head`
                      : null
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-700">{item.name}</span>
                        {priceRange && (
                          <span className="text-xs text-gray-500 shrink-0">{priceRange}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {vendor.description && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">About</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{vendor.description}</p>
        </div>
      )}

      {/* Booking terms */}
      {(vendor.commitment_fee_percentage || vendor.cancellation_policy) && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Booking terms</p>
          {vendor.commitment_fee_percentage && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Commitment fee:</span> {vendor.commitment_fee_percentage}% of total price
            </p>
          )}
          {vendor.balance_payment_methods?.length > 0 && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Balance payment:</span>{' '}
              {vendor.balance_payment_methods.join(', ')}
            </p>
          )}
          {vendor.cancellation_policy && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Cancellation:</span>{' '}
              Full refund if cancelled ≥ {vendor.cancellation_policy.full_refund_days} days before ·{' '}
              {vendor.cancellation_policy.partial_refund_percentage}% refund if ≥ {vendor.cancellation_policy.partial_refund_days} days before ·{' '}
              No refund otherwise
            </p>
          )}
        </div>
      )}

      {/* Videos */}
      <VideoSection videos={vendor.videos} />

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Reviews ({reviews.length})
          </h2>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className={s <= review.rating ? 'text-amber-400' : 'text-gray-200'}>
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(review.created_at).toLocaleDateString('en-GB', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{review.comment}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {review.users?.full_name || 'Verified organiser'} · {review.events?.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      <div className="flex flex-col gap-3">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              capture('vendor_contact_clicked', {
                vendor_slug: slug,
                vendor_name: vendor.name,
                method: 'whatsapp',
              })
            }
            className="flex items-center justify-center gap-2 w-full py-3 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition"
          >
            Contact on WhatsApp
          </a>
        )}
        {vendor.phone && (
          <a
            href={`tel:${vendor.phone}`}
            onClick={() =>
              capture('vendor_contact_clicked', {
                vendor_slug: slug,
                vendor_name: vendor.name,
                method: 'phone',
              })
            }
            className="flex items-center justify-center w-full py-3 border border-gray-300 text-gray-800 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            Call {vendor.phone}
          </a>
        )}
        {vendor.instagram && (
          <a
            href={`https://instagram.com/${vendor.instagram.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              capture('vendor_contact_clicked', {
                vendor_slug: slug,
                vendor_name: vendor.name,
                method: 'instagram',
              })
            }
            className="flex items-center justify-center w-full py-3 border border-gray-300 text-gray-800 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            View on Instagram ({vendor.instagram})
          </a>
        )}
        {vendor.website && (
          <a
            href={vendor.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full py-3 border border-gray-300 text-gray-800 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            Visit website
          </a>
        )}
      </div>
    </div>
  )
}
