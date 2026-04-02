'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { api } from '@/lib/api'

type Invite = {
  id: string
  full_name: string
  allocation: number
  checked_in_count: number
  rsvp_status: string
  qr_code_url: string | null
  token: string
  event: {
    id: string
    title: string
    event_type: string
    event_date: string | null
    event_date_approximate: string | null
    city: string | null
    location: string | null
  } | null
  pendingPlusOneRequest: {
    id: string
    requested_count: number
    status: string
  } | null
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  naming_ceremony: 'Naming Ceremony',
  corporate: 'Corporate Event',
  burial: 'Burial',
  other: 'Event',
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showPlusOneForm, setShowPlusOneForm] = useState(false)
  const [plusOneCount, setPlusOneCount] = useState(1)
  const [plusOneReason, setPlusOneReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    api
      .get<Invite>(`/invites/${token}`)
      .then(setInvite)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const handlePlusOneRequest = async () => {
    setSubmitting(true)
    try {
      await api.post(`/invites/${token}/request-plus-one`, {
        requestedCount: plusOneCount,
        reason: plusOneReason || undefined,
      })
      setSubmitted(true)
      setShowPlusOneForm(false)
      setInvite((prev) =>
        prev
          ? {
              ...prev,
              pendingPlusOneRequest: {
                id: '',
                requested_count: plusOneCount,
                status: 'pending',
              },
            }
          : prev,
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading your invite...</p>
      </div>
    )
  }

  if (notFound || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-2xl mb-2">🤔</p>
          <p className="text-gray-700 font-medium">Invite not found</p>
          <p className="text-gray-400 text-sm mt-1">This invite link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  const event = invite.event
  const eventDate = event?.event_date
    ? new Date(event.event_date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : event?.event_date_approximate || 'Date TBC'

  const extraGuests = invite.allocation - 1

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-10 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-sm text-gray-400 mb-1">
            {event ? EVENT_TYPE_LABELS[event.event_type] || 'Event' : 'Event'}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{event?.title ?? 'Your Invite'}</h1>
          {event && (
            <div className="mt-2 space-y-0.5">
              <p className="text-sm text-gray-500">{eventDate}</p>
              {(event.location || event.city) && (
                <p className="text-sm text-gray-500">
                  {[event.location, event.city].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Invite card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="text-center mb-5">
            <p className="text-sm text-gray-500 mb-0.5">Invited guest</p>
            <p className="text-lg font-semibold text-gray-900">{invite.full_name}</p>
            <p className="text-sm text-gray-500 mt-1">
              {invite.allocation === 1
                ? 'You only'
                : `You + ${extraGuests} guest${extraGuests !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* QR code */}
          <div className="flex justify-center mb-4">
            {invite.qr_code_url ? (
              <Image
                src={invite.qr_code_url}
                alt="Your invite QR code"
                width={180}
                height={180}
                className="rounded-xl"
              />
            ) : (
              <div className="w-44 h-44 bg-gray-100 rounded-xl flex items-center justify-center">
                <p className="text-xs text-gray-400">QR code generating...</p>
              </div>
            )}
          </div>

          <p className="text-xs text-center text-gray-400">
            Show this QR code at the entrance
          </p>
        </div>

        {/* Plus-one request section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          {invite.pendingPlusOneRequest ? (
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Plus-one request pending</p>
              <p className="text-xs text-gray-400 mt-1">
                You requested {invite.pendingPlusOneRequest.requested_count} extra spot
                {invite.pendingPlusOneRequest.requested_count !== 1 ? 's' : ''}.
                Waiting for host approval.
              </p>
            </div>
          ) : submitted ? (
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Request sent!</p>
              <p className="text-xs text-gray-400 mt-1">
                The host will review your request and you&apos;ll be notified by email.
              </p>
            </div>
          ) : showPlusOneForm ? (
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-3">Request extra spots</p>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  How many extra spots do you need?
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={plusOneCount}
                  onChange={(e) => setPlusOneCount(parseInt(e.target.value) || 1)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Reason <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. I'd like to bring my partner"
                  value={plusOneReason}
                  onChange={(e) => setPlusOneReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePlusOneRequest}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-black text-white text-sm rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Send request'}
                </button>
                <button
                  onClick={() => setShowPlusOneForm(false)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">Need to bring more people?</p>
              <button
                onClick={() => setShowPlusOneForm(true)}
                className="w-full py-2.5 border border-gray-300 text-gray-800 text-sm rounded-lg font-medium hover:bg-gray-50 transition"
              >
                Request extra spots
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">Powered by Owambe</p>
      </div>
    </div>
  )
}
