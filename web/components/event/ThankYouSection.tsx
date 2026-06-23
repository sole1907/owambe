'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Target = 'attendees' | 'gifters' | 'all'

type Preview = {
  attendeeCount: number
  gifterCount: number
  totalCount: number
}

type Props = { eventId: string }

const TARGET_LABELS: Record<Target, string> = {
  attendees: 'Guests (non-declined)',
  gifters: 'Gifters with email',
  all: 'Everyone',
}

const DEFAULT_SUBJECT = 'Thank you for celebrating with us!'

const DEFAULT_MESSAGE = `Thank you so much for being part of our special day. Your presence, support, and generosity made it truly unforgettable.

We are deeply grateful for everything.

With love and appreciation`

export default function ThankYouSection({ eventId }: Props) {
  const { token } = useAuth()
  const [target, setTarget] = useState<Target>('all')
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchPreview = async () => {
    if (!token) return
    setPreviewLoading(true)
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/thank-you/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      })
      const data = await res.json()
      if (res.ok) setPreview(data)
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    fetchPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, token])

  const send = async () => {
    if (!subject.trim() || !message.trim()) return
    setSending(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/thank-you`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target, subject: subject.trim(), message: message.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to send')
      setResult({ sent: data.sent, failed: data.failed })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  if (result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <p className="text-2xl mb-2">✉️</p>
        <p className="text-sm font-semibold text-green-800">
          Thank you messages sent to {result.sent} {result.sent === 1 ? 'person' : 'people'}!
        </p>
        {result.failed > 0 && (
          <p className="text-xs text-amber-600 mt-1">{result.failed} could not be delivered.</p>
        )}
        <button
          onClick={() => { setResult(null) }}
          className="mt-4 text-xs text-gray-500 hover:text-black underline"
        >
          Send another
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Recipient selector */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Send to</p>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'attendees', 'gifters'] as Target[]).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                target === t
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {TARGET_LABELS[t]}
            </button>
          ))}
        </div>
        {preview && (
          <p className="text-xs text-gray-400 mt-2">
            {previewLoading
              ? 'Counting…'
              : `${preview.totalCount} recipient${preview.totalCount !== 1 ? 's' : ''}`
              + (target === 'all' && preview.totalCount > 0
                ? ` (${preview.attendeeCount} guests · ${preview.gifterCount} gifters with email)`
                : '')}
          </p>
        )}
      </div>

      {/* Subject */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Subject
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      {/* Message */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
          Message
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Each recipient will see their own name at the top. Write your message naturally — no placeholders needed.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={8}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none font-sans"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={send}
        disabled={sending || !subject.trim() || !message.trim() || (preview?.totalCount === 0)}
        className="w-full py-3 bg-black text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-gray-800"
      >
        {sending
          ? 'Sending…'
          : preview?.totalCount
            ? `Send to ${preview.totalCount} ${preview.totalCount === 1 ? 'person' : 'people'}`
            : 'Send thank you'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Each person receives a personalised email with their name. You can only send once per session.
      </p>
    </div>
  )
}
