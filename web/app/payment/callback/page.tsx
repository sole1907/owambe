'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type PaymentStatus = {
  status: 'pending' | 'success' | 'failed' | 'refunded'
  amount_kobo: number
  vendors: { name: string }
  events: { title: string; city: string | null }
}

function formatNaira(kobo: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(kobo / 100)
}

function CallbackContent() {
  const searchParams = useSearchParams()
  const { token } = useAuth()
  const reference = searchParams.get('reference') ?? searchParams.get('trxref')

  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'no-ref'>('loading')
  const [payment, setPayment] = useState<PaymentStatus | null>(null)

  useEffect(() => {
    if (!reference) {
      setStatus('no-ref')
      return
    }

    const verify = async () => {
      // Try verify endpoint first (needs auth)
      if (token) {
        try {
          await api.post('/payments/verify', { reference }, token)
        } catch {
          // may already be confirmed via webhook
        }
      }

      // Poll public status endpoint
      for (let i = 0; i < 6; i++) {
        try {
          const data = await api.get<PaymentStatus>(`/payments/status/${reference}`)
          setPayment(data)
          if (data.status === 'success') {
            setStatus('success')
            return
          }
          if (data.status === 'failed') {
            setStatus('failed')
            return
          }
        } catch {
          // not found yet
        }
        await new Promise((r) => setTimeout(r, 2000))
      }
      setStatus('failed')
    }

    verify()
  }, [reference, token])

  if (status === 'no-ref') {
    return (
      <div className="text-center">
        <p className="text-gray-500 mb-4">No payment reference found.</p>
        <Link href="/dashboard" className="text-black text-sm font-medium hover:underline">
          Back to dashboard
        </Link>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Confirming your payment...</p>
      </div>
    )
  }

  if (status === 'success' && payment) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✅</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Payment confirmed</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your commitment fee of <strong>{formatNaira(payment.amount_kobo)}</strong> for{' '}
          <strong>{payment.vendors?.name}</strong> has been received and is held securely until after{' '}
          <strong>{payment.events?.title}</strong>.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Both you and the vendor have been notified by email.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition"
        >
          Back to dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">❌</span>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Payment not confirmed</h1>
      <p className="text-gray-500 text-sm mb-6">
        We could not confirm your payment. If money was deducted, it will be refunded within 3–5 business days.
        Please contact support with reference: <code className="bg-gray-100 px-1 rounded">{reference}</code>
      </p>
      <Link
        href="/dashboard"
        className="inline-block px-6 py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition"
      >
        Back to dashboard
      </Link>
    </div>
  )
}

export default function PaymentCallbackPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md">
        <Suspense fallback={
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Loading...</p>
          </div>
        }>
          <CallbackContent />
        </Suspense>
      </div>
    </div>
  )
}
