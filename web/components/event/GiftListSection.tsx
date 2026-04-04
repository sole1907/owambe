'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type GiftItem = {
  id: string
  title: string
  description: string | null
  price_estimate: number | null
  store_url: string | null
  is_purchased: boolean
  purchased_by: string | null
  sort_order: number
}

type GiftListData = {
  items: GiftItem[]
  cashContributionEnabled: boolean
  cashContributionLink: string | null
}

type Props = { eventId: string }

export default function GiftListSection({ eventId }: Props) {
  const { token } = useAuth()
  const [data, setData] = useState<GiftListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', priceEstimate: '', storeUrl: '' })
  const [saving, setSaving] = useState(false)
  const [enablingCash, setEnablingCash] = useState(false)
  const [copied, setCopied] = useState(false)

  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/gifts/${eventId}` : `/gifts/${eventId}`

  const fetchData = async () => {
    if (!token) return
    const result = await api.get<GiftListData>(`/events/${eventId}/gift-list`, token)
    setData(result)
  }

  useEffect(() => {
    fetchData().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, token])

  const handleAddItem = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await api.post(
        `/events/${eventId}/gift-list/items`,
        {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          priceEstimate: form.priceEstimate ? parseInt(form.priceEstimate) : undefined,
          storeUrl: form.storeUrl.trim() || undefined,
        },
        token ?? undefined,
      )
      await fetchData()
      setForm({ title: '', description: '', priceEstimate: '', storeUrl: '' })
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePurchased = async (item: GiftItem) => {
    await api.patch(
      `/gift-list/items/${item.id}`,
      { isPurchased: !item.is_purchased },
      token ?? undefined,
    )
    await fetchData()
  }

  const handleDelete = async (itemId: string) => {
    await api.delete(`/gift-list/items/${itemId}`, token ?? undefined)
    await fetchData()
  }

  const handleEnableCash = async () => {
    setEnablingCash(true)
    try {
      await api.post(`/events/${eventId}/gift-list/cash-contribution`, {}, token ?? undefined)
      await fetchData()
    } finally {
      setEnablingCash(false)
    }
  }

  const handleDisableCash = async () => {
    await api.delete(`/events/${eventId}/gift-list/cash-contribution`, token ?? undefined)
    await fetchData()
  }

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading gift list...</p>

  const items = data?.items ?? []
  const cashEnabled = data?.cashContributionEnabled ?? false
  const cashLink = data?.cashContributionLink

  return (
    <div>
      {/* Share section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Shareable gift list</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Share this link with guests — no login required
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => copyLink(publicUrl)}
              className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <Link
              href={`/gifts/${eventId}`}
              target="_blank"
              className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
            >
              Preview →
            </Link>
          </div>
        </div>
      </div>

      {/* Cash contributions */}
      <div className="mb-6 p-4 border border-gray-200 rounded-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Cash contributions</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {cashEnabled && cashLink
                ? 'Guests can contribute cash via Paystack'
                : cashEnabled
                ? 'Enabled — Paystack link not configured'
                : 'Let guests send cash gifts via Paystack'}
            </p>
            {cashEnabled && cashLink && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => copyLink(cashLink)}
                  className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  {copied ? 'Copied!' : 'Copy payment link'}
                </button>
                <a
                  href={cashLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  Open →
                </a>
              </div>
            )}
          </div>
          {cashEnabled ? (
            <button
              onClick={handleDisableCash}
              className="text-xs px-3 py-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 flex-shrink-0"
            >
              Disable
            </button>
          ) : (
            <button
              onClick={handleEnableCash}
              disabled={enablingCash}
              className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex-shrink-0"
            >
              {enablingCash ? 'Setting up...' : 'Enable'}
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Gift items{' '}
          <span className="text-gray-400 font-normal text-sm">({items.length})</span>
        </h2>
        <button
          onClick={() => { setForm({ title: '', description: '', priceEstimate: '', storeUrl: '' }); setShowForm(true) }}
          className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
        >
          + Add item
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-5 p-4 border border-gray-200 rounded-xl bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Add a gift item</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Item name</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. KitchenAid mixer, Travel voucher..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Colour, size, link..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Price estimate (₦) <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="number"
                min={0}
                value={form.priceEstimate}
                onChange={(e) => setForm({ ...form, priceEstimate: e.target.value })}
                placeholder="e.g. 50000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Store link <span className="text-gray-400">(optional — Jumia, Konga, Amazon, etc.)</span>
              </label>
              <input
                type="url"
                value={form.storeUrl}
                onChange={(e) => setForm({ ...form, storeUrl: e.target.value })}
                placeholder="https://www.jumia.com.ng/..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddItem}
              disabled={saving || !form.title.trim()}
              className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add item'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Gift items list */}
      {items.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-gray-400 text-sm">No gift items yet</p>
          <p className="text-gray-300 text-xs mt-1">Add items guests can purchase as gifts</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-4 p-4 border rounded-xl group transition ${
                item.is_purchased
                  ? 'bg-gray-50 border-gray-100'
                  : 'bg-white border-gray-100 hover:border-gray-200'
              }`}
            >
              <button
                onClick={() => handleTogglePurchased(item)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                  item.is_purchased
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {item.is_purchased && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.is_purchased ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                )}
                {item.is_purchased && item.purchased_by && (
                  <p className="text-xs text-green-600 mt-0.5">Purchased by {item.purchased_by}</p>
                )}
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {item.price_estimate && (
                  <span className="text-xs text-gray-500">
                    ₦{item.price_estimate.toLocaleString()}
                  </span>
                )}
                {item.store_url && (
                  <a
                    href={item.store_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    View →
                  </a>
                )}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-xs text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
