'use client'

import { useEffect, useState, useCallback } from 'react'
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
  rating: number
  review_count: number
  photos: string[]
  capacity: number | null
  is_within_budget: boolean
  vendor_categories: Category
  menu_item_names: string[]
  style_names: string[]
  email: string | null
  phone: string | null
  whatsapp: string | null
}

type Interest = {
  id: string
  preference_rank: number // 1=A, 2=B, 3=C
  status: 'pending' | 'available' | 'quoted' | 'unavailable' | 'expired' | 'committed' | 'cancelled'
  event_date: string | null
  expires_at: string | null
  vendor_response_at: string | null
  vendor_notes: string | null
  offered_price: number | null
  counter_price: number | null
  agreed_price: number | null
  is_final_offer: boolean
  vendors: Vendor & {
    vendor_categories: Category
    commitment_fee_percentage: number
  }
}

type CancellationStatus = {
  cancelled_by: 'organiser' | 'vendor'
  held_funds_returned_kobo: number
  outstanding_kobo: number
  repayment_deadline: string | null
  extension_granted: boolean
  repayment_completed_at: string | null
  status: 'pending' | 'extension_granted' | 'repaid' | 'escalated' | 'no_outstanding'
  cancellation_events: {
    event_type: string
    message: string
    created_at: string
  }[]
}

type MenuCatalogCategory = { category: string; items: string[] }

type StyleCatalogItem = { style: string }

type DecoratorPackage = {
  id: string
  name: string
  description: string | null
  includes: string[]
  decorator_package_guest_tiers: {
    id: string
    min_guests: number
    max_guests: number | null
    price: number
  }[]
}

type MenuItemWithTiers = {
  id: string
  name: string
  category: string
  description: string | null
  caterer_menu_pricing_tiers: {
    id: string
    min_servings: number
    max_servings: number | null
    price_per_serving: number
  }[]
}

function formatNaira(value: number) {
  if (value >= 1_000_000) {
    const str = (value / 1_000_000).toFixed(2).replace(/\.?0+$/, '')
    return `₦${str}M`
  }
  if (value >= 1_000) {
    const str = (value / 1_000).toFixed(1).replace(/\.?0+$/, '')
    return `₦${str}k`
  }
  return `₦${value.toLocaleString()}`
}

function getPricePerServing(
  tiers: MenuItemWithTiers['caterer_menu_pricing_tiers'],
  servings: number,
): number {
  const sorted = [...tiers].sort((a, b) => b.min_servings - a.min_servings)
  return (
    sorted.find(
      (t) =>
        servings >= t.min_servings &&
        (t.max_servings === null || servings <= t.max_servings),
    )?.price_per_serving ??
    sorted[sorted.length - 1]?.price_per_serving ??
    0
  )
}

function getNextTierHint(
  tiers: MenuItemWithTiers['caterer_menu_pricing_tiers'],
  servings: number,
): { minServings: number; pricePerServing: number } | null {
  const sorted = [...tiers].sort((a, b) => a.min_servings - b.min_servings)
  const next = sorted.find((t) => t.min_servings > servings)
  if (!next) return null
  return { minServings: next.min_servings, pricePerServing: next.price_per_serving }
}

function isInDiscountedTier(
  tiers: MenuItemWithTiers['caterer_menu_pricing_tiers'],
  servings: number,
): boolean {
  const sorted = [...tiers].sort((a, b) => a.min_servings - b.min_servings)
  const baseTier = sorted[0]
  const currentPrice = getPricePerServing(tiers, servings)
  return !!baseTier && currentPrice < baseTier.price_per_serving
}

function getPackagePrice(
  tiers: DecoratorPackage['decorator_package_guest_tiers'],
  guests: number,
): number {
  const sorted = [...tiers].sort((a, b) => b.min_guests - a.min_guests)
  return (
    sorted.find(
      (t) => guests >= t.min_guests && (t.max_guests === null || guests <= t.max_guests),
    )?.price ??
    sorted[sorted.length - 1]?.price ??
    0
  )
}

const RANK_LABEL = ['A', 'B', 'C']

const STATUS_STYLES: Record<Interest['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  available: 'bg-green-100 text-green-800',
  quoted: 'bg-purple-100 text-purple-800',
  unavailable: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-500',
  committed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
}

const STATUS_LABEL: Record<Interest['status'], string> = {
  pending: 'Awaiting response',
  available: 'Available ✓',
  quoted: 'Counter received',
  unavailable: 'Not available',
  expired: 'Expired',
  committed: 'Committed ✓',
  cancelled: 'Cancelled',
}

const CANCELLATION_STATUS_BADGE: Record<CancellationStatus['status'], { label: string; style: string }> = {
  pending: { label: 'Awaiting vendor repayment', style: 'bg-amber-100 text-amber-800' },
  extension_granted: { label: 'Extension granted', style: 'bg-amber-100 text-amber-800' },
  repaid: { label: 'Fully refunded', style: 'bg-green-100 text-green-800' },
  escalated: { label: 'Escalated', style: 'bg-red-100 text-red-800' },
  no_outstanding: { label: 'Resolved', style: 'bg-green-100 text-green-800' },
}

declare global {
  interface Window {
    PaystackPop: {
      resumeTransaction: (accessCode: string) => {
        openIframe: () => void
      }
    }
  }
}

