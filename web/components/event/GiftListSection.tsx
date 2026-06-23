'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'
import ThankYouSection from './ThankYouSection'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type GiftItem = {
  id: string
  title: string
  description: string | null
  price_estimate: number | null
  store_url: string | null
  status: 'available' | 'claimed'
  claimed_by_name: string | null
  sort_order: number
}

type GiftPayment = {
  id: string
  gifter_name: string
  gifter_email: string | null
  message: string | null
  gift_amount_kobo: number
  charge_kobo: number
  status: string
  created_at: string
}

type DirectTransfer = {
  id: string
  gifter_name: string
  amount_naira: number
  message: string | null
  status: 'pending' | 'confirmed'
  confirmed_at: string | null
  created_at: string
}

type GiftSettings = {
  cashContributionEnabled: boolean
  bankAccountName: string | null
  bankAccountNumber: string | null
  bankName: string | null
  bankCode: string | null
}

type Dashboard = {
  settings: GiftSettings
  payments: GiftPayment[]
  directTransfers: DirectTransfer[]
  wishlistItems: GiftItem[]
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

function relativeDate(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Bank account settings form ────────────────────────────────────────────────

function BankSettingsForm({
  settings,
  eventId,
  token,
  onSaved,
}: {
  settings: GiftSettings
  eventId: string
  token: string | null
  onSaved: (s: GiftSettings) => void
}) {
  const [form, setForm] = useState({
    bankAccountName: settings.bankAccountName ?? '',
    bankAccountNumber: settings.bankAccountNumber ?? '',
    bankName: settings.bankName ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    if (!form.bankAccountNumber.trim() || !form.bankAccountName.trim() || !form.bankName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/gift-list/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bankAccountName: form.bankAccountName.trim(),
          bankAccountNumber: form.bankAccountNumber.trim(),
          bankName: form.bankName.trim(),
          cashContributionEnabled: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to save')
      onSaved({
        cashContributionEnabled: true,
        bankAccountName: data.bank_account_name,
        bankAccountNumber: data.bank_account_number,
        bankName: data.bank_name,
        bankCode: data.bank_code,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const disable = async () => {
    await fetch(`${API_URL}/events/${eventId}/gift-list/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ cashContributionEnabled: false }),
    })
    onSaved({ ...settings, cashContributionEnabled: false })
  }

  return (
    <div className="p-4 border border-gray-200 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-900">Bank account for gifts</p>
        {settings.cashContributionEnabled && (
          <button onClick={disable} className="text-xs text-gray-400 hover:text-red-500">
            Disable
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400">Guests who send bank transfers will use these details. Paystack online payments also transfer to this account.</p>
      <input
        value={form.bankAccountName}
        onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
        placeholder="Account name"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      <input
        value={form.bankAccountNumber}
        onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
        placeholder="Account number"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      <input
        value={form.bankName}
        onChange={(e) => setForm({ ...form, bankName: e.target.value })}
        placeholder="Bank name (e.g. GTBank, Opay)"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={save}
        disabled={saving || !form.bankAccountNumber.trim() || !form.bankAccountName.trim() || !form.bankName.trim()}
        className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save & enable'}
      </button>
    </div>
  )
}

// ── Gift payments list ────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-500',
    paid: 'bg-blue-50 text-blue-700',
    transfer_initiated: 'bg-amber-50 text-amber-700',
    transfer_complete: 'bg-green-50 text-green-700',
    failed: 'bg-red-50 text-red-700',
    pending_transfer: 'bg-amber-50 text-amber-700',
  }
  const labels: Record<string, string> = {
    pending: 'Pending',
    paid: 'Paid',
    transfer_initiated: 'Transferring',
    transfer_complete: 'Transferred',
    failed: 'Failed',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {labels[status] ?? status}
    </span>
  )
}

// ── Main section ─────────────────────────────────────────────────────────────

type Props = { eventId: string }

export default function GiftListSection({ eventId }: Props) {
  const { token } = useAuth()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBankForm, setShowBankForm] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [itemForm, setItemForm] = useState({ title: '', description: '', priceEstimate: '', storeUrl: '' })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeView, setActiveView] = useState<'gifts' | 'wishlist' | 'thankyou'>('gifts')

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/gifts/${eventId}` : `/gifts/${eventId}`

  const fetchDashboard = async () => {
    if (!token) return
    const result = await api.get<Dashboard>(`/events/${eventId}/gift-list/dashboard`, token)
    setDashboard(result)
  }

  useEffect(() => {
    fetchDashboard().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, token])

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const confirmTransfer = async (transferId: string) => {
    await fetch(`${API_URL}/gift-list/direct-transfers/${transferId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    await fetchDashboard()
  }

  const handleAddItem = async () => {
    if (!itemForm.title.trim()) return
    setSaving(true)
    try {
      await api.post(
        `/events/${eventId}/gift-list/items`,
        {
          title: itemForm.title.trim(),
          description: itemForm.description.trim() || undefined,
          priceEstimate: itemForm.priceEstimate ? parseInt(itemForm.priceEstimate) : undefined,
          storeUrl: itemForm.storeUrl.trim() || undefined,
        },
        token ?? undefined,
      )
      await fetchDashboard()
      setItemForm({ title: '', description: '', priceEstimate: '', storeUrl: '' })
      setShowAddItem(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    await api.delete(`/gift-list/items/${itemId}`, token ?? undefined)
    await fetchDashboard()
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading gifts…</p>

  const settings = dashboard?.settings
  const payments = dashboard?.payments ?? []
  const transfers = dashboard?.directTransfers ?? []
  const wishlist = dashboard?.wishlistItems ?? []

  const pendingTransfers = transfers.filter((t) => t.status === 'pending')
  const confirmedTransfers = transfers.filter((t) => t.status === 'confirmed')
  const paidPayments = payments.filter((p) => p.status !== 'pending' && p.status !== 'failed')
  const hasActivity = paidPayments.length > 0 || transfers.length > 0

  return (
    <div>
      {/* Share row */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Shareable gift page</p>
            <p className="text-xs text-gray-400 mt-0.5">Share this with guests — no login required</p>
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

      {/* Pending direct transfers — prominent alert */}
      {pendingTransfers.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-semibold text-amber-800 mb-3">
            {pendingTransfers.length} transfer{pendingTransfers.length !== 1 ? 's' : ''} awaiting confirmation
          </p>
          <div className="space-y-3">
            {pendingTransfers.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.gifter_name}</p>
                  <p className="text-sm text-amber-700 font-semibold">{formatNaira(t.amount_naira)}</p>
                  {t.message && <p className="text-xs text-gray-500 italic mt-0.5">&ldquo;{t.message}&rdquo;</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{relativeDate(t.created_at)}</p>
                </div>
                <button
                  onClick={() => confirmTransfer(t.id)}
                  className="flex-shrink-0 px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg hover:bg-gray-800"
                >
                  Confirm received
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setActiveView('gifts')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeView === 'gifts' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
          }`}
        >
          Cash gifts {hasActivity ? `(${paidPayments.length + confirmedTransfers.length})` : ''}
        </button>
        <button
          onClick={() => setActiveView('wishlist')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeView === 'wishlist' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
          }`}
        >
          Wishlist {wishlist.length > 0 ? `(${wishlist.length})` : ''}
        </button>
        <button
          onClick={() => setActiveView('thankyou')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeView === 'thankyou' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
          }`}
        >
          Thank you
        </button>
      </div>

      {/* ── Cash gifts view ── */}
      {activeView === 'gifts' && (
        <div className="space-y-6">
          {/* Bank account settings */}
          {settings && !settings.cashContributionEnabled && !showBankForm && (
            <div className="p-4 border border-dashed border-gray-300 rounded-xl text-center">
              <p className="text-sm text-gray-500 mb-2">Enable cash gifts to let guests send you money</p>
              <button
                onClick={() => setShowBankForm(true)}
                className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800"
              >
                Set up bank account
              </button>
            </div>
          )}

          {settings && settings.cashContributionEnabled && !showBankForm && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Cash gifts enabled</p>
                <p className="text-xs text-green-700">
                  {settings.bankName} · {settings.bankAccountNumber}
                </p>
              </div>
              <button
                onClick={() => setShowBankForm(true)}
                className="text-xs text-gray-500 hover:text-black border border-gray-200 bg-white rounded-lg px-2 py-1"
              >
                Edit
              </button>
            </div>
          )}

          {(showBankForm || !settings?.cashContributionEnabled) && settings && (
            <BankSettingsForm
              settings={settings}
              eventId={eventId}
              token={token}
              onSaved={(s) => {
                setDashboard((prev) => prev ? { ...prev, settings: s } : prev)
                setShowBankForm(false)
              }}
            />
          )}

          {/* Platform payments */}
          {paidPayments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Online payments</p>
              <div className="space-y-2">
                {paidPayments.map((p) => (
                  <div key={p.id} className="flex items-start justify-between p-3 bg-white border border-gray-100 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.gifter_name}</p>
                      {p.gifter_email && <p className="text-xs text-gray-400">{p.gifter_email}</p>}
                      {p.message && <p className="text-xs text-gray-500 italic mt-0.5">&ldquo;{p.message}&rdquo;</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{relativeDate(p.created_at)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-green-700">{formatNaira(p.gift_amount_kobo / 100)}</p>
                      <div className="mt-1">{statusBadge(p.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirmed direct transfers */}
          {confirmedTransfers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Confirmed transfers</p>
              <div className="space-y-2">
                {confirmedTransfers.map((t) => (
                  <div key={t.id} className="flex items-start justify-between p-3 bg-white border border-gray-100 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.gifter_name}</p>
                      {t.message && <p className="text-xs text-gray-500 italic mt-0.5">&ldquo;{t.message}&rdquo;</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{relativeDate(t.created_at)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-green-700">{formatNaira(t.amount_naira)}</p>
                      <span className="text-xs text-green-600">Confirmed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasActivity && settings?.cashContributionEnabled && (
            <p className="text-center text-sm text-gray-400 py-8">No gifts received yet</p>
          )}
        </div>
      )}

      {/* ── Wishlist view ── */}
      {activeView === 'wishlist' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-900">
              Wishlist items <span className="text-gray-400 font-normal">({wishlist.length})</span>
            </p>
            <button
              onClick={() => { setItemForm({ title: '', description: '', priceEstimate: '', storeUrl: '' }); setShowAddItem(true) }}
              className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
            >
              + Add item
            </button>
          </div>

          {showAddItem && (
            <div className="mb-5 p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-3">
              <p className="text-sm font-semibold text-gray-800">Add a wishlist item</p>
              <input
                value={itemForm.title}
                onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                placeholder="Item name *"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
              <input
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                placeholder="Description (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
              <input
                type="number"
                value={itemForm.priceEstimate}
                onChange={(e) => setItemForm({ ...itemForm, priceEstimate: e.target.value })}
                placeholder="Price estimate ₦ (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
              <input
                type="url"
                value={itemForm.storeUrl}
                onChange={(e) => setItemForm({ ...itemForm, storeUrl: e.target.value })}
                placeholder="Store link (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddItem}
                  disabled={saving || !itemForm.title.trim()}
                  className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving ? 'Adding…' : 'Add item'}
                </button>
                <button
                  onClick={() => setShowAddItem(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {wishlist.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
              <p className="text-gray-400 text-sm">No wishlist items yet</p>
              <p className="text-gray-300 text-xs mt-1">Add items guests can pick from</p>
            </div>
          ) : (
            <div className="space-y-2">
              {wishlist.map((item) => {
                const claimed = item.status === 'claimed'
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 p-4 border rounded-xl group transition ${
                      claimed ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        claimed ? 'bg-green-500 border-green-500' : 'border-gray-300'
                      }`}
                    >
                      {claimed && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${claimed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {item.title}
                      </p>
                      {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                      {claimed && (
                        <p className="text-xs text-green-600 mt-0.5">
                          {item.claimed_by_name ? `Reserved by ${item.claimed_by_name}` : 'Reserved'}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {item.price_estimate && (
                        <span className="text-xs text-gray-500">{formatNaira(item.price_estimate)}</span>
                      )}
                      {item.store_url && (
                        <a href={item.store_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                          View →
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-xs text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Thank you view ── */}
      {activeView === 'thankyou' && (
        <ThankYouSection eventId={eventId} />
      )}
    </div>
  )
}
