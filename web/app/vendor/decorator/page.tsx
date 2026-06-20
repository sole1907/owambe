'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

const PREDEFINED_STYLES = [
  'Afro-Luxe',
  'Garden Floral',
  'Minimalist Modern',
  'Traditional Nigerian',
  'Fairy Light Canopy',
  'Grand Ballroom',
  'Rustic Chic',
  'Tropical Glam',
]

type Style = { id: string; style: string; sort_order: number }

type GuestTier = {
  id: string
  min_guests: number
  max_guests: number | null
  price: number
}

type DecoratorPackage = {
  id: string
  name: string
  description: string | null
  includes: string[]
  sort_order: number
  decorator_package_guest_tiers: GuestTier[]
}

type DecoratorProfile = {
  styles: Style[]
  packages: DecoratorPackage[]
}

type PackageFormData = {
  name: string
  description: string
  includes: string[]
  tiers: { minGuests: number; maxGuests: number | null; price: number }[]
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

function tiersSummary(tiers: GuestTier[]): string {
  if (!tiers || tiers.length === 0) return 'No pricing'
  const sorted = [...tiers].sort((a, b) => a.min_guests - b.min_guests)
  const prices = sorted.map((t) => t.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatNaira(min) : `${formatNaira(min)} – ${formatNaira(max)}`
}

type TierDraft = { min_guests: string; max_guests: string; price: string }

const emptyTier = (): TierDraft => ({ min_guests: '', max_guests: '', price: '' })

function PackageForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: DecoratorPackage
  onSave: (data: PackageFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [includesText, setIncludesText] = useState(initial?.includes?.join('\n') ?? '')
  const [tiers, setTiers] = useState<TierDraft[]>(
    initial?.decorator_package_guest_tiers?.length
      ? initial.decorator_package_guest_tiers
          .sort((a, b) => a.min_guests - b.min_guests)
          .map((t) => ({
            min_guests: String(t.min_guests),
            max_guests: t.max_guests !== null ? String(t.max_guests) : '',
            price: String(t.price),
          }))
      : [emptyTier()],
  )

  const handleTierChange = (idx: number, field: keyof TierDraft, value: string) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)))
  }

  const handleSubmit = () => {
    const parsedTiers = tiers
      .filter((t) => t.min_guests && t.price)
      .map((t) => ({
        minGuests: parseInt(t.min_guests, 10),
        maxGuests: t.max_guests ? parseInt(t.max_guests, 10) : null,
        price: parseInt(t.price, 10),
      }))
    const includes = includesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!name.trim() || parsedTiers.length === 0) return
    onSave({ name: name.trim(), description: description.trim(), includes, tiers: parsedTiers })
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Package name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Basic, Standard, Premium"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
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
        <label className="block text-xs font-medium text-gray-700 mb-1">What&apos;s included (one per line)</label>
        <textarea
          value={includesText}
          onChange={(e) => setIncludesText(e.target.value)}
          rows={4}
          placeholder={'Stage backdrop\nHead table styling\nGuest table centrepieces'}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Pricing tiers by guest count (up to 3)</label>
        <div className="space-y-2">
          {tiers.map((tier, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <div className="flex-1">
                <input
                  type="number"
                  min={0}
                  value={tier.min_guests}
                  onChange={(e) => handleTierChange(idx, 'min_guests', e.target.value)}
                  placeholder="Min guests"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  min={0}
                  value={tier.max_guests}
                  onChange={(e) => handleTierChange(idx, 'max_guests', e.target.value)}
                  placeholder="Max guests (blank = no limit)"
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  min={0}
                  value={tier.price}
                  onChange={(e) => handleTierChange(idx, 'price', e.target.value)}
                  placeholder="₦ price"
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
        <p className="text-xs text-gray-400 mt-1">Set a price for each guest count band (e.g. 1–150, 151–300, 301+).</p>
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
          {saving ? 'Saving...' : initial ? 'Update package' : 'Add package'}
        </button>
      </div>
    </div>
  )
}

export default function VendorDecoratorPage() {
  const { token } = useAuth()
  const [styles, setStyles] = useState<Style[]>([])
  const [packages, setPackages] = useState<DecoratorPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Styles
  const [styleToAdd, setStyleToAdd] = useState('')
  const [addingStyle, setAddingStyle] = useState(false)
  const [deletingStyle, setDeletingStyle] = useState<string | null>(null)

  // Packages
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingPkg, setDeletingPkg] = useState<string | null>(null)

  const fetchProfile = async () => {
    if (!token) return
    const data = await api
      .get<DecoratorProfile>('/vendor-portal/decorator', token)
      .catch(() => ({ styles: [], packages: [] }))
    setStyles(data.styles ?? [])
    setPackages(data.packages ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const availableStyles = PREDEFINED_STYLES.filter(
    (s) => !styles.some((existing) => existing.style === s),
  )

  const handleAddStyle = async () => {
    if (!token || !styleToAdd) return
    setAddingStyle(true)
    setError('')
    try {
      await api.post('/vendor-portal/decorator/styles', { style: styleToAdd }, token)
      setStyleToAdd('')
      await fetchProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add style.')
    } finally {
      setAddingStyle(false)
    }
  }

  const handleDeleteStyle = async (id: string) => {
    if (!token) return
    setDeletingStyle(id)
    try {
      await api.delete(`/vendor-portal/decorator/styles/${id}`, token)
      setStyles((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete style.')
    } finally {
      setDeletingStyle(null)
    }
  }

  const handleAddPackage = async (data: PackageFormData) => {
    if (!token) return
    setSaving(true)
    setError('')
    try {
      await api.post('/vendor-portal/decorator/packages', data, token)
      setShowAddForm(false)
      await fetchProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add package.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePackage = async (id: string, data: PackageFormData) => {
    if (!token) return
    setSaving(true)
    setError('')
    try {
      await api.patch(`/vendor-portal/decorator/packages/${id}`, data, token)
      setEditingId(null)
      await fetchProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update package.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePackage = async (id: string) => {
    if (!token) return
    setDeletingPkg(id)
    try {
      await api.delete(`/vendor-portal/decorator/packages/${id}`, token)
      setPackages((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete package.')
    } finally {
      setDeletingPkg(null)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Decorator setup</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage your style tags and packages. This section is for decorators — other vendors can leave it empty.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <div className="space-y-8">
          {/* ── Styles ───────────────────────────────────────────────── */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Style tags</h2>
            <p className="text-xs text-gray-400 mb-3">
              The aesthetics you offer. Couples filter decorators by these styles.
            </p>

            <div className="flex flex-wrap gap-2 mb-3">
              {styles.length === 0 ? (
                <p className="text-xs text-gray-400">No styles added yet.</p>
              ) : (
                styles.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 text-xs bg-black text-white rounded-full pl-3 pr-2 py-1.5"
                  >
                    {s.style}
                    <button
                      onClick={() => handleDeleteStyle(s.id)}
                      disabled={deletingStyle === s.id}
                      className="text-white/60 hover:text-white disabled:opacity-50"
                      title="Remove style"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>

            {availableStyles.length > 0 && (
              <div className="flex gap-2 items-center">
                <select
                  value={styleToAdd}
                  onChange={(e) => setStyleToAdd(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">Add a style…</option>
                  {availableStyles.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddStyle}
                  disabled={!styleToAdd || addingStyle}
                  className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40 transition font-medium"
                >
                  {addingStyle ? '...' : 'Add'}
                </button>
              </div>
            )}
          </section>

          {/* ── Packages ─────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-900">Packages</h2>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="text-sm bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition font-medium"
                >
                  + Add package
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Basic / Standard / Premium packages priced by guest count.
            </p>

            {showAddForm && (
              <div className="mb-4">
                <PackageForm
                  onSave={handleAddPackage}
                  onCancel={() => setShowAddForm(false)}
                  saving={saving}
                />
              </div>
            )}

            {packages.length === 0 && !showAddForm ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-gray-200">
                <p className="text-gray-500 text-sm mb-1">No packages yet</p>
                <p className="text-gray-400 text-xs">Add a package to start receiving package-based inquiries</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-4 text-sm bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition font-medium"
                >
                  Add your first package
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {editingId === pkg.id ? (
                      <div className="p-4">
                        <PackageForm
                          initial={pkg}
                          onSave={(data) => handleUpdatePackage(pkg.id, data)}
                          onCancel={() => setEditingId(null)}
                          saving={saving}
                        />
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{pkg.name}</p>
                            {pkg.description && (
                              <p className="text-xs text-gray-400 mt-0.5">{pkg.description}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {tiersSummary(pkg.decorator_package_guest_tiers)}
                            </p>
                            {pkg.includes.length > 0 && (
                              <ul className="text-xs text-gray-600 mt-2 space-y-0.5">
                                {pkg.includes.map((inc, i) => (
                                  <li key={i}>• {inc}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setEditingId(pkg.id)}
                              className="text-xs text-gray-500 hover:text-black px-2 py-1 rounded-lg border border-gray-200 hover:border-gray-400 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePackage(pkg.id)}
                              disabled={deletingPkg === pkg.id}
                              className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg border border-gray-200 hover:border-red-200 transition disabled:opacity-50"
                            >
                              {deletingPkg === pkg.id ? '...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
