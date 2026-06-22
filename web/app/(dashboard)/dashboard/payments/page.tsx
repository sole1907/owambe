'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type Payment = {
  id: string
  status: 'pending' | 'success' | 'failed'
  amount_kobo: number
  platform_fee_kobo: number
  commitment_pct: number
  paid_at: string | null
  created_at: string
  vendors: { name: string; vendor_categories: { name: string } | null } | null
  events: { title: string; event_date: string | null; event_date_approximate: string | null; city: string | null } | null
}

function formatNaira(kobo: number) {
  const naira = kobo / 100
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(naira)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_STYLE: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
}

export default function PaymentsHistoryPage() {
  const { token } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    api
      .get<Payment[]>('/payments/history', token)
      .then(setPayments)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const totalPaid = payments.filter(p => p.status === 'success').reduce((s, p) => s + p.amount_kobo + p.platform_fee_kobo, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading payment history…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
        <p className="text-sm text-gray-500 mt-1">All commitment payments made through Owambe.</p>
      </div>

      {payments.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Total paid:</span> {formatNaira(totalPaid)} across {payments.filter(p => p.status === 'success').length} successful payment{payments.filter(p => p.status === 'success').length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm mb-2">No payments yet.</p>
          <Link href="/dashboard" className="text-black text-sm font-medium hover:underline">
            Go to your events →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {payments.map((p) => {
            const eventDate = p.events?.event_date ?? p.events?.event_date_approximate
            const isFullPayment = p.commitment_pct === 100
            return (
              <div key={p.id} className="px-5 py-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{p.vendors?.name ?? '—'}</p>
                    {p.vendors?.vendor_categories?.name && (
                      <span className="text-xs text-gray-400">{p.vendors.vendor_categories.name}</span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {p.status === 'success' ? 'Paid' : p.status === 'pending' ? 'Pending' : 'Failed'}
                    </span>
                    {isFullPayment && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                        Full payment
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{p.events?.title ?? '—'} · {p.events?.city ?? ''} · {formatDate(eventDate ?? null)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Paid on {formatDate(p.paid_at ?? p.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{formatNaira(p.amount_kobo)}</p>
                  {p.platform_fee_kobo > 0 && (
                    <p className="text-xs text-gray-400">+ {formatNaira(p.platform_fee_kobo)} platform fee</p>
                  )}
                  {!isFullPayment && (
                    <p className="text-xs text-gray-400">{p.commitment_pct}% commitment</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
