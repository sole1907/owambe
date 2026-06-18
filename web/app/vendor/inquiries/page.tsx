'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type Inquiry = {
  id: string
  preference_rank: number
  status: 'pending' | 'available' | 'quoted' | 'unavailable' | 'expired' | 'committed'
  event_date: string | null
  expires_at: string | null
  vendor_response_at: string | null
  vendor_notes: string | null
  created_at: string
  offered_price: number | null
  counter_price: number | null
  agreed_price: number | null
  is_final_offer: boolean
  discount_requested: number | null
  discount_offered: number | null
  events: {
    id: string
    title: string
    city: string | null
    guest_count_estimate: number | null
  }
  users: {
    full_name: string | null
    email: string
    phone: string | null
  }
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

const RANK_LABEL = ['A', 'B', 'C']

const STATUS_STYLES: Record<Inquiry['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  available: 'bg-green-100 text-green-800',
  quoted: 'bg-purple-100 text-purple-800',
  unavailable: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-400',
  committed: 'bg-blue-100 text-blue-800',
}

const STATUS_LABEL: Record<Inquiry['status'], string> = {
  pending: 'Awaiting your response',
  available: 'Accepted at offered price',
  quoted: 'Counter-offer sent',
  unavailable: 'Marked unavailable',
  expired: 'Expired',
  committed: 'Commitment fee paid ✓',
}

