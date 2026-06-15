'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type EventSummary = {
  id: string
  title: string
  event_type: string
  event_date: string | null
  event_date_approximate: string | null
  city: string | null
  status: string
}

type ReviewableInterest = {
  id: string
  vendors: { name: string }
  events: { title: string }
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  naming_ceremony: 'Naming Ceremony',
  corporate: 'Corporate',
  burial: 'Burial',
  other: 'Other',
}

export default function DashboardPage() {
  const { user, token } = useAuth()
  const [events, setEvents] = useState<EventSummary[]>([])
  const [reviewable, setReviewable] = useState<ReviewableInterest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    Promise.all([
      api.get<EventSummary[]>('/events', token),
      api.get<ReviewableInterest[]>('/reviews/reviewable', token).catch(() => []),
    ]).then(([e, r]) => {
      setEvents(e)
      setReviewable(r)
    }).finally(() => setLoading(false))
  }, [token])

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Here are your events</p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition"
        >
          + New event
        </Link>
      </div>

      {/* Pending reviews banner */}
      {reviewable.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-medium text-amber-900 mb-2">
            You have {reviewable.length} vendor {reviewable.length === 1 ? 'review' : 'reviews'} pending
          </p>
          <div className="flex flex-wrap gap-2">
            {reviewable.map((i) => (
              <Link
                key={i.id}
                href={`/review/${i.id}`}
                className="text-xs bg-amber-900 text-white px-3 py-1.5 rounded-lg hover:bg-amber-800 transition"
              >
                Review {i.vendors?.name} →
              </Link>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : events.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-gray-500 text-sm mb-4">You haven&apos;t planned any events yet</p>
          <Link
            href="/events/new"
            className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition"
          >
            Plan your first event
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => {
            const date = event.event_date
              ? new Date(event.event_date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : event.event_date_approximate || 'Date TBC'

            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="block p-5 bg-white border border-gray-200 rounded-2xl hover:border-black transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900 mb-1">{event.title}</h2>
                    <p className="text-sm text-gray-500">
                      {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                      {event.city && ` · ${event.city}`}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">{date}</p>
                  </div>
                  <span className="text-xs text-gray-400 capitalize bg-gray-100 px-2 py-1 rounded-full">
                    {event.status}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