function VendorCard({
  vendor,
  alreadyShortlisted,
  slotsUsed,
  onShortlist,
  selectedDishes,
  selectedStyles,
}: {
  vendor: Vendor
  alreadyShortlisted: boolean
  slotsUsed: number
  onShortlist: () => void
  selectedDishes: Set<string>
  selectedStyles: Set<string>
}) {
  const allSlotsFull = slotsUsed >= 3
  const isCaterer = vendor.vendor_categories?.slug === 'caterers'
  const isDecoratorView = vendor.vendor_categories?.slug === 'decorators'
  const menuNames = vendor.menu_item_names ?? []
  const styleNames = vendor.style_names ?? []

  // Caterer dish-match badge
  const matchCount =
    isCaterer && selectedDishes.size > 0
      ? menuNames.filter((n) => selectedDishes.has(n)).length
      : 0
  const showBadge = isCaterer && selectedDishes.size > 0 && menuNames.length > 0
  const matchRatio = menuNames.length > 0 ? matchCount / menuNames.length : 0
  const badgeColor =
    matchRatio >= 0.8
      ? 'bg-green-100 text-green-700'
      : matchRatio >= 0.4
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700'

  // Decorator style-match badge
  const styleMatchCount =
    isDecoratorView && selectedStyles.size > 0
      ? styleNames.filter((n) => selectedStyles.has(n)).length
      : 0
  const showStyleBadge = isDecoratorView && selectedStyles.size > 0 && styleNames.length > 0
  const styleMatchRatio = selectedStyles.size > 0 ? styleMatchCount / selectedStyles.size : 0
  const styleBadgeColor =
    styleMatchRatio >= 0.8
      ? 'bg-green-100 text-green-700'
      : styleMatchRatio >= 0.4
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700'

  return (
    <div
      className={`bg-white border rounded-2xl overflow-hidden transition ${
        alreadyShortlisted ? 'border-black/20 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {vendor.photos?.[0] ? (
        <div className="relative w-full h-28">
          <Image src={vendor.photos[0]} alt={vendor.name} fill className="object-cover" />
        </div>
      ) : (
        <div className="w-full h-28 bg-gray-100 flex items-center justify-center">
          <span className="text-gray-300 text-xs">No photo</span>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between mb-0.5 gap-2">
          <Link
            href={`/vendors/${vendor.slug}`}
            className="font-semibold text-gray-900 text-sm hover:underline leading-tight"
          >
            {vendor.name}
          </Link>
          <div className="flex items-center gap-1.5 shrink-0">
            {showBadge && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                {matchCount}/{menuNames.length} dishes
              </span>
            )}
            {showStyleBadge && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${styleBadgeColor}`}>
                {styleMatchCount}/{selectedStyles.size} styles
              </span>
            )}
            <span className="text-xs text-gray-400">★ {vendor.rating}</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-1">{vendor.vendor_categories?.name} · {vendor.city}</p>

        {vendor.capacity && (
          <span className="inline-block text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 font-medium mb-1">
            Up to {vendor.capacity.toLocaleString()} guests
          </span>
        )}

        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{vendor.description}</p>

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-800">
            {isCaterer
              ? 'Price on menu'
              : vendor.price_min && vendor.price_max
              ? `${formatNaira(vendor.price_min)} – ${formatNaira(vendor.price_max)}`
              : vendor.price_min
              ? `From ${formatNaira(vendor.price_min)}`
              : 'Price on request'}
          </span>
          {alreadyShortlisted ? (
            <span className="text-xs text-black font-medium px-3 py-1.5 bg-gray-100 rounded-lg">
              Shortlisted ✓
            </span>
          ) : allSlotsFull ? (
            <span className="text-xs text-gray-400 px-3 py-1.5">Slots full</span>
          ) : (
            <button
              onClick={onShortlist}
              className="text-xs bg-black text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition"
            >
              + Shortlist
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function CounterNegotiationRow({
  interest,
  eventId,
  onAccepted,
  onCounterBack,
  onDecline,
}: {
  interest: Interest
  eventId: string
  onAccepted: (id: string) => void
  onCounterBack: (id: string) => void
  onDecline: (id: string) => void
}) {
  const { token } = useAuth()
  const [mode, setMode] = useState<'idle' | 'countering'>('idle')
  const [counterInput, setCounterInput] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleAccept = async () => {
    if (!token) return
    setAccepting(true)
    setError('')
    try {
      await api.post(`/events/${eventId}/vendor-interests/${interest.id}/accept-counter`, {}, token)
      onAccepted(interest.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setAccepting(false)
    }
  }

  const [isFinalOffer, setIsFinalOffer] = useState(false)

  const handleCounterBack = async () => {
    if (!token || !counterInput) return
    const amount = parseInt(counterInput.replace(/[^0-9]/g, ''), 10)
    if (!amount) return
    setSubmitting(true)
    setError('')
    try {
      await api.post(
        `/events/${eventId}/vendor-interests/${interest.id}/counter-back`,
        { offeredPrice: amount, isFinalOffer },
        token,
      )
      onCounterBack(interest.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 pl-10 bg-purple-50 rounded-lg p-3 border border-purple-200">
      <div className="flex items-center gap-2 mb-0.5">
        <p className="text-xs text-purple-900 font-medium">
          Vendor countered at <strong>{formatNaira(interest.counter_price!)}</strong>
        </p>
        {interest.is_final_offer && (
          <span className="text-xs bg-red-100 text-red-700 font-medium px-1.5 py-0.5 rounded">
            Final offer
          </span>
        )}
      </div>
      {interest.offered_price && (
        <p className="text-xs text-purple-600 mb-2">You offered {formatNaira(interest.offered_price)}</p>
      )}
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {mode === 'idle' ? (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="text-xs bg-purple-700 text-white px-3 py-1.5 rounded-lg hover:bg-purple-800 disabled:opacity-50 transition font-medium"
          >
            {accepting ? '...' : `Accept ${formatNaira(interest.counter_price!)}`}
          </button>
          {interest.is_final_offer ? (
            <button
              onClick={() => onDecline(interest.id)}
              className="text-xs border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition font-medium"
            >
              Decline
            </button>
          ) : (
            <button
              onClick={() => setMode('countering')}
              className="text-xs border border-purple-300 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition font-medium"
            >
              Counter back
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <input
              autoFocus
              type="number"
              min={0}
              placeholder="Your counter (₦)"
              value={counterInput}
              onChange={(e) => setCounterInput(e.target.value)}
              className="flex-1 text-xs border border-purple-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <button
              onClick={handleCounterBack}
              disabled={submitting || !counterInput}
              className="text-xs bg-purple-700 text-white px-3 py-1.5 rounded-lg hover:bg-purple-800 disabled:opacity-50 transition font-medium"
            >
              {submitting ? '...' : 'Send'}
            </button>
            <button
              onClick={() => setMode('idle')}
              className="text-xs text-purple-500 hover:text-purple-700"
            >
              Cancel
            </button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFinalOffer}
              onChange={(e) => setIsFinalOffer(e.target.checked)}
              className="rounded text-purple-600"
            />
            <span className="text-xs text-purple-700">
              Mark as final offer (vendor can only accept or decline)
            </span>
          </label>
        </div>
      )}
    </div>
  )
}

function CancellationThread({
  interest,
  eventId,
}: {
  interest: Interest
  eventId: string
}) {
  const { token } = useAuth()
  const [data, setData] = useState<CancellationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    api
      .get<CancellationStatus>(
        `/events/${eventId}/vendor-interests/${interest.id}/cancellation`,
        token,
      )
      .then((res) => setData(res))
      .catch(() => setError('Could not load cancellation details.'))
      .finally(() => setLoading(false))
  }, [token, eventId, interest.id])

  if (loading) {
    return (
      <div className="mt-3 pl-10">
        <p className="text-xs text-gray-400">Loading cancellation details...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mt-3 pl-10">
        <p className="text-xs text-red-500">{error || 'No cancellation data found.'}</p>
      </div>
    )
  }

  const badge = CANCELLATION_STATUS_BADGE[data.status]

  return (
    <div className="mt-3 pl-10">
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.style}`}>
            {badge.label}
          </span>
        </div>

        {data.cancellation_events.length === 0 ? (
          <p className="text-xs text-gray-400">No events yet.</p>
        ) : (
          <ol className="space-y-2">
            {data.cancellation_events.map((ev, idx) => (
              <li key={idx} className="flex gap-2.5">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-700">{ev.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(ev.created_at).toLocaleString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function ShortlistCard({
  interest,
  eventId,
  onRemove,
  onCommitted,
  onCancelled,
}: {
  interest: Interest
  eventId: string
  onRemove: (id: string) => void
  onCommitted: (id: string) => void
  onCancelled: (id: string) => void
}) {
  const { token } = useAuth()
  const vendor = interest.vendors
  const rank = RANK_LABEL[interest.preference_rank - 1]
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  if (!vendor) return null

  const handleCancel = async () => {
    if (!token) return
    setCancelling(true)
    setCancelError('')
    try {
      await api.post(
        `/events/${eventId}/vendor-interests/${interest.id}/cancel`,
        {},
        token,
      )
      onCancelled(interest.id)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Could not cancel booking.')
      setCancelling(false)
    }
  }

  const priceBasis = interest.agreed_price ?? interest.offered_price
  const commitmentFee = priceBasis && vendor.commitment_fee_percentage
    ? Math.round((priceBasis * vendor.commitment_fee_percentage) / 100)
    : null

  const handlePay = async () => {
    if (!token) return
    setPaying(true)
    setPayError('')
    try {
      const res = await api.post<{
        reference: string
        access_code: string
        amount_kobo: number
      }>('/payments/initialize', { interestId: interest.id }, token)

      if (!window.PaystackPop) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://js.paystack.co/v1/inline.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load Paystack'))
          document.body.appendChild(script)
        })
      }

      const handler = window.PaystackPop.resumeTransaction(res.access_code)
      handler.openIframe()

      const reference = res.reference
      const poll = setInterval(async () => {
        try {
          const verify = await api.post<{ status: string }>(
            '/payments/verify',
            { reference },
            token,
          )
          if (verify.status === 'success') {
            clearInterval(poll)
            onCommitted(interest.id)
            setPaying(false)
          }
        } catch {
          // keep polling
        }
      }, 3000)

      setTimeout(() => {
        clearInterval(poll)
        setPaying(false)
      }, 600000)
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Payment failed.')
      setPaying(false)
    }
  }

  const borderColor =
    interest.status === 'committed'
      ? 'border-blue-200 bg-blue-50'
      : interest.status === 'available'
      ? 'border-green-200 bg-green-50'
      : interest.status === 'cancelled'
      ? 'border-red-200 bg-red-50'
      : 'border-gray-200 bg-white'

  return (
    <div className={`p-3 rounded-xl border ${borderColor}`}>
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/vendors/${vendor.slug}`}
              className="font-medium text-sm text-gray-900 hover:underline leading-tight"
            >
              {vendor.name}
            </Link>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[interest.status]}`}
            >
              {STATUS_LABEL[interest.status]}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{vendor.city}</p>

          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {interest.offered_price && (
              <p className="text-xs text-gray-500">
                Your offer: <span className="font-medium text-gray-700">{formatNaira(interest.offered_price)}</span>
              </p>
            )}
            {interest.counter_price && (
              <p className="text-xs text-purple-700 font-medium">
                Counter: {formatNaira(interest.counter_price)}
              </p>
            )}
            {interest.agreed_price && (
              <p className="text-xs text-green-700 font-medium">
                Agreed: {formatNaira(interest.agreed_price)} ✓
              </p>
            )}
          </div>

          {interest.vendor_notes && (
            <p className="text-xs text-gray-600 mt-1 italic">&ldquo;{interest.vendor_notes}&rdquo;</p>
          )}

          {['available', 'quoted', 'committed'].includes(interest.status) && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {vendor.email && (
                <a href={`mailto:${vendor.email}`} className="text-xs text-blue-600 hover:underline">
                  {vendor.email}
                </a>
              )}
              {vendor.whatsapp && (
                <a
                  href={`https://wa.me/${vendor.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-700 hover:underline"
                >
                  WhatsApp: {vendor.whatsapp}
                </a>
              )}
              {vendor.phone && !vendor.whatsapp && (
                <a href={`tel:${vendor.phone}`} className="text-xs text-gray-600 hover:underline">
                  {vendor.phone}
                </a>
              )}
            </div>
          )}
        </div>

        {interest.status !== 'committed' && interest.status !== 'cancelled' && (
          <button
            onClick={() => onRemove(interest.id)}
            className="text-gray-300 hover:text-red-400 transition text-sm shrink-0 mt-0.5"
            title="Remove from shortlist"
          >
            ✕
          </button>
        )}
      </div>

      {interest.status === 'quoted' && interest.counter_price && (
        <CounterNegotiationRow
          interest={interest}
          eventId={eventId}
          onAccepted={onCommitted}
          onCounterBack={onCommitted}
          onDecline={onRemove}
        />
      )}

      {interest.status === 'available' && !confirmCancel && (
        <div className="mt-3 pl-10">
          {payError && <p className="text-xs text-red-600 mb-2">{payError}</p>}
          <button
            onClick={handlePay}
            disabled={paying}
            className="text-xs bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition font-medium"
          >
            {paying
              ? 'Opening payment...'
              : commitmentFee
              ? `Pay commitment fee — ${formatNaira(commitmentFee)}`
              : 'Pay commitment fee'}
          </button>
          <p className="text-xs text-gray-400 mt-1">
            {vendor.commitment_fee_percentage}% of {priceBasis ? formatNaira(priceBasis) : 'agreed price'} · held until after your event
          </p>
        </div>
      )}

      {['available', 'quoted', 'committed'].includes(interest.status) && !confirmCancel && (
        <div className="mt-2 pl-10">
          <button
            onClick={() => setConfirmCancel(true)}
            className="text-xs text-gray-400 hover:text-red-500 transition"
          >
            Cancel booking
          </button>
        </div>
      )}

      {confirmCancel && (
        <div className="mt-3 pl-10 bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-xs text-red-800 mb-3">
            Cancelling will return any funds still held by Owambe to you immediately. Amounts already
            released to the vendor per their payment schedule cannot be recovered.
          </p>
          {cancelError && <p className="text-xs text-red-600 mb-2">{cancelError}</p>}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition font-medium"
            >
              {cancelling ? 'Cancelling...' : 'Yes, cancel booking'}
            </button>
            <button
              onClick={() => { setConfirmCancel(false); setCancelError('') }}
              disabled={cancelling}
              className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition font-medium"
            >
              Keep booking
            </button>
          </div>
        </div>
      )}

      {interest.status === 'cancelled' && (
        <CancellationThread interest={interest} eventId={eventId} />
      )}
    </div>
  )
}