function RespondModal({
  inquiry,
  onRespond,
  onClose,
}: {
  inquiry: Inquiry
  onRespond: (id: string, available: boolean, notes: string, counterPrice?: number, isFinalOffer?: boolean) => Promise<void>
  onClose: () => void
}) {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [counterPrice, setCounterPrice] = useState('')
  const [isFinalCounter, setIsFinalCounter] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (available === null) return
    setLoading(true)
    setError('')
    try {
      const parsed = counterPrice ? parseInt(counterPrice.replace(/[^0-9]/g, ''), 10) : undefined
      await onRespond(inquiry.id, available, notes, parsed || undefined, isFinalCounter || undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit response.')
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
        <h3 className="font-semibold text-gray-900 mb-1">Respond to inquiry</h3>
        <p className="text-sm text-gray-500 mb-1">
          {inquiry.events?.title}{inquiry.event_date ? ` · ${new Date(inquiry.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
        </p>
        <p className="text-xs text-gray-400 mb-4">
          {inquiry.is_final_offer
            ? 'This is a final offer — you can accept or decline, but cannot counter.'
            : 'Accept the offered price, suggest a counter, or decline. The organiser can accept or counter back — you can keep negotiating until you agree.'}
        </p>

        {inquiry.offered_price && (
          <div className={`mb-2 rounded-xl px-3 py-2.5 border ${inquiry.is_final_offer ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <p className={`text-xs ${inquiry.is_final_offer ? 'text-red-800' : 'text-green-800'}`}>
              Organiser&apos;s offer: <strong>{formatNaira(inquiry.offered_price)}</strong>
              {inquiry.events?.guest_count_estimate ? ` · ~${inquiry.events.guest_count_estimate.toLocaleString()} guests` : ''}
              {inquiry.is_final_offer && (
                <span className="ml-2 font-semibold">— Final offer</span>
              )}
            </p>
          </div>
        )}

        {inquiry.discount_requested && inquiry.discount_requested > 0 && (
          <div className="mb-4 rounded-xl px-3 py-2.5 border bg-amber-50 border-amber-200">
            <p className="text-xs text-amber-900">
              <span className="font-semibold">Discount requested:</span>{' '}
              Organiser is asking for a{' '}
              <strong>{formatNaira(inquiry.discount_requested)}</strong> reduction off your price.
              You can factor this into your counter-offer or decline the discount.
            </p>
          </div>
        )}

        <p className="text-xs font-medium text-gray-600 mb-2">
          {inquiry.is_final_offer ? 'Do you accept this offer?' : 'Are you available on this date?'}
        </p>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setAvailable(true)}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition ${
              available === true
                ? 'border-green-500 bg-green-500 text-white'
                : 'border-gray-200 text-gray-600 hover:border-green-300'
            }`}
          >
            {inquiry.is_final_offer ? 'Accept offer' : 'Yes, available'}
          </button>
          <button
            onClick={() => setAvailable(false)}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition ${
              available === false
                ? 'border-red-500 bg-red-500 text-white'
                : 'border-gray-200 text-gray-600 hover:border-red-300'
            }`}
          >
            {inquiry.is_final_offer ? 'Decline offer' : 'Not available'}
          </button>
        </div>

        {available === true && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Your price (₦) — leave blank to accept the offer
            </label>
            <input
              type="number"
              min={0}
              value={counterPrice}
              onChange={(e) => setCounterPrice(e.target.value)}
              placeholder={inquiry.offered_price ? `Offered: ${inquiry.offered_price.toLocaleString()}` : 'Your price'}
              disabled={inquiry.is_final_offer}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-400"
            />
            {inquiry.is_final_offer ? (
              <p className="text-xs text-red-600 mt-1">
                This is a final offer — you can accept or decline, but cannot counter.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-400 mt-1">
                  If you enter a different price, the organiser will be asked to accept your counter-offer.
                </p>
                {counterPrice && (
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFinalCounter}
                      onChange={(e) => setIsFinalCounter(e.target.checked)}
                      className="rounded text-black"
                    />
                    <span className="text-xs text-gray-600">
                      Mark as final counter (organiser can only accept or decline)
                    </span>
                  </label>
                )}
              </>
            )}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Message to organiser (optional)
          </label>
          <textarea
            rows={2}
            placeholder={
              available === false
                ? inquiry.is_final_offer
                  ? 'e.g. The budget doesn\'t work for us at this scale.'
                  : 'e.g. I am fully booked on that date.'
                : 'e.g. Looking forward to it! Deposit secures the date.'
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            disabled={available === null || loading}
            onClick={handleSubmit}
            className="flex-1 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition"
          >
            {loading ? 'Submitting...' : 'Submit response'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VendorInquiriesPage() {
  const { token } = useAuth()
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<Inquiry | null>(null)

  useEffect(() => {
    if (!token) return
    api
      .get<Inquiry[]>('/vendor-portal/inquiries', token)
      .then(setInquiries)
      .finally(() => setLoading(false))
  }, [token])

  const handleRespond = async (id: string, available: boolean, notes: string, counterPrice?: number, isFinalOffer?: boolean) => {
    if (!token) return
    await api.patch(
      `/vendor-portal/inquiries/${id}`,
      { available, notes: notes || undefined, counterPrice: counterPrice || undefined, isFinalOffer: isFinalOffer || undefined },
      token,
    )
    setInquiries((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i
        const newStatus = !available ? 'unavailable' : counterPrice ? 'quoted' : 'available'
        return {
          ...i,
          status: newStatus as Inquiry['status'],
          vendor_notes: notes || null,
          counter_price: counterPrice ?? null,
          vendor_response_at: new Date().toISOString(),
        }
      }),
    )
  }

  // pending = needs vendor response (includes user counter-backs)
  // monitoring = vendor has responded, waiting on organiser or finalised
  const pending = inquiries.filter((i) => i.status === 'pending')
  const monitoring = inquiries.filter((i) => i.status !== 'pending')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Inquiries</h1>
      <p className="text-gray-500 text-sm mb-8">
        Event organisers who have shortlisted you. Respond within 48 hours to confirm availability.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : inquiries.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No inquiries yet. When organisers shortlist you for their event, they will appear here.
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">
                Needs your response ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((inquiry) => (
                  <InquiryCard
                    key={inquiry.id}
                    inquiry={inquiry}
                    onRespond={() => setResponding(inquiry)}
                  />
                ))}
              </div>
            </section>
          )}

          {monitoring.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">Active &amp; past</h2>
              <div className="space-y-3">
                {monitoring.map((inquiry) => (
                  <InquiryCard key={inquiry.id} inquiry={inquiry} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {responding && (
        <RespondModal
          inquiry={responding}
          onRespond={handleRespond}
          onClose={() => setResponding(null)}
        />
      )}
    </div>
  )
}

function InquiryCard({
  inquiry,
  onRespond,
}: {
  inquiry: Inquiry
  onRespond?: () => void
}) {
  const rank = RANK_LABEL[inquiry.preference_rank - 1]
  const expiresIn =
    inquiry.status === 'pending' && inquiry.expires_at
      ? Math.max(
          0,
          Math.round((new Date(inquiry.expires_at).getTime() - Date.now()) / (1000 * 60 * 60)),
        )
      : null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
              {rank}
            </span>
            <h3 className="font-semibold text-gray-900 text-sm">{inquiry.events?.title}</h3>
          </div>
          <p className="text-xs text-gray-500">
            {inquiry.events?.city && `${inquiry.events.city} · `}
            {inquiry.event_date
              ? new Date(inquiry.event_date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : 'Date TBC'}
            {inquiry.events?.guest_count_estimate ? ` · ~${inquiry.events.guest_count_estimate.toLocaleString()} guests` : ''}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${STATUS_STYLES[inquiry.status]}`}
        >
          {STATUS_LABEL[inquiry.status]}
        </span>
      </div>

      <div className="text-xs text-gray-500 mb-3">
        <p>
          From: {inquiry.users?.full_name || 'Organiser'} ({inquiry.users?.email})
          {inquiry.users?.phone && ` · ${inquiry.users.phone}`}
        </p>
        {(inquiry.offered_price || inquiry.agreed_price) && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {inquiry.offered_price && (
              <span className="text-green-700 font-medium">
                Their offer: {formatNaira(inquiry.offered_price)}
              </span>
            )}
            {inquiry.counter_price && (
              <span className="text-purple-700 font-medium">
                Your counter: {formatNaira(inquiry.counter_price)}
              </span>
            )}
            {inquiry.agreed_price && (
              <span className="text-blue-700 font-medium">
                Agreed: {formatNaira(inquiry.agreed_price)} ✓
              </span>
            )}
          </div>
        )}
        {inquiry.discount_requested && inquiry.discount_requested > 0 && (
          <p className="mt-1.5 text-amber-700 font-medium">
            Discount requested: {formatNaira(inquiry.discount_requested)} off
          </p>
        )}
      </div>

      {inquiry.vendor_notes && (
        <p className="text-xs text-gray-600 italic mb-3">Your note: &ldquo;{inquiry.vendor_notes}&rdquo;</p>
      )}

      <div className="flex items-center justify-between">
        {expiresIn !== null && (
          <p className={`text-xs ${expiresIn < 6 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {expiresIn === 0 ? 'Expiring soon' : `Expires in ~${expiresIn}h`}
          </p>
        )}
        {inquiry.vendor_response_at && !onRespond && (
          <p className="text-xs text-gray-400">
            Responded{' '}
            {new Date(inquiry.vendor_response_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}
          </p>
        )}
        {onRespond && (
          <button
            onClick={onRespond}
            className="ml-auto text-xs bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
          >
            Respond
          </button>
        )}
      </div>
    </div>
  )
}
