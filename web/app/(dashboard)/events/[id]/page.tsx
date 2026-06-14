'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'
import ChecklistSection from '@/components/event/ChecklistSection'
import BudgetSection from '@/components/event/BudgetSection'
import VendorsSection from '@/components/event/VendorsSection'
import GuestListSection from '@/components/event/GuestListSection'
import GiftListSection from '@/components/event/GiftListSection'

type Event = {
  id: string
  title: string
  event_type: string
  event_date: string | null
  event_date_approximate: string | null
  city: string | null
  guest_count_estimate: number | null
  budget_estimate: number | null
  style_theme: string | null
  event_plans: {
    budget_breakdown: { category: string; percentage: number; amount: number | null }[]
    milestones: { title: string; weeksBeforeEvent: number; dueDate: string | null }[]
  } | null
  checklist_items: {
    id: string
    title: string
    due_date: string | null
    is_completed: boolean
    sort_order: number
  }[]
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  naming_ceremony: 'Naming Ceremony',
  corporate: 'Corporate',
  burial: 'Burial',
  other: 'Other',
}

export default function EventPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'checklist' | 'budget' | 'vendors' | 'guests' | 'gifts'>('checklist')
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const [vendorCategory, setVendorCategory] = useState('')

  const handleFindVendors = (categorySlug: string) => {
    setVendorCategory(categorySlug)
    setActiveTab('vendors')
  }

  useEffect(() => {
    if (!token || !event) return
    api
      .get<{ length: number }>(`/events/${event.id}/plus-one-requests`, token)
      .then((data: unknown) => setPendingRequestCount(Array.isArray(data) ? data.length : 0))
      .catch(() => null)
  }, [event, token])

  useEffect(() => {
    if (!token) return
    api
      .get<Event>(`/events/${id}`, token)
      .then(setEvent)
      .finally(() => setLoading(false))
  }, [id, token])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-gray-400 text-sm">Loading your event plan...</p>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Event not found.</p>
        <Link href="/dashboard" className="text-black text-sm font-medium hover:underline mt-2 inline-block">
          Back to dashboard
        </Link>
      </div>
    )
  }

  const eventDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : event.event_date_approximate || 'Date TBC'

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-black mb-3 inline-block">
          ← Dashboard
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
            <div className="flex flex-wrap gap-3 mt-2">
              <span className="text-sm text-gray-500">{EVENT_TYPE_LABELS[event.event_type] || event.event_type}</span>
              {event.city && <span className="text-sm text-gray-500">· {event.city}</span>}
              <span className="text-sm text-gray-500">· {eventDate}</span>
              {event.guest_count_estimate && (
                <span className="text-sm text-gray-500">· ~{event.guest_count_estimate.toLocaleString()} guests</span>
              )}
            </div>
          </div>
          <Link
            href={`/checkin?eventId=${event.id}`}
            target="_blank"
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition flex-shrink-0"
          >
            Check-in →
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {(['checklist', 'budget', 'vendors', 'guests', 'gifts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap capitalize transition border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === tab
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            {tab === 'checklist' ? 'Checklist' : tab === 'budget' ? 'Budget' : tab === 'vendors' ? 'Vendors' : tab === 'guests' ? 'Guests' : 'Gifts'}
            {tab === 'guests' && pendingRequestCount > 0 && (
              <span className="bg-black text-white text-xs font-medium px-1.5 py-0.5 rounded-full leading-none">
                {pendingRequestCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'checklist' && (
        <ChecklistSection
          eventId={event.id}
          initialItems={event.checklist_items}
          onFindVendors={handleFindVendors}
        />
      )}

      {activeTab === 'budget' && event.event_plans && (
        <BudgetSection
          eventId={event.id}
          totalBudget={event.budget_estimate}
          initialBreakdown={event.event_plans.budget_breakdown}
        />
      )}

      {activeTab === 'budget' && !event.event_plans && (
        <p className="text-gray-400 text-sm">No budget plan available.</p>
      )}

      {activeTab === 'vendors' && (
        <VendorsSection
          eventId={event.id}
          initialCategory={vendorCategory}
          checklistItems={event.checklist_items}
        />
      )}
      {activeTab === 'guests' && <GuestListSection eventId={event.id} />}
      {activeTab === 'gifts' && <GiftListSection eventId={event.id} />}
    </div>
  )
}