function computeSuggestedOffer(
  priceMin: number | null,
  priceMax: number | null,
  categoryBudget: number | null,
): number | null {
  if (!categoryBudget) return null
  const max = priceMax ?? priceMin
  const min = priceMin ?? 0
  if (!max) return categoryBudget
  if (max <= categoryBudget) {
    return Math.round(((min + max) / 2) / 10000) * 10000
  }
  return categoryBudget
}

function AddInterestModal({
  vendor,
  eventId,
  categoryBudget,
  existingInterests,
  guestCount,
  onAdd,
  onClose,
}: {
  vendor: Vendor
  eventId: string
  categoryBudget: number | null
  existingInterests: Interest[]
  guestCount?: number | null
  onAdd: () => void
  onClose: () => void
}) {
  const { token } = useAuth()
  const [rank, setRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isFinalOffer, setIsFinalOffer] = useState(false)

  const isCaterer = vendor.vendor_categories?.slug === 'caterers'
  const isDecorator = vendor.vendor_categories?.slug === 'decorators'
  const hasCatererMenu = isCaterer && (vendor.menu_item_names?.length ?? 0) > 0

  const suggestedOffer = computeSuggestedOffer(vendor.price_min, vendor.price_max, categoryBudget)
  const [offerAmount, setOfferAmount] = useState<string>(suggestedOffer ? String(suggestedOffer) : '')
  const isMidpoint = suggestedOffer !== null && vendor.price_max !== null && vendor.price_max <= (categoryBudget ?? 0)

  const [vendorMenu, setVendorMenu] = useState<MenuItemWithTiers[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const defaultServings = guestCount ?? 100
  const [menuSelections, setMenuSelections] = useState<Record<string, { checked: boolean; servings: number }>>({})
  const [discountPct, setDiscountPct] = useState('')

  // Decorator packages
  const decoratorGuests = guestCount ?? 100
  const [packages, setPackages] = useState<DecoratorPackage[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const hasPackages = isDecorator && packages.length > 0

  useEffect(() => {
    if (!isDecorator || !token) return
    setPackagesLoading(true)
    api
      .get<DecoratorPackage[]>(`/vendors/${vendor.slug}/packages`, token)
      .then((pkgs) => setPackages(pkgs))
      .catch(() => {})
      .finally(() => setPackagesLoading(false))
  }, [isDecorator, token, vendor.slug])

  const selectedPackage = packages.find((p) => p.id === selectedPackageId) ?? null
  const packageTotal = selectedPackage
    ? getPackagePrice(selectedPackage.decorator_package_guest_tiers, decoratorGuests)
    : 0

  useEffect(() => {
    if (!hasCatererMenu || !token) return
    setMenuLoading(true)
    api
      .get<MenuItemWithTiers[]>(`/vendors/${vendor.slug}/menu`, token)
      .then((items) => {
        setVendorMenu(items)
        const initial: Record<string, { checked: boolean; servings: number }> = {}
        items.forEach((item) => {
          initial[item.id] = { checked: false, servings: defaultServings }
        })
        setMenuSelections(initial)
      })
      .catch(() => {})
      .finally(() => setMenuLoading(false))
  }, [hasCatererMenu, token, vendor.slug, defaultServings])

  const menuTotal = vendorMenu.reduce((sum, item) => {
    const sel = menuSelections[item.id]
    if (!sel?.checked) return sum
    const price = getPricePerServing(item.caterer_menu_pricing_tiers, sel.servings)
    return sum + price * sel.servings
  }, 0)

  const categoryInterests = existingInterests.filter(
    (i) => i.vendors?.vendor_categories?.id === vendor.vendor_categories?.id,
  )
  const takenRanks = new Set(categoryInterests.map((i) => i.preference_rank))

  const handleAdd = async () => {
    if (!rank || !token) return
    setLoading(true)
    setError('')
    try {
      if (hasPackages && selectedPackage) {
        const pct = parseFloat(discountPct)
        const discountRequested = packageTotal > 0 && pct > 0 ? Math.round(packageTotal * pct / 100) : undefined
        await api.post<Interest>(
          `/events/${eventId}/vendor-interests`,
          {
            vendorId: vendor.id,
            preferenceRank: rank,
            decoratorPackageId: selectedPackage.id,
            decoratorGuestCount: decoratorGuests,
            isFinalOffer: isFinalOffer || undefined,
            discountRequested,
          },
          token,
        )
      } else if (hasCatererMenu && vendorMenu.length > 0) {
        const selections = vendorMenu
          .filter((item) => menuSelections[item.id]?.checked)
          .map((item) => ({
            menuItemId: item.id,
            servings: menuSelections[item.id].servings,
          }))
        const pct = parseFloat(discountPct)
        const discountRequested = menuTotal > 0 && pct > 0 ? Math.round(menuTotal * pct / 100) : undefined
        await api.post<Interest>(
          `/events/${eventId}/vendor-interests`,
          {
            vendorId: vendor.id,
            preferenceRank: rank,
            offeredPrice: menuTotal || undefined,
            menuSelections: selections.length > 0 ? selections : undefined,
            isFinalOffer: isFinalOffer || undefined,
            discountRequested,
          },
          token,
        )
      } else {
        const parsedOffer = offerAmount ? parseInt(offerAmount.replace(/[^0-9]/g, ''), 10) : undefined
        await api.post<Interest>(
          `/events/${eventId}/vendor-interests`,
          {
            vendorId: vendor.id,
            preferenceRank: rank,
            offeredPrice: parsedOffer || undefined,
            isFinalOffer: isFinalOffer || undefined,
          },
          token,
        )
      }
      onAdd()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add vendor.')
    } finally {
      setLoading(false)
    }
  }

  const menuByCategory = vendorMenu.reduce<Record<string, MenuItemWithTiers[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-gray-900 mb-1">
          {hasCatererMenu || hasPackages ? 'Send order' : 'Add to shortlist'}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {vendor.name} · {vendor.vendor_categories?.name}
          {vendor.price_min && vendor.price_max && !isCaterer && (
            <span className="text-gray-400"> · {formatNaira(vendor.price_min)}–{formatNaira(vendor.price_max)}</span>
          )}
        </p>

        {isDecorator ? (
          <div className="mb-4">
            {packagesLoading ? (
              <p className="text-xs text-gray-400 py-4">Loading packages...</p>
            ) : packages.length === 0 ? (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">Your offer (₦)</label>
                <input
                  type="number"
                  min={0}
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  placeholder="e.g. 1500000"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  This decorator hasn&apos;t published packages. Enter your opening offer instead.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Pricing shown for ~{decoratorGuests.toLocaleString()} guests.
                </p>
                {packages.map((pkg) => {
                  const price = getPackagePrice(pkg.decorator_package_guest_tiers, decoratorGuests)
                  const selected = selectedPackageId === pkg.id
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`w-full text-left border rounded-xl p-3 transition ${
                        selected
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 hover:border-gray-400 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">{pkg.name}</span>
                        <span className="text-sm font-bold">{formatNaira(price)}</span>
                      </div>
                      {pkg.description && (
                        <p className={`text-xs mt-1 ${selected ? 'text-gray-200' : 'text-gray-500'}`}>
                          {pkg.description}
                        </p>
                      )}
                      {pkg.includes.length > 0 && (
                        <ul className={`text-xs mt-2 space-y-0.5 ${selected ? 'text-gray-200' : 'text-gray-600'}`}>
                          {pkg.includes.map((inc, i) => (
                            <li key={i}>• {inc}</li>
                          ))}
                        </ul>
                      )}
                    </button>
                  )
                })}

                {selectedPackage && packageTotal > 0 && (
                  <div className="border-t border-gray-100 pt-3 mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">Total</span>
                      <span className="text-sm font-bold text-gray-900">{formatNaira(packageTotal)}</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Request a discount (optional)
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative w-24">
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={discountPct}
                            onChange={(e) => setDiscountPct(e.target.value)}
                            placeholder="0"
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm pr-6 focus:outline-none focus:ring-1 focus:ring-black"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                        {discountPct && parseFloat(discountPct) > 0 && (
                          <p className="text-xs text-gray-500">
                            {formatNaira(Math.round(packageTotal * parseFloat(discountPct) / 100))} off →{' '}
                            <span className="font-medium text-gray-800">
                              {formatNaira(packageTotal - Math.round(packageTotal * parseFloat(discountPct) / 100))}
                            </span>
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        The vendor can accept, decline, or counter your discount request.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isFinalOffer}
                onChange={(e) => setIsFinalOffer(e.target.checked)}
                className="rounded text-black"
              />
              <span className="text-xs text-gray-600">
                Mark as final offer (vendor can only accept or decline, no counter)
              </span>
            </label>
          </div>
        ) : hasCatererMenu ? (
          <div className="mb-4">
            {menuLoading ? (
              <p className="text-xs text-gray-400 py-4">Loading menu...</p>
            ) : vendorMenu.length === 0 ? (
              <p className="text-xs text-gray-400">Menu not available.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(menuByCategory).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat}</p>
                    <div className="space-y-3">
                      {items.map((item) => {
                        const sel = menuSelections[item.id] ?? { checked: false, servings: defaultServings }
                        const pricePerHead = getPricePerServing(item.caterer_menu_pricing_tiers, sel.servings)
                        const discounted = sel.checked && isInDiscountedTier(item.caterer_menu_pricing_tiers, sel.servings)
                        const nextTier = sel.checked ? getNextTierHint(item.caterer_menu_pricing_tiers, sel.servings) : null
                        return (
                          <div key={item.id}>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={sel.checked}
                                onChange={(e) =>
                                  setMenuSelections((prev) => ({
                                    ...prev,
                                    [item.id]: { ...sel, checked: e.target.checked },
                                  }))
                                }
                                className="rounded text-black shrink-0"
                              />
                              <span className="text-sm text-gray-800 flex-1">{item.name}</span>
                              {sel.checked && (
                                <input
                                  type="number"
                                  min={1}
                                  value={sel.servings}
                                  onChange={(e) =>
                                    setMenuSelections((prev) => ({
                                      ...prev,
                                      [item.id]: { ...sel, servings: parseInt(e.target.value, 10) || 1 },
                                    }))
                                  }
                                  className="w-20 text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-black"
                                  placeholder="servings"
                                />
                              )}
                              <span className={`text-xs shrink-0 w-24 text-right font-medium ${discounted ? 'text-green-600' : 'text-gray-400'}`}>
                                {pricePerHead ? `${formatNaira(pricePerHead)}/head` : ''}
                                {discounted && ' ↓'}
                              </span>
                            </div>
                            {nextTier && (
                              <p className="text-xs text-blue-500 mt-0.5 pl-6">
                                {formatNaira(nextTier.pricePerServing)}/head at {nextTier.minServings}+ servings
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {menuTotal > 0 && (
                  <div className="border-t border-gray-100 pt-3 mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">Total</span>
                      <span className="text-sm font-bold text-gray-900">{formatNaira(menuTotal)}</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Request a discount (optional)
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative w-24">
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={discountPct}
                            onChange={(e) => setDiscountPct(e.target.value)}
                            placeholder="0"
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm pr-6 focus:outline-none focus:ring-1 focus:ring-black"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                        {discountPct && parseFloat(discountPct) > 0 && (
                          <p className="text-xs text-gray-500">
                            {formatNaira(Math.round(menuTotal * parseFloat(discountPct) / 100))} off →{' '}
                            <span className="font-medium text-gray-800">
                              {formatNaira(menuTotal - Math.round(menuTotal * parseFloat(discountPct) / 100))}
                            </span>
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        The vendor can accept, decline, or counter your discount request.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isFinalOffer}
                onChange={(e) => setIsFinalOffer(e.target.checked)}
                className="rounded text-black"
              />
              <span className="text-xs text-gray-600">
                Mark as final offer (vendor can only accept or decline, no counter)
              </span>
            </label>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">Your offer (₦)</label>
            <input
              type="number"
              min={0}
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder="e.g. 1500000"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            {suggestedOffer && (
              <p className="text-xs text-gray-400 mt-1.5">
                {isMidpoint
                  ? `Suggested ₦${suggestedOffer.toLocaleString()} — midpoint of vendor's range, which fits within your ${formatNaira(categoryBudget!)} budget. You could save money if they accept.`
                  : `Suggested ₦${suggestedOffer.toLocaleString()} — your full ${formatNaira(categoryBudget!)} budget for this category.`}
                {' '}You can adjust up or down.
              </p>
            )}
            {!suggestedOffer && (
              <p className="text-xs text-gray-400 mt-1.5">
                Enter your opening offer. The vendor can accept or counter with a different price.
              </p>
            )}
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFinalOffer}
                onChange={(e) => setIsFinalOffer(e.target.checked)}
                className="rounded text-black"
              />
              <span className="text-xs text-gray-600">
                Mark as final offer (vendor can only accept or decline, no counter)
              </span>
            </label>
          </div>
        )}

        <p className="text-xs font-medium text-gray-600 mb-2">Choose preference slot</p>
        <div className="flex gap-2 mb-4">
          {[1, 2, 3].map((r) => {
            const taken = takenRanks.has(r)
            return (
              <button
                key={r}
                disabled={taken}
                onClick={() => setRank(r)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition ${
                  taken
                    ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                    : rank === r
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 text-gray-700 hover:border-gray-400'
                }`}
              >
                {RANK_LABEL[r - 1]}
                {taken && <span className="block text-xs font-normal mt-0.5">Taken</span>}
              </button>
            )
          })}
        </div>

        <p className="text-xs text-gray-400 mb-4">
          A = first choice, B = backup, C = third option. The vendor will be notified with your offer and asked about
          their availability.
        </p>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            disabled={!rank || loading || (hasPackages && !selectedPackage)}
            onClick={handleAdd}
            className="flex-1 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition"
          >
            {loading ? 'Sending...' : hasCatererMenu || hasPackages ? 'Send order' : 'Send offer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DishPicker({
  catalog,
  selectedDishes,
  onToggle,
}: {
  catalog: MenuCatalogCategory[]
  selectedDishes: Set<string>
  onToggle: (dish: string) => void
}) {
  if (catalog.length === 0) return null

  return (
    <div className="bg-gray-50 rounded-2xl p-4 mb-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">What would you like to serve?</p>
      <div className="space-y-3">
        {catalog.map((group) => (
          <div key={group.category}>
            <p className="text-xs font-medium text-gray-500 mb-1.5">{group.category}</p>
            <div className="flex flex-wrap gap-2">
              {group.items.map((dish) => {
                const checked = selectedDishes.has(dish)
                return (
                  <button
                    key={dish}
                    onClick={() => onToggle(dish)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      checked
                        ? 'bg-black text-white border-black'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400 bg-white'
                    }`}
                  >
                    {dish}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {selectedDishes.size > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          {selectedDishes.size} dish{selectedDishes.size !== 1 ? 'es' : ''} selected · caterers sorted by match
        </p>
      )}
    </div>
  )
}

function StylePicker({
  catalog,
  selectedStyles,
  onToggle,
}: {
  catalog: StyleCatalogItem[]
  selectedStyles: Set<string>
  onToggle: (style: string) => void
}) {
  if (catalog.length === 0) return null

  return (
    <div className="bg-gray-50 rounded-2xl p-4 mb-4">
      <p className="text-sm font-semibold text-gray-900 mb-3">What aesthetic are you going for?</p>
      <div className="flex flex-wrap gap-2">
        {catalog.map(({ style }) => {
          const checked = selectedStyles.has(style)
          return (
            <button
              key={style}
              onClick={() => onToggle(style)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                checked
                  ? 'bg-black text-white border-black'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400 bg-white'
              }`}
            >
              {style}
            </button>
          )
        })}
      </div>
      {selectedStyles.size > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          {selectedStyles.size} style{selectedStyles.size !== 1 ? 's' : ''} selected · decorators sorted by match
        </p>
      )}
    </div>
  )
}

const BUDGET_CATEGORY_TO_SLUG: Record<string, string> = {
  'Venue': 'venues', 'Catering': 'caterers', 'Decoration': 'decorators',
  'Photography': 'photographers', 'Videography': 'videographers',
  'Photography / Videography': 'photographers', 'DJ / Live Band': 'djs',
  'DJ / Entertainment': 'djs', 'Entertainment': 'djs', 'MC': 'mcs',
  'Makeup Artist': 'makeup-artists', 'Event Coordinator': 'event-coordinators',
}

type BudgetBreakdownItem = { category: string; percentage: number; amount: number | null }

export default function VendorsSection({
  eventId,
  guestCount,
  initialCategory,
  budgetBreakdown,
}: {
  eventId: string
  guestCount?: number | null
  initialCategory?: string
  budgetBreakdown?: BudgetBreakdownItem[]
}) {
  const { token } = useAuth()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [interests, setInterests] = useState<Interest[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState(initialCategory ?? '')
  const [addingVendor, setAddingVendor] = useState<Vendor | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [loadingVendors, setLoadingVendors] = useState(true)
  const [menuCatalog, setMenuCatalog] = useState<MenuCatalogCategory[]>([])
  const [selectedDishes, setSelectedDishes] = useState<Set<string>>(new Set())
  const [styleCatalog, setStyleCatalog] = useState<StyleCatalogItem[]>([])
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (initialCategory) setActiveCategory(initialCategory)
  }, [initialCategory])

  const fetchInterests = useCallback(async () => {
    if (!token) return
    const data = await api
      .get<Interest[]>(`/events/${eventId}/vendor-interests`, token)
      .catch(() => [])
    setInterests(data)
  }, [token, eventId])

  useEffect(() => {
    if (!token) return
    Promise.all([
      api.get<Vendor[]>(`/events/${eventId}/recommended-vendors`, token).catch(() => []),
      api.get<MenuCatalogCategory[]>('/vendors/menu-catalog', token).catch(() => []),
      api.get<StyleCatalogItem[]>('/vendors/style-catalog', token).catch(() => []),
    ]).then(([v, catalog, styles]) => {
      setVendors(v)
      const seen = new Set<string>()
      const cats = v
        .map((vendor) => vendor.vendor_categories)
        .filter((cat) => cat && !seen.has(cat.slug) && seen.add(cat.slug))
      setCategories(cats)
      setMenuCatalog(catalog)
      setStyleCatalog(styles)
      setLoadingVendors(false)
    })
    fetchInterests()
  }, [token, eventId, fetchInterests])

  const handleRemove = async (interestId: string) => {
    if (!token) return
    setRemoving(interestId)
    try {
      await api.delete(`/events/${eventId}/vendor-interests/${interestId}`, token)
      setInterests((prev) => prev.filter((i) => i.id !== interestId))
    } catch {
      // ignore
    } finally {
      setRemoving(null)
    }
  }

  const handleAdd = () => {
    fetchInterests()
  }

  const handleCommitted = (interestId: string) => {
    setInterests((prev) =>
      prev.map((i) => (i.id === interestId ? { ...i, status: 'committed' as const } : i)),
    )
  }

  const handleCancelled = (interestId: string) => {
    setInterests((prev) =>
      prev.map((i) => (i.id === interestId ? { ...i, status: 'cancelled' as const } : i)),
    )
  }

  const toggleDish = (dish: string) => {
    setSelectedDishes((prev) => {
      const next = new Set(prev)
      if (next.has(dish)) next.delete(dish)
      else next.add(dish)
      return next
    })
  }

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) => {
      const next = new Set(prev)
      if (next.has(style)) next.delete(style)
      else next.add(style)
      return next
    })
  }

  const interestsByCategory = interests.reduce<Record<string, { name: string; items: Interest[] }>>(
    (acc, i) => {
      const cat = i.vendors?.vendor_categories
      if (!cat) return acc
      if (!acc[cat.id]) acc[cat.id] = { name: cat.name, items: [] }
      acc[cat.id].items.push(i)
      return acc
    },
    {},
  )

  const shortlistedVendorIds = new Set(interests.map((i) => i.vendors?.id))

  const filteredVendors = activeCategory
    ? vendors.filter((v) => v.vendor_categories?.slug === activeCategory)
    : vendors

  const isCatererView =
    activeCategory === 'caterers' ||
    (activeCategory === '' && filteredVendors.every((v) => v.vendor_categories?.slug === 'caterers'))

  const isDecoratorView = activeCategory === 'decorators'

  const sortedFiltered = [...filteredVendors]
    .filter((v) => {
      const slug = v.vendor_categories?.slug
      if (slug === 'caterers' && selectedDishes.size > 0) {
        return (v.menu_item_names ?? []).some((n) => selectedDishes.has(n))
      }
      if (slug === 'decorators' && selectedStyles.size > 0) {
        return (v.style_names ?? []).some((n) => selectedStyles.has(n))
      }
      return true
    })
    .sort((a, b) => {
      const slug = a.vendor_categories?.slug
      if (slug === 'caterers' && selectedDishes.size > 0) {
        const aScore = (a.menu_item_names ?? []).filter((n) => selectedDishes.has(n)).length
        const bScore = (b.menu_item_names ?? []).filter((n) => selectedDishes.has(n)).length
        return bScore - aScore
      }
      if (slug === 'decorators' && selectedStyles.size > 0) {
        const aScore = (a.style_names ?? []).filter((n) => selectedStyles.has(n)).length
        const bScore = (b.style_names ?? []).filter((n) => selectedStyles.has(n)).length
        return bScore - aScore
      }
      return 0
    })

  const withinBudget = sortedFiltered.filter((v) => v.is_within_budget)
  const aboveBudget = sortedFiltered.filter((v) => !v.is_within_budget)

  return (
    <div className="space-y-8">
      {/* ── Shortlist ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Your shortlist</h2>
        <p className="text-xs text-gray-400 mb-4">
          Up to 3 vendors per category (A = first choice, B = backup, C = third option). Vendors are
          notified and asked to confirm availability.
        </p>

        {interests.length === 0 ? (
          <p className="text-sm text-gray-400">
            No vendors shortlisted yet. Browse recommendations below and add vendors.
          </p>
        ) : (
          <div className="space-y-5">
            {Object.entries(interestsByCategory).map(([catId, { name, items }]) => (
              <div key={catId}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {name}
                </p>
                <div className="space-y-2">
                  {items
                    .sort((a, b) => a.preference_rank - b.preference_rank)
                    .map((interest) => (
                      <ShortlistCard
                        key={interest.id}
                        interest={interest}
                        eventId={eventId}
                        onRemove={removing === interest.id ? () => {} : handleRemove}
                        onCommitted={handleCommitted}
                        onCancelled={handleCancelled}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recommended vendors ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recommended vendors</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Based on your event city and budget
              {guestCount ? ` · venues sized for ${guestCount} guests` : ''}
            </p>
          </div>
          <Link href="/vendors" className="text-sm text-black font-medium hover:underline">
            Browse all
          </Link>
        </div>

        {categories.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-4">
            <button
              onClick={() => setActiveCategory('')}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                activeCategory === ''
                  ? 'bg-black text-white border-black'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  activeCategory === cat.slug
                    ? 'bg-black text-white border-black'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {isCatererView && menuCatalog.length > 0 && (
          <DishPicker
            catalog={menuCatalog}
            selectedDishes={selectedDishes}
            onToggle={toggleDish}
          />
        )}

        {isDecoratorView && styleCatalog.length > 0 && (
          <StylePicker
            catalog={styleCatalog}
            selectedStyles={selectedStyles}
            onToggle={toggleStyle}
          />
        )}

        {loadingVendors ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-2">
              No vendors found matching your event details yet.
            </p>
            <Link href="/vendors" className="text-black text-sm font-medium hover:underline">
              Browse all vendors →
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {withinBudget.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  alreadyShortlisted={shortlistedVendorIds.has(vendor.id)}
                  slotsUsed={interests.filter((i) => i.vendors?.vendor_categories?.id === vendor.vendor_categories?.id).length}
                  onShortlist={() => setAddingVendor(vendor)}
                  selectedDishes={selectedDishes}
                  selectedStyles={selectedStyles}
                />
              ))}
            </div>

            {aboveBudget.length > 0 && !isCatererView && (
              <>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 border-t border-gray-200" />
                  <p className="text-xs text-gray-400 whitespace-nowrap">
                    {withinBudget.length > 0 ? 'Also available · above your estimated budget' : 'Available · above your estimated budget'} · sorted by price
                  </p>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {aboveBudget.map((vendor) => (
                    <VendorCard
                      key={vendor.id}
                      vendor={vendor}
                      alreadyShortlisted={shortlistedVendorIds.has(vendor.id)}
                      slotsUsed={interests.filter((i) => i.vendors?.vendor_categories?.id === vendor.vendor_categories?.id).length}
                      onShortlist={() => setAddingVendor(vendor)}
                      selectedDishes={selectedDishes}
                      selectedStyles={selectedStyles}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {addingVendor && (
        <AddInterestModal
          vendor={addingVendor}
          eventId={eventId}
          categoryBudget={(() => {
            const slug = addingVendor.vendor_categories?.slug
            const match = budgetBreakdown?.find(b => BUDGET_CATEGORY_TO_SLUG[b.category] === slug)
            return match?.amount ?? null
          })()}
          existingInterests={interests}
          guestCount={guestCount}
          onAdd={handleAdd}
          onClose={() => setAddingVendor(null)}
        />
      )}
    </div>
  )
}
