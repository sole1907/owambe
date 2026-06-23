'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type State = 'loading' | 'accepting' | 'success' | 'already' | 'error' | 'needs_login'

export default function AcceptCoordinatorInvitePage() {
  const params = useSearchParams()
  const router = useRouter()
  const { token } = useAuth()
  const token_param = params.get('token') ?? ''

  const [state, setState] = useState<State>('loading')
  const [eventId, setEventId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!token_param) { setState('error'); setErrorMsg('Invalid invite link.'); return }
    if (!token) { setState('needs_login'); return }
    accept()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, token_param])

  const accept = async () => {
    setState('accepting')
    try {
      const res = await fetch(`${API_URL}/collaborators/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: token_param }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to accept invite')

      setEventId(data.eventId)
      setState(data.alreadyAccepted ? 'already' : 'success')

      setTimeout(() => {
        router.push(`/events/${data.eventId}`)
      }, 2000)
    } catch (e: unknown) {
      setState('error')
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
        {state === 'loading' && (
          <p className="text-gray-400 text-sm">Loading…</p>
        )}

        {state === 'needs_login' && (
          <>
            <p className="text-2xl mb-3">🔐</p>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Sign in to accept</h1>
            <p className="text-sm text-gray-500 mb-6">
              You need to be signed in to accept this coordinator invitation.
            </p>
            <Link
              href={`/auth/login?redirect=/coordinator/accept?token=${token_param}`}
              className="block w-full py-3 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800"
            >
              Sign in →
            </Link>
            <p className="text-xs text-gray-400 mt-3">
              Don&apos;t have an account?{' '}
              <Link
                href={`/auth/register?redirect=/coordinator/accept?token=${token_param}`}
                className="underline"
              >
                Create one
              </Link>
            </p>
          </>
        )}

        {state === 'accepting' && (
          <>
            <p className="text-2xl mb-3">⏳</p>
            <p className="text-sm text-gray-500">Accepting invitation…</p>
          </>
        )}

        {state === 'success' && (
          <>
            <p className="text-2xl mb-3">🎉</p>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">You&apos;re in!</h1>
            <p className="text-sm text-gray-500 mb-1">
              You&apos;re now a coordinator on this event.
            </p>
            <p className="text-xs text-gray-400">Taking you to the event dashboard…</p>
          </>
        )}

        {state === 'already' && (
          <>
            <p className="text-2xl mb-3">✓</p>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Already accepted</h1>
            <p className="text-sm text-gray-500 mb-1">You already have access to this event.</p>
            {eventId && (
              <Link
                href={`/events/${eventId}`}
                className="block mt-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800"
              >
                Go to event →
              </Link>
            )}
          </>
        )}

        {state === 'error' && (
          <>
            <p className="text-2xl mb-3">⚠️</p>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Invite not valid</h1>
            <p className="text-sm text-gray-500 mb-4">{errorMsg}</p>
            <Link href="/dashboard" className="text-sm text-gray-500 underline">
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
