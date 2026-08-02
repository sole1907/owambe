'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type EventOption = {
  id: string
  title: string
  event_date: string | null
  event_date_approximate: string | null
  myRole?: 'owner' | 'coordinator'
}

// Lets an organiser shortlist a vendor from the vendors browse/detail pages,
// which — unlike the event's Vendors tab — have no event context of their own.
// Picks the event automatically when there's only one, otherwise asks.
export default function ShortlistButton({
  vendorSlug,
  className,
  label = '+ Shortlist',
}: {
  vendorSlug: string
  className?: string
  label?: string
}) {
  const { token } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState<EventOption[] | null>(null)
  const [noEvents, setNoEvents] = useState(false)
  const [error, setError] = useState('')

  const goToEvent = (eventId: string) => {
    router.push(`/events/${eventId}?tab=vendors&vendor=${vendorSlug}`)
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!token || loading) return
    setLoading(true)
    setError('')
    try {
      const data = await api.get<EventOption[]>('/events', token)
      const owned = data.filter((ev) => !ev.myRole || ev.myRole === 'owner')
      if (owned.length === 0) {
        setNoEvents(true)
      } else if (owned.length === 1) {
        goToEvent(owned[0].id)
      } else {
        setEvents(owned)
      }
    } catch {
      setError('Could not load your events. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const closePicker = () => {
    setEvents(null)
    setNoEvents(false)
    setError('')
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={
          className ??
          'text-xs bg-black text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition'
        }
      >
        {loading ? '...' : label}
      </button>

      {(events || noEvents || error) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { e.stopPropagation(); closePicker() }}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {noEvents ? (
              <>
                <h3 className="font-semibold text-gray-900 mb-2">Create an event first</h3>
                <p className="text-sm text-gray-500 mb-4">
                  You&apos;ll need an event to shortlist this vendor for.
                </p>
                <Link
                  href="/events/new"
                  className="block w-full py-2.5 bg-black text-white text-sm font-medium rounded-xl text-center hover:bg-gray-800 transition"
                >
                  Create event
                </Link>
              </>
            ) : error ? (
              <>
                <p className="text-sm text-red-600 mb-4">{error}</p>
                <button
                  onClick={closePicker}
                  className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-gray-900 mb-3">Shortlist for which event?</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {events!.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => goToEvent(ev.id)}
                      className="w-full text-left border border-gray-200 rounded-xl px-3 py-2.5 text-sm hover:border-black transition"
                    >
                      <span className="font-medium text-gray-900 block">{ev.title}</span>
                      <span className="block text-xs text-gray-400 mt-0.5">
                        {ev.event_date
                          ? new Date(ev.event_date).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : ev.event_date_approximate || 'Date TBC'}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
