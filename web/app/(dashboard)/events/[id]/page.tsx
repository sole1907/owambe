'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'
import ChecklistSection from '@/components/event/ChecklistSection'
import BudgetSection from '@/components/event/BudgetSection'
import VendorsSection from '@/components/event/VendorsSection'
import GuestListSection from '@/components/event/GuestListSection'
import GiftListSection from '@/components/event/GiftListSection'
import TeamSection from '@/components/event/TeamSection'
import EditEventModal from '@/components/event/EditEventModal'

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
  myRole?: 'owner' | 'coordinator'
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const tabParam = searchParams.get('tab')
  const validTabs = ['checklist', 'budget', 'vendors', 'guests', 'gifts', 'team'] as const
  type TabType = typeof validTabs[number]
  const [activeTab, setActiveTab] = useState<TabType>(
    validTabs.includes(tabParam as TabType) ? (tabParam as TabType) : 'checklist',
  )
  const [pendingRequestCount, setPendingRequestCount] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [initialVendorCategory, setInitialVendorCategory] = useState('')

  const handleSaveEvent = async (fields: Parameters<typeof api.patch>[1]) => {
    if (!event || !token) return
    await api.patch(`/events/${event.id}`, fields, token)
    setEvent({ ...event, ...(fields as Partial<Event>) })
    // Refresh to get recalculated due dates
    const updated = await api.get<Event>(`/events/${event.id}`, token)
    setEvent(updated)
  }

  const handleDelete = async () => {
    if (!event || !token) return
    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete(`/events/${event.id}`, token)
      router.push('/dashboard')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete event.')
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (!token || !event) return
    api
      .get<unknown>(`/events/${event.id}/plus-one-requests`, token)
      .then((data) => setPendingRequestCount(Array.isArray(data) ? data.length : 0))
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

  const isOwner = !event.myRole || event.myRole === 'owner'
  const isApproxDate = !event.event_date && !!event.event_date_approximate
  const eventDateLabel = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : event.event_date_approximate || 'Date TBC'

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-black mb-3 inline-block">
          ← Dashboard
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{event.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              <span className="text-sm text-gray-500">{EVENT_TYPE_LABELS[event.event_type] || event.event_type}</span>
              {event.city && <span className="text-sm text-gray-500">· {event.city}</span>}
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                · {eventDateLabel}
                {isApproxDate && (
                  <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
                    Estimated
                  </span>
                )}
              </span>
              {event.guest_count_estimate && (
                <span className="text-sm text-gray-500">· ~{event.guest_count_estimate.toLocaleString()} guests</span>
              )}
              {event.style_theme && (
                <span className="text-sm text-gray-500">· {event.style_theme}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!isOwner && (
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg font-medium">
                Coordinator
              </span>
            )}
            {isOwner && (
              <button
                onClick={() => setEditOpen(true)}
                className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
              >
                Edit
              </button>
            )}
            <Link
              href={`/checkin?eventId=${event.id}`}
              target="_blank"
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition"
            >
              Check-in →
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {(['checklist', 'budget', 'vendors', 'guests', 'gifts', ...(isOwner ? ['team'] : [])] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap capitalize transition border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === tab
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            {tab === 'checklist' ? 'Checklist' : tab === 'budget' ? 'Budget' : tab === 'vendors' ? 'Vendors' : tab === 'guests' ? 'Guests' : tab === 'team' ? 'Team' : 'Gifts'}
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
          budgetBreakdown={event.event_plans?.budget_breakdown}
          totalBudget={event.budget_estimate}
          onFindVendors={(slug) => { setInitialVendorCategory(slug); setActiveTab('vendors') }}
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
          guestCount={event.guest_count_estimate}
          initialCategory={initialVendorCategory}
          budgetBreakdown={event.event_plans?.budget_breakdown}
        />
      )}
      {activeTab === 'guests' && <GuestListSection eventId={event.id} />}
      {activeTab === 'gifts' && <GiftListSection eventId={event.id} />}
      {activeTab === 'team' && isOwner && <TeamSection eventId={event.id} />}

      {/* Danger zone — owners only */}
      {isOwner && (
        <div className="mt-12 pt-6 border-t border-gray-100">
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="text-sm text-red-500 hover:text-red-700 hover:underline transition"
            >
              Delete this event
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-w-md">
              <p className="text-sm text-red-700 mb-3">
                Are you sure you want to delete <span className="font-medium">{event.title}</span>? This will permanently remove the event and all associated data.
              </p>
              {deleteError && (
                <p className="text-xs text-red-600 bg-red-100 rounded-lg px-3 py-2 mb-3">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteError('') }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 bg-white text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editOpen && (
        <EditEventModal
          event={event}
          onSave={handleSaveEvent}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  )
}
