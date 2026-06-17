'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/auth'

type BudgetItem = {
  category: string
  percentage: number
  amount: number | null
}

type BudgetSummaryItem = {
  category: string
  percentage: number
  recommended: number | null
  vendor_category_slug: string | null
  committed_fee: number
  projected_cost: number
  vendor_name: string | null
  interest_status: string | null
}

type BudgetSummary = {
  total_budget: number | null
  breakdown: BudgetSummaryItem[]
  total_committed_fee: number
  total_projected_cost: number
  remaining: number | null
}

type Props = {
  eventId: string
  totalBudget: number | null
  initialBreakdown: BudgetItem[]
}

function fmt(value: number) {
  if (value >= 1000000) return `₦${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `₦${(value / 1000).toFixed(0)}k`
  return `₦${value.toLocaleString()}`
}

function fmtFull(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value)
}

const STATUS_BADGE: Record<string, string> = {
  committed: 'bg-green-100 text-green-700',
  available: 'bg-blue-100 text-blue-700',
  pending: 'bg-gray-100 text-gray-500',
}

export default function BudgetSection({ eventId, totalBudget, initialBreakdown }: Props) {
  const { token } = useAuth()
  const [breakdown, setBreakdown] = useState<BudgetItem[]>(initialBreakdown)
  const [summary, setSummary] = useState<BudgetSummary | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) return
    api.get<BudgetSummary>(`/events/${eventId}/budget-summary`, token)
      .then(setSummary)
      .catch(() => null)
  }, [eventId, token])

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditValue(String(breakdown[index].percentage))
  }

  const saveEdit = async () => {
    if (editingIndex === null) return
    const newPct = Math.min(100, Math.max(1, parseInt(editValue) || 1))
    const updated = breakdown.map((item, i) =>
      i === editingIndex
        ? { ...item, percentage: newPct, amount: totalBudget ? Math.round((newPct / 100) * totalBudget) : null }
        : item,
    )
    setBreakdown(updated)
    setEditingIndex(null)
    setSaving(true)
    await api.patch(`/events/${eventId}/budget`, { budgetBreakdown: updated }, token ?? undefined)
    setSaving(false)
    // Refresh summary
    api.get<BudgetSummary>(`/events/${eventId}/budget-summary`, token ?? undefined)
      .then(setSummary).catch(() => null)
  }

  const projected = summary?.total_projected_cost ?? 0
  const committed = summary?.total_committed_fee ?? 0
  const remaining = totalBudget ? totalBudget - projected : null
  const overBudget = remaining !== null && remaining < 0

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Budget</h2>
          {totalBudget && (
            <p className="text-xs text-gray-400 mt-0.5">Total estimate: {fmtFull(totalBudget)}</p>
          )}
        </div>
        {saving && <span className="text-xs text-gray-400">Saving...</span>}
      </div>

      {/* Summary bar */}
      {totalBudget && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Committed fees</p>
              <p className="text-sm font-semibold text-gray-900">{fmt(committed)}</p>
              <p className="text-xs text-gray-400">paid so far</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Projected spend</p>
              <p className={`text-sm font-semibold ${overBudget ? 'text-red-600' : 'text-gray-900'}`}>
                {fmt(projected)}
              </p>
              <p className="text-xs text-gray-400">full vendor fees</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Remaining</p>
              <p className={`text-sm font-semibold ${overBudget ? 'text-red-600' : 'text-green-600'}`}>
                {remaining !== null ? `${overBudget ? '-' : ''}${fmt(Math.abs(remaining))}` : '—'}
              </p>
              <p className="text-xs text-gray-400">{overBudget ? 'over budget' : 'left'}</p>
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${overBudget ? 'bg-red-500' : 'bg-black'}`}
              style={{ width: `${Math.min(100, (projected / totalBudget) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {Math.round((projected / totalBudget) * 100)}% of budget allocated to vendors
          </p>
        </div>
      )}

      {/* Per-category breakdown */}
      <div className="space-y-4">
        {(summary?.breakdown ?? breakdown.map((b) => ({ ...b, recommended: b.amount, vendor_category_slug: null, committed_fee: 0, projected_cost: 0, vendor_name: null, interest_status: null }))).map((item, index) => {
          const recommended = item.recommended ?? 0
          const projectedPct = recommended > 0 ? Math.min(100, (item.projected_cost / recommended) * 100) : 0
          const committedPct = recommended > 0 ? Math.min(100, (item.committed_fee / recommended) * 100) : 0
          const isOver = item.projected_cost > 0 && item.recommended !== null && item.projected_cost > item.recommended

          return (
            <div key={item.category}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-700 truncate">{item.category}</span>
                  {item.vendor_name && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[item.interest_status ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                      {item.vendor_name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {item.recommended !== null && (
                    <span className="text-xs text-gray-400">{fmt(item.recommended)}</span>
                  )}
                  {/* Editable percentage (uses initialBreakdown index) */}
                  {editingIndex === index ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        type="number"
                        min={1}
                        max={100}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingIndex(null) }}
                        className="w-12 text-xs border border-gray-300 rounded px-1.5 py-0.5 text-right focus:outline-none focus:ring-1 focus:ring-black"
                      />
                      <span className="text-xs text-gray-400">%</span>
                      <button onClick={saveEdit} className="text-xs text-black font-medium ml-1">Save</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(index)}
                      className="text-xs font-medium text-gray-500 hover:text-black w-10 text-right"
                    >
                      {item.percentage}%
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar: recommended (full) → projected (dark) → committed fee (accent) */}
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden relative">
                {/* Projected fill */}
                <div
                  className={`absolute left-0 top-0 h-2 rounded-full transition-all ${isOver ? 'bg-red-400' : 'bg-gray-400'}`}
                  style={{ width: `${projectedPct}%` }}
                />
                {/* Committed fee overlay */}
                {committedPct > 0 && (
                  <div
                    className="absolute left-0 top-0 h-2 rounded-full transition-all bg-black"
                    style={{ width: `${committedPct}%` }}
                  />
                )}
              </div>

              {/* Row detail */}
              {(item.projected_cost > 0 || item.committed_fee > 0) && (
                <div className="flex gap-3 mt-1">
                  {item.projected_cost > 0 && (
                    <p className={`text-xs ${isOver ? 'text-red-500' : 'text-gray-500'}`}>
                      {isOver ? '⚠ ' : ''}Projected: {fmt(item.projected_cost)}
                      {isOver && item.recommended && ` (${fmt(item.projected_cost - item.recommended)} over)`}
                    </p>
                  )}
                  {item.committed_fee > 0 && (
                    <p className="text-xs text-gray-400">Fee paid: {fmt(item.committed_fee)}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-5">
        Click any percentage to adjust the allocation. Projected spend is based on shortlisted vendors&apos; service fees.
      </p>
    </div>
  )
}
