'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type EarningItem = {
  id: string
  bucket: 'commitment' | 'materials' | 'balance'
  amount_kobo: number
  scheduled_at: string
  status: 'scheduled' | 'processing' | 'released'
  vendor_interests: {
    events: { title: string; event_date: string | null; event_date_approximate: string | null; city: string | null } | null
  }
}

function formatNaira(kobo: number) {
  const naira = kobo / 100
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(naira)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

const BUCKET_LABEL: Record<string, string> = {
  commitment: 'Commitment fee',
  materials: 'Materials fee',
  balance: 'Balance payment',
}

const STATUS_STYLE: Record<string, string> = {
  released: 'bg-green-100 text-green-800',
  processing: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-gray-100 text-gray-600',
}

const STATUS_LABEL: Record<string, string> = {
  released: 'Paid out',
  processing: 'In progress',
  scheduled: 'Upcoming',
}

export default function VendorEarningsPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<EarningItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    api
      .get<EarningItem[]>('/vendor-portal/earnings', token)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const totalReleased = items.filter(i => i.status === 'released').reduce((s, i) => s + i.amount_kobo, 0)
  const totalScheduled = items.filter(i => i.status !== 'released').reduce((s, i) => s + i.amount_kobo, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading earnings…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
        <p className="text-sm text-gray-500 mt-1">Your payment release schedule across all bookings.</p>
      </div>

      {items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
            <p className="text-xs text-green-700 font-medium uppercase tracking-wide mb-1">Total paid out</p>
            <p className="text-2xl font-bold text-green-900">{formatNaira(totalReleased)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
            <p className="text-xs text-blue-700 font-medium uppercase tracking-wide mb-1">Upcoming</p>
            <p className="text-2xl font-bold text-blue-900">{formatNaira(totalScheduled)}</p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No earnings yet — you have no committed bookings.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {items.map((item) => {
            const event = item.vendor_interests?.events
            const eventDate = event?.event_date ?? event?.event_date_approximate
            const releaseDate = new Date(item.scheduled_at)
            const today = new Date()
            const daysUntil = Math.ceil((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            return (
              <div key={item.id} className="px-5 py-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{event?.title ?? '—'}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[item.status] ?? 'bg-gray-100'}`}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {BUCKET_LABEL[item.bucket] ?? item.bucket}
                    {event?.city ? ` · ${event.city}` : ''}
                    {eventDate ? ` · Event: ${formatDate(eventDate)}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.status === 'released'
                      ? `Released on ${formatDate(item.scheduled_at)}`
                      : item.status === 'processing'
                      ? 'Transfer in progress'
                      : daysUntil <= 0
                      ? 'Due for release'
                      : `Releases in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} · ${formatDate(item.scheduled_at)}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${item.status === 'released' ? 'text-green-700' : 'text-gray-900'}`}>
                    {formatNaira(item.amount_kobo)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
