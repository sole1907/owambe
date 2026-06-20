'use client'

import { useState, useEffect } from 'react'

type EventFields = {
  title: string
  eventDate: string
  eventDateApproximate: string
  city: string
  guestCount: number | null
  budgetEstimate: number | null
  styleTheme: string
}

type Props = {
  event: {
    title: string
    event_date: string | null
    event_date_approximate: string | null
    city: string | null
    guest_count_estimate: number | null
    budget_estimate: number | null
    style_theme: string | null
  }
  onSave: (fields: Partial<EventFields>) => Promise<void>
  onClose: () => void
}

export default function EditEventModal({ event, onSave, onClose }: Props) {
  const [form, setForm] = useState<EventFields>({
    title: event.title,
    eventDate: event.event_date ?? '',
    eventDateApproximate: event.event_date_approximate ?? '',
    city: event.city ?? '',
    guestCount: event.guest_count_estimate,
    budgetEstimate: event.budget_estimate,
    styleTheme: event.style_theme ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Event name is required.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch {
      setError('Could not save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Edit event details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event name</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exact date</label>
            <input
              type="date"
              value={form.eventDate}
              onChange={(e) => setForm({ ...form, eventDate: e.target.value, eventDateApproximate: '' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Approximate timeframe{' '}
              <span className="text-gray-400 font-normal text-xs">(if no exact date)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Q3 2026, December 2026"
              value={form.eventDateApproximate}
              onChange={(e) => setForm({ ...form, eventDateApproximate: e.target.value, eventDate: '' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              placeholder="e.g. Lagos"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected guests</label>
            <input
              type="number"
              min={1}
              placeholder="e.g. 200"
              value={form.guestCount ?? ''}
              onChange={(e) => setForm({ ...form, guestCount: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget estimate (₦)</label>
            <input
              type="number"
              min={0}
              placeholder="e.g. 5000000"
              value={form.budgetEstimate ?? ''}
              onChange={(e) => setForm({ ...form, budgetEstimate: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Style / theme</label>
            <input
              type="text"
              placeholder="e.g. Black & Gold, Garden Party"
              value={form.styleTheme}
              onChange={(e) => setForm({ ...form, styleTheme: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
