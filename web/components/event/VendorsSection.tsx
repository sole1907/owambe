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
}

type Interest = {
  id: string
  preference_rank: number // 1=A, 2=B, 3=C
  status: 'pending' | 'available' | 'quoted' | 'unavailable' | 'expired' | 'committed'
  event_date: string | null
  expires_at: string | null
  vendor_response_at: string | null
  vendor_notes: string | null
  offered_price: number | null
  counter_price: number | null
  agreed_price: number | null
  vendors: Vendor & {
    vendor_categories: Category
    commitment_fee_percentage: number
  }
}

function formatNaira(value: number) {
  if (value >= 1000000) return `₦${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `₦${(value / 1000).toFixed(0)}k`
  return `₦${value}`
}

const RANK_LABEL = ['A', 'B', 'C']

const STATUS_STYLES: Record<Interest['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  available: 'bg-green-100 text-green-800',
  quoted: 'bg-purple-100 text-purple-800',
  unavailable: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-500',
  committed: 'bg-blue-100 text-blue-800',
}

const STATUS_LABEL: Record<Interest['status'], string> = {
  pending: 'Awaiting response',
  available: 'Available ✓',
  quoted: 'Counter received',
  unavailable: 'Not available',
  expired: 'Expired',
  committed: 'Committed ✓',
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
}: {
  vendor: Vendor
  alreadyShortlisted: boolean
  slotsUsed: number
  onShortlist: () => void
}) {
  const allSlotsFull = slotsUsed >= 3
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
          <span className="text-xs text-gray-400 shrink-0">★ {vendor.rating}</span>
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
            {vendor.price_min && vendor.price_max
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

function ShortlistCard({
  interest,
  eventId,
  onRemove,
  onCommitted,
}: {
  interest: Interest
  eventId: string
  onRemove: (id: string) => void
  onCommitted: (id: string) => void
}) {
  const { token } = useAuth()
  const vendor = interest.vendors
  const rank = RANK_LABEL[interest.preference_rank - 1]
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState('')

  // Agreed price = counter accepted by user, or offered price if vendor accepted directly
  const priceBasis = interest.agreed_price ?? interest.offered_price
  const commitmentFee = priceBasis && vendor.commitment_fee_percentage
    ? Math.round((priceBasis * vendor.commitment_fee_percentage) / 100)
    : null

  const handleAcceptCounter = async () => {
    if (!token) return
    setAccepting(true)
    setAcceptError('')
    try {
      await api.post(
        `/events/${eventId}/vendor-interests/${interest.id}/accept-counter`,
        {},
        token,
      )
      onCommitted(interest.id)
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Failed to accept counter.')
    } finally {
      setAccepting(false)
    }
  }

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

      // Load Paystack inline JS if not already loaded
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

      // Poll for verification after popup opens (webhook handles the backend, but we also verify here)
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

      // Stop polling after 10 minutes regardless
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

          {/* Pricing summary */}
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
        </div>

        {interest.status !== 'committed' && (
          <button
            onClick={() => onRemove(interest.id)}
            className="text-gray-300 hover:text-red-400 transition text-sm shrink-0 mt-0.5"
            title="Remove from shortlist"
          >
            ✕
          </button>
        )}
      </div>

      {/* Counter-offer: vendor countered, user can accept */}
      {interest.status === 'quoted' && interest.counter_price && (
        <div className="mt-3 pl-10 bg-purple-50 rounded-lg p-3 border border-purple-200">
          <p className="text-xs text-purple-800 mb-2">
            Vendor countered at <strong>{formatNaira(interest.counter_price)}</strong>
            {interest.offered_price && ` (you offered ${formatNaira(interest.offered_price)})`}
          </p>
          {acceptError && <p className="text-xs text-red-600 mb-2">{acceptError}</p>}
          <button
            onClick={handleAcceptCounter}
            disabled={accepting}
            className="text-xs bg-purple-700 text-white px-4 py-2 rounded-lg hover:bg-purple-800 disabled:opacity-50 transition font-medium"
          >
            {accepting ? 'Accepting...' : `Accept ${formatNaira(interest.counter_price)} →`}
          </button>
        </div>
      )}

      {interest.status === 'available' && (
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
    </div>
  )
}

// Compute a smart suggested offer:
// - If vendor's max is within budget: offer the midpoint (save the user money)
// - Otherwise: offer the full budget
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
    // Vendor's full range fits within budget — start at midpoint to save money
    return Math.round(((min + max) / 2) / 10000) * 10000
  }
  return categoryBudget
}

function AddInterestModal({
  vendor,
  eventId,
  categoryBudget,
  existingInterests,
  onAdd,
  onClose,
}: {
  vendor: Vendor
  eventId: string
  categoryBudget: number | null
  existingInterests: Interest[]
  onAdd: (interest: Interest) => void
  onClose: () => void
}) {
  const { token } = useAuth()
  const [rank, setRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const suggestedOffer = computeSuggestedOffer(vendor.price_min, vendor.price_max, categoryBudget)
  const [offerAmount, setOfferAmount] = useState<string>(suggestedOffer ? String(suggestedOffer) : '')
  const isMidpoint = suggestedOffer !== null && vendor.price_max !== null && vendor.price_max <= (categoryBudget ?? 0)

  const categoryInterests = existingInterests.filter(
    (i) => i.vendors.vendor_categories?.id === vendor.vendor_categories?.id,
  )
  const takenRanks = new Set(categoryInterests.map((i) => i.preference_rank))

  const handleAdd = async () => {
    if (!rank || !token) return
    setLoading(true)
    setError('')
    try {
      const parsedOffer = offerAmount ? parseInt(offerAmount.replace(/[^0-9]/g, ''), 10) : undefined
      const result = await api.post<Interest>(
        `/events/${eventId}/vendor-interests`,
        { vendorId: vendor.id, preferenceRank: rank, offeredPrice: parsedOffer || undefined },
        token,
      )
      onAdd(result)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add vendor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-gray-900 mb-1">Add to shortlist</h3>
        <p className="text-sm text-gray-500 mb-4">
          {vendor.name} · {vendor.vendor_categories?.name}
          {vendor.price_min && vendor.price_max && (
            <span className="text-gray-400"> · {formatNaira(vendor.price_min)}–{formatNaira(vendor.price_max)}</span>
          )}
        </p>

        {/* Offer amount */}
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
        </div>

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
            disabled={!rank || loading}
            onClick={handleAdd}
            className="flex-1 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition"
          >
            {loading ? 'Sending...' : 'Send offer'}
          </button>
        </div>
      </div>
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
    ]).then(([v]) => {
      setVendors(v)
      const seen = new Set<string>()
      const cats = v
        .map((vendor) => vendor.vendor_categories)
        .filter((cat) => cat && !seen.has(cat.slug) && seen.add(cat.slug))
      setCategories(cats)
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

  const handleAdd = (newInterest: Interest) => {
    setInterests((prev) => [...prev, newInterest])
  }

  const handleCommitted = (interestId: string) => {
    setInterests((prev) =>
      prev.map((i) => (i.id === interestId ? { ...i, status: 'committed' as const } : i)),
    )
  }

  // group shortlist by category
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

  const withinBudget = filteredVendors.filter((v) => v.is_within_budget)
  const aboveBudget = filteredVendors.filter((v) => !v.is_within_budget)

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
                />
              ))}
            </div>

            {aboveBudget.length > 0 && (
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
          onAdd={handleAdd}
          onClose={() => setAddingVendor(null)}
        />
      )}
    </div>
  )
}
