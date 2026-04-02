'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/auth'

type BudgetItem = {
  category: string
  percentage: number
  amount: number | null
}

type Props = {
  eventId: string
  totalBudget: number | null
  initialBreakdown: BudgetItem[]
}

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function BudgetSection({ eventId, totalBudget, initialBreakdown }: Props) {
  const { token } = useAuth()
  const [breakdown, setBreakdown] = useState<BudgetItem[]>(initialBreakdown)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditValue(String(breakdown[index].percentage))
  }

  const saveEdit = async () => {
    if (editingIndex === null) return
    const newPct = Math.min(100, Math.max(1, parseInt(editValue) || 1))

    const updated = breakdown.map((item, i) =>
      i === editingIndex
        ? {
            ...item,
            percentage: newPct,
            amount: totalBudget ? Math.round((newPct / 100) * totalBudget) : null,
          }
        : item,
    )

    setBreakdown(updated)
    setEditingIndex(null)
    setSaving(true)
    await api.patch(`/events/${eventId}/budget`, { budgetBreakdown: updated }, token ?? undefined)
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Budget Breakdown</h2>
          {totalBudget && (
            <p className="text-xs text-gray-400 mt-0.5">Total: {formatNaira(totalBudget)}</p>
          )}
        </div>
        {saving && <span className="text-xs text-gray-400">Saving...</span>}
      </div>

      <div className="space-y-3">
        {breakdown.map((item, index) => (
          <div key={item.category} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-700">{item.category}</span>
                <div className="flex items-center gap-2">
                  {item.amount !== null && (
                    <span className="text-xs text-gray-400">{formatNaira(item.amount)}</span>
                  )}
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
                        className="w-14 text-xs border border-gray-300 rounded px-1.5 py-0.5 text-right focus:outline-none focus:ring-1 focus:ring-black"
                      />
                      <span className="text-xs text-gray-400">%</span>
                      <button onClick={saveEdit} className="text-xs text-black font-medium ml-1">Save</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(index)}
                      className="text-xs font-medium text-gray-600 hover:text-black w-10 text-right"
                    >
                      {item.percentage}%
                    </button>
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-black h-1.5 rounded-full transition-all"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Click any percentage to adjust the allocation for that category.
      </p>
    </div>
  )
}
