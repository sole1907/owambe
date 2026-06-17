'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/auth'

type ChecklistItem = {
  id: string
  title: string
  due_date: string | null
  is_completed: boolean
  sort_order: number
}

const VENDOR_CTAS: { pattern: RegExp; slug: string; label: string }[] = [
  { pattern: /venue/i,                           slug: 'venues',            label: 'Find venues' },
  { pattern: /cater/i,                           slug: 'caterers',          label: 'Find caterers' },
  { pattern: /photograph/i,                      slug: 'photographers',     label: 'Find photographers' },
  { pattern: /videograph/i,                      slug: 'videographers',     label: 'Find videographers' },
  { pattern: /\bdj\b|live band|entertainment/i,  slug: 'djs',               label: 'Find DJs & bands' },
  { pattern: /\bmc\b/i,                          slug: 'mcs',               label: 'Find MCs' },
  { pattern: /decor/i,                           slug: 'decorators',        label: 'Find decorators' },
  { pattern: /makeup/i,                          slug: 'makeup-artists',    label: 'Find makeup artists' },
  { pattern: /coordinator|planner/i,             slug: 'event-coordinators', label: 'Find coordinators' },
]

function getCTA(title: string) {
  return VENDOR_CTAS.find((c) => c.pattern.test(title)) ?? null
}

type BudgetItem = {
  category: string
  percentage: number
  amount: number | null
}

// Maps budget category labels to vendor category slugs (mirrors backend constant)
const BUDGET_CATEGORY_TO_SLUG: Record<string, string> = {
  'Venue': 'venues',
  'Catering': 'caterers',
  'Decoration': 'decorators',
  'Photography': 'photographers',
  'Videography': 'videographers',
  'Photography / Videography': 'photographers',
  'DJ / Live Band': 'djs',
  'DJ / Entertainment': 'djs',
  'Entertainment': 'djs',
  'MC': 'mcs',
  'Makeup Artist': 'makeup-artists',
  'Event Coordinator': 'event-coordinators',
}

function fmt(v: number) {
  if (v >= 1000000) return `₦${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `₦${(v / 1000).toFixed(0)}k`
  return `₦${v}`
}

type Props = {
  eventId: string
  initialItems: ChecklistItem[]
  budgetBreakdown?: BudgetItem[]
  onFindVendors?: (categorySlug: string) => void
}

export default function ChecklistSection({ eventId, initialItems, budgetBreakdown, onFindVendors }: Props) {
  const { token } = useAuth()
  const [items, setItems] = useState<ChecklistItem[]>(
    [...initialItems].sort((a, b) => a.sort_order - b.sort_order),
  )
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const completed = items.filter((i) => i.is_completed).length

  const toggleItem = async (item: ChecklistItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_completed: !i.is_completed } : i)),
    )
    await api.patch(`/events/checklist/${item.id}`, { isCompleted: !item.is_completed }, token ?? undefined)
  }

  const addItem = async () => {
    if (!newTitle.trim()) return
    const created = await api.post<ChecklistItem>(
      `/events/${eventId}/checklist`,
      { title: newTitle.trim() },
      token ?? undefined,
    )
    setItems((prev) => [...prev, created])
    setNewTitle('')
    setAdding(false)
  }

  const saveEdit = async (id: string) => {
    if (!editingTitle.trim()) return
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, title: editingTitle } : i)))
    await api.patch(`/events/checklist/${id}`, { title: editingTitle.trim() }, token ?? undefined)
    setEditingId(null)
  }

  const deleteItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    await api.delete(`/events/checklist/${id}`, token ?? undefined)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Planning Checklist</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {completed} of {items.length} completed
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="text-sm text-black font-medium hover:underline"
        >
          + Add item
        </button>
      </div>

      {/* Budget guide */}
      {budgetBreakdown && budgetBreakdown.some((b) => b.amount) && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-amber-900 mb-2">Budget guide</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {budgetBreakdown
              .filter((b) => b.amount && BUDGET_CATEGORY_TO_SLUG[b.category])
              .map((b) => (
                <div key={b.category} className="flex items-center justify-between gap-1">
                  <span className="text-xs text-amber-800 truncate">{b.category}</span>
                  <span className="text-xs font-medium text-amber-900 shrink-0">{fmt(b.amount!)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5">
        <div
          className="bg-black h-1.5 rounded-full transition-all"
          style={{ width: items.length ? `${(completed / items.length) * 100}%` : '0%' }}
        />
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 group"
          >
            <button
              onClick={() => toggleItem(item)}
              className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${
                item.is_completed ? 'bg-black border-black' : 'border-gray-300 hover:border-black'
              }`}
            >
              {item.is_completed && (
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                  <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
            </button>

            <div className="flex-1 min-w-0">
              {editingId === item.id ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') setEditingId(null) }}
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <button onClick={() => saveEdit(item.id)} className="text-xs text-black font-medium">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                </div>
              ) : (
                <span className={`text-sm ${item.is_completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {item.title}
                </span>
              )}
              {item.due_date && !editingId && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Due {new Date(item.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
              {!item.is_completed && !editingId && onFindVendors && (() => {
                const cta = getCTA(item.title)
                return cta ? (
                  <button
                    onClick={() => onFindVendors(cta.slug)}
                    className="mt-1.5 text-xs text-black font-medium hover:underline"
                  >
                    {cta.label} →
                  </button>
                ) : null
              })()}
            </div>

            {editingId !== item.id && (
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                <button
                  onClick={() => { setEditingId(item.id); setEditingTitle(item.title) }}
                  className="text-xs text-gray-400 hover:text-black"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-3 flex gap-2">
          <input
            autoFocus
            placeholder="New checklist item..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') setAdding(false) }}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button onClick={addItem} className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800">Add</button>
          <button onClick={() => setAdding(false)} className="px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
        </div>
      )}
    </div>
  )
}
