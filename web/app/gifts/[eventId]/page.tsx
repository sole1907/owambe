'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type GiftItem = {
  id: string
  title: string
  description: string | null
  price_estimate: number | null
  is_purchased: boolean
  purchased_by: string | null
}

type Event = {
  id: string
  title: string
  event_date: string | null
  event_date_approximate: string | null
  city: string | null
  event_type: string
}

type GiftListData = {
  event: Event
  items: GiftItem[]
  cashContributionEnabled: boolean
  cashContributionLink: string | null
}

export default function PublicGiftListPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [data, setData] = useState<GiftListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/events/${eventId}/gift-list`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [eventId])

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading gift list...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Gift list not found.</p>
      </div>
    )
  }

  const { event, items, cashContributionEnabled, cashContributionLink } = data

  const eventDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : event.event_date_approximate || null

  const purchased = items.filter((i) => i.is_purchased).length
  const total = items.length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-8">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Gift list</p>
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          <div className="flex flex-wrap gap-3 mt-2">
            {eventDate && <span className="text-sm text-gray-500">{eventDate}</span>}
            {event.city && <span className="text-sm text-gray-500">· {event.city}</span>}
          </div>
          {total > 0 && (
            <p className="text-sm text-gray-400 mt-3">
              {purchased} of {total} item{total !== 1 ? 's' : ''} purchased
            </p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Cash contribution card */}
        {cashContributionEnabled && cashContributionLink && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-gray-900">Cash contribution</p>
            <p className="text-xs text-gray-500 mt-1">
              Send a cash gift in any amount via Paystack — secure and instant.
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href={cashContributionLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800"
              >
                Contribute cash →
              </a>
              <button
                onClick={() => copyLink(cashContributionLink)}
                className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-100"
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
        )}

        {/* Gift items */}
        {items.length === 0 && !cashContributionEnabled ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">No gift list items yet</p>
          </div>
        ) : (
          <>
            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border ${
                      item.is_purchased
                        ? 'bg-gray-50 border-gray-100'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    {/* Purchased indicator */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        item.is_purchased
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {item.is_purchased && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          item.is_purchased ? 'line-through text-gray-400' : 'text-gray-900'
                        }`}
                      >
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                      )}
                      {item.is_purchased && item.purchased_by && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Purchased by {item.purchased_by}
                        </p>
                      )}
                      {item.is_purchased && !item.purchased_by && (
                        <p className="text-xs text-green-600 mt-0.5">Already purchased</p>
                      )}
                    </div>

                    {item.price_estimate && (
                      <span className="text-sm font-medium text-gray-700 flex-shrink-0">
                        ₦{item.price_estimate.toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
