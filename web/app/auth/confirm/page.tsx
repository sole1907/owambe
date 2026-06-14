'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth'

export default function AuthConfirmPage() {
  const { exchangeToken } = useAuth()
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const type = params.get('type')

    if (!accessToken || type !== 'signup') {
      setError('Invalid or expired confirmation link.')
      return
    }

    exchangeToken(accessToken)
      .then(() => router.replace('/dashboard'))
      .catch(() => setError('Confirmation failed. The link may have expired. Please sign up again or contact support.'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow p-8 text-center">
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <a href="/signup" className="text-black text-sm font-medium hover:underline">
            Back to sign up
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8 text-center">
        <p className="text-gray-500 text-sm">Confirming your account...</p>
      </div>
    </div>
  )
}
