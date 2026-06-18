'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type PricingTier = {
  id: string
  min_servings: number
  max_servings: number | null
  price_per_serving: number
}

type MenuItem = {
  id: string
  name: string
  category: string
  description: string | null
  caterer_menu_pricing_tiers: PricingTier[]
}

const CATEGORIES = [
  'Rice Dishes',
  'Swallows & Soups',
  'Small Chops',
  'Proteins',
  'Drinks',
]

type MenuItemFormData = {
  name: string
  category: string
  description: string
  tiers: { min_servings: number; max_servings: number | null; price_per_serving: number }[]
}

function formatNaira(value: number) {
  if (value >= 1_000_000) {
    const str = (value / 1_000_000).toFixed(2).replace(/\.?0+$/, '')
    return `₦${str}M`
  }
  if (value >= 1_000) {
    const str = (value / 1_000).toFixed(1).replace(/\.?0+$/, '')
    return `₦${str}k`
  }
  return `₦${value.toLocaleString()}`
}

function tiersSummary(tiers: PricingTier[]): string {
  if (!tiers || tiers.length === 0) return 'No pricing'
  const sorted = [...tiers].sort((a, b) => a.min_servings - b.min_servings)
  return sorted.map((t) => `₦${t.price_per_serving.toLocaleString()}`).join(' · ')
}

type TierDraft = {
  min_servings: string
  max_servings: string
  price_per_serving: string
}

const emptyTier = (): TierDraft => ({ min_servings: '', max_servings: '', price_per_serving: '' })

function ItemForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: MenuItem
  onSave: (data: MenuItemFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0])
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tiers, setTiers] = useState<TierDraft[]>(
    initial?.caterer_menu_pricing_tiers?.length
      ? initial.caterer_menu_pricing_tiers
          .sort((a, b) => a.min_servings - b.min_servings)
          .map((t) => ({
            min_servings: String(t.min_servings),
            max_servings: t.max_servings !== null ? String(t.max_servings) : '',
            price_per_serving: String(t.price_per_serving),
          }))
      : [emptyTier()],
  )

  const handleTierChange = (idx: number, field: keyof TierDraft, value: string) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)))
  }

  const handleSubmit = () => {
    const parsedTiers = tiers
      .filter((t) => t.min_servings && t.price_per_serving)
      .map((t) => ({
        min_servings: parseInt(t.min_servings, 10),
        max_servings: t.max_servings ? parseInt(t.max_servings, 10) : null,
        price_per_serving: parseInt(t.price_per_serving, 10),
      }))
    if (!name.trim() || parsedTiers.length === 0) return
    onSave({ name: name.trim(), category, description: description.trim(), tiers: parsedTiers })
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jollof Rice"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Pricing tiers (up to 3)</label>
        <div className="space-y-2">
          {tiers.map((tier, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <div className="flex-1">
                <input
                  type="number"
                  min={0}
                  value={tier.min_servings}
                  onChange={(e) => handleTierChange(idx, 'min_servings', e.target.value)}
                  placeholder="Min servings"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  min={0}
                  value={tier.max_servings}
                  onChange={(e) => handleTierChange(idx, 'max_servings', e.target.value)}
                  placeholder="Max servings (blank = no limit)"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  min={0}
                  value={tier.price_per_serving}
                  onChange={(e) => handleTierChange(idx, 'price_per_serving', e.target.value)}
                  placeholder="₦ per head"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              {tiers.length > 1 && (
                <button
                  onClick={() => setTiers((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-gray-300 hover:text-red-400 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {tiers.length < 3 && (
          <button
            onClick={() => setTiers((prev) => [...prev, emptyTier()])}
            className="mt-2 text-xs text-gray-500 hover:text-black"
          >
            + Add tier
          </button>
        )}
        <p className="text-xs text-gray-400 mt-1">Tiers let you offer lower per-head prices for larger orders.</p>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="flex-1 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition"
        >
          {saving ? 'Saving...' : initial ? 'Update item' : 'Add item'}
        </button>
      </div>
    </div>
  )
}

export default function VendorMenuPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchMenu = async () => {
    if (!token) return
    const data = await api.get<MenuItem[]>('/vendor-portal/menu', token).catch(() => [])
    setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchMenu()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleAdd = async (data: MenuItemFormData) => {
    if (!token) return
    setSaving(true)
    setError('')
    try {
      await api.post('/vendor-portal/menu/items', data, token)
      setShowAddForm(false)
      await fetchMenu()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: string, data: MenuItemFormData) => {
    if (!token) return
    setSaving(true)
    setError('')
    try {
      await api.patch(`/vendor-portal/menu/items/${id}`, data, token)
      setEditingId(null)
      await fetchMenu()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!token) return
    setDeleting(id)
    try {
      await api.delete(`/vendor-portal/menu/items/${id}`, token)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item.')
    } finally {
      setDeleting(null)
    }
  }

  const grouped = CATEGORIES.reduce<Record<string, MenuItem[]>>((acc, cat) => {
    acc[cat] = items.filter((i) => i.category === cat)
    return acc
  }, {})

  const otherItems = items.filter((i) => !CATEGORIES.includes(i.category))
  if (otherItems.length > 0) grouped['Other'] = otherItems

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Menu</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage what you offer and your per-head pricing</p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition font-medium"
          >
            + Add item
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {showAddForm && (
        <div className="mb-6">
          <ItemForm
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
            saving={saving}
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : items.length === 0 && !showAddForm ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <p className="text-gray-500 text-sm mb-1">No menu items yet</p>
          <p className="text-gray-400 text-xs">Add your first dish to start receiving menu-based inquiries</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-4 text-sm bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition font-medium"
          >
            Add your first item
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, catItems]) => {
            if (catItems.length === 0) return null
            return (
              <div key={cat} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{cat}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {catItems.map((item) => (
                    <div key={item.id}>
                      {editingId === item.id ? (
                        <div className="p-4">
                          <ItemForm
                            initial={item}
                            onSave={(data) => handleUpdate(item.id, data)}
                            onCancel={() => setEditingId(null)}
                            saving={saving}
                          />
                        </div>
                      ) : (
                        <div className="px-4 py-3 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-gray-400 truncate">{item.description}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-0.5">
                              {tiersSummary(item.caterer_menu_pricing_tiers)}/head
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setEditingId(item.id)}
                              className="text-xs text-gray-500 hover:text-black px-2 py-1 rounded-lg border border-gray-200 hover:border-gray-400 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deleting === item.id}
                              className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg border border-gray-200 hover:border-red-200 transition disabled:opacity-50"
                            >
                              {deleting === item.id ? '...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
