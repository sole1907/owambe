'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type GiftItem = {
  id: string
  title: string
  description: string | null
  price_estimate: number | null
  store_url: string | null
  status: 'available' | 'claimed'
  claimed_by_name: string | null
}

type BankAccount = {
  accountName: string | null
  accountNumber: string
  bankName: string | null
}

type GiftListData = {
  event: {
    id: string
    title: string
    event_date: string | null
    event_date_approximate: string | null
    city: string | null
  }
  items: GiftItem[]
  cashContributionEnabled: boolean
  bankAccount: BankAccount | null
}

function storeName(url: string): string {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    if (host.includes('jumia')) return 'Jumia'
    if (host.includes('konga')) return 'Konga'
    if (host.includes('amazon')) return 'Amazon'
    if (host.includes('slot')) return 'Slot'
    if (host.includes('jiji')) return 'Jiji'
    return host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1)
  } catch {
    return 'Store'
  }
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

// ── Claim modal ───────────────────────────────────────────────────────────────

function ClaimModal({
  item,
  onClose,
  onDone,
}: {
  item: GiftItem
  onClose: () => void
  onDone: (updatedItem: GiftItem) => void
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/gift-list/items/${item.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimerName: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to claim item')
      onDone({ ...item, status: 'claimed', claimed_by_name: name.trim() })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Reserve this item</h3>
        <p className="text-sm text-gray-500 mb-4">
          Enter your name so the host knows you&apos;re getting <strong>{item.title}</strong>.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Your name"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black mb-3"
        />
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || loading}
            className="flex-1 py-2.5 bg-black text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Reserving…' : 'Reserve it'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Direct transfer section ───────────────────────────────────────────────────

function DirectTransferSection({
  bankAccount,
  eventId,
}: {
  bankAccount: BankAccount
  eventId: string
}) {
  const [step, setStep] = useState<'details' | 'form' | 'done'>('details')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const copyAcct = async () => {
    await navigator.clipboard.writeText(bankAccount.accountNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const submit = async () => {
    const amtNum = parseInt(amount, 10)
    if (!name.trim() || !amtNum || amtNum < 1) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/gift-list/direct-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gifterName: name.trim(), amountNaira: amtNum, message: message.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to report transfer')
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
        <p className="text-2xl mb-2">🎉</p>
        <p className="text-sm font-semibold text-green-800">Thanks for your gift!</p>
        <p className="text-xs text-green-700 mt-1">The host will confirm once they see it in their account.</p>
      </div>
    )
  }

  if (step === 'form') {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-900">Tell the host you&apos;ve sent</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount sent"
            className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message (optional)"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setStep('details')}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || !amount || loading}
            className="flex-1 py-2.5 bg-black text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Submit'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <p className="text-sm font-semibold text-gray-900 mb-3">Send a bank transfer</p>
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-4">
        {bankAccount.bankName && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Bank</span>
            <span className="font-medium text-gray-900">{bankAccount.bankName}</span>
          </div>
        )}
        {bankAccount.accountName && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Account name</span>
            <span className="font-medium text-gray-900">{bankAccount.accountName}</span>
          </div>
        )}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Account number</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-gray-900">{bankAccount.accountNumber}</span>
            <button
              onClick={copyAcct}
              className="text-xs text-gray-500 hover:text-black border border-gray-200 rounded-lg px-2 py-1"
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">Transfer any amount from your bank app, then tap the button below to let the host know.</p>
      <button
        onClick={() => setStep('form')}
        className="w-full py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800"
      >
        I&apos;ve sent the money →
      </button>
    </div>
  )
}

// ── Paystack payment section ──────────────────────────────────────────────────

function PayOnlineSection({ eventId }: { eventId: string }) {
  const [giftAmount, setGiftAmount] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<{ chargeNaira: number; feeNaira: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scriptLoaded = useRef(false)

  useEffect(() => {
    if (scriptLoaded.current) return
    const s = document.createElement('script')
    s.src = 'https://js.paystack.co/v1/inline.js'
    s.async = true
    document.head.appendChild(s)
    scriptLoaded.current = true
  }, [])

  useEffect(() => {
    const n = parseInt(giftAmount, 10)
    if (!n || n < 100) { setPreview(null); return }
    const chargeNaira = Math.ceil((n + 200) / 0.985)
    setPreview({ chargeNaira, feeNaira: chargeNaira - n })
  }, [giftAmount])

  const pay = async () => {
    const amtNum = parseInt(giftAmount, 10)
    if (!amtNum || amtNum < 100 || !name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/gift-list/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          giftAmountNaira: amtNum,
          gifterName: name.trim(),
          gifterEmail: email.trim() || undefined,
          message: message.trim() || undefined,
        }),
      })
      const init = await res.json()
      if (!res.ok) throw new Error(init.message || 'Failed to initialize payment')

      if (!window.PaystackPop) throw new Error('Paystack not loaded, please refresh')

      window.PaystackPop.setup({
        key: init.publicKey,
        email: init.email,
        amount: init.amountKobo,
        reference: init.reference,
        metadata: init.metadata,
        currency: 'NGN',
        callback: async (response: { reference: string }) => {
          await fetch(`${API_URL}/gift-list/verify/${response.reference}`)
          setDone(true)
        },
        onClose: () => setLoading(false),
      }).openIframe()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
        <p className="text-2xl mb-2">🎉</p>
        <p className="text-sm font-semibold text-green-800">Gift sent successfully!</p>
        <p className="text-xs text-green-700 mt-1">The host will receive the funds shortly.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <p className="text-sm font-semibold text-gray-900">Pay online with card</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email for receipt (optional)"
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
        <input
          type="number"
          value={giftAmount}
          onChange={(e) => setGiftAmount(e.target.value)}
          placeholder="Gift amount (min ₦100)"
          className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message (optional)"
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      {preview && (
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>Gift amount</span>
            <span className="font-medium text-gray-800">{formatNaira(parseInt(giftAmount, 10))}</span>
          </div>
          <div className="flex justify-between">
            <span>Processing fee</span>
            <span className="font-medium text-gray-800">{formatNaira(preview.feeNaira)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
            <span className="font-semibold text-gray-700">You pay</span>
            <span className="font-semibold text-gray-900">{formatNaira(preview.chargeNaira)}</span>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={pay}
        disabled={!name.trim() || !giftAmount || parseInt(giftAmount, 10) < 100 || loading}
        className="w-full py-2.5 bg-black text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-gray-800"
      >
        {loading ? 'Opening payment…' : `Pay ${preview ? formatNaira(preview.chargeNaira) : ''}`.trim()}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PublicGiftListPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [data, setData] = useState<GiftListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [claimingItem, setClaimingItem] = useState<GiftItem | null>(null)
  const [items, setItems] = useState<GiftItem[]>([])
  const [cashTab, setCashTab] = useState<'transfer' | 'online'>('transfer')

  useEffect(() => {
    fetch(`${API_URL}/events/${eventId}/gift-list`)
      .then((r) => r.json())
      .then((d: GiftListData) => {
        setData(d)
        setItems(d.items)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [eventId])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading gift list…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Gift list not found.</p>
      </div>
    )
  }

  const { event, cashContributionEnabled, bankAccount } = data
  const showCashSection = cashContributionEnabled && bankAccount
  const claimedCount = items.filter((i) => i.status === 'claimed').length

  const eventDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : event.event_date_approximate || null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-8">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Gift list</p>
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          <div className="flex flex-wrap gap-3 mt-2">
            {eventDate && <span className="text-sm text-gray-500">{eventDate}</span>}
            {event.city && <span className="text-sm text-gray-500">· {event.city}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Cash gift section */}
        {showCashSection && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Send a cash gift</p>

            {/* Tab switcher */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
              <button
                onClick={() => setCashTab('transfer')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  cashTab === 'transfer' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                Bank transfer
              </button>
              <button
                onClick={() => setCashTab('online')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  cashTab === 'online' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                Pay online
              </button>
            </div>

            {cashTab === 'transfer' ? (
              <DirectTransferSection bankAccount={bankAccount} eventId={eventId} />
            ) : (
              <PayOnlineSection eventId={eventId} />
            )}
          </div>
        )}

        {/* Wishlist */}
        {items.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Wishlist</p>
              {claimedCount > 0 && (
                <p className="text-xs text-gray-400">{claimedCount} of {items.length} reserved</p>
              )}
            </div>

            <div className="space-y-2">
              {items.map((item) => {
                const isClaimed = item.status === 'claimed'
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border ${
                      isClaimed ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isClaimed ? 'bg-green-500 border-green-500' : 'border-gray-300'
                      }`}
                    >
                      {isClaimed && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isClaimed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                      )}
                      {isClaimed && (
                        <p className="text-xs text-green-600 mt-0.5">
                          {item.claimed_by_name ? `Reserved by ${item.claimed_by_name}` : 'Already reserved'}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {item.price_estimate && (
                        <span className="text-sm font-medium text-gray-700">
                          {formatNaira(item.price_estimate)}
                        </span>
                      )}
                      {!isClaimed && item.store_url && (
                        <a
                          href={item.store_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 bg-black text-white rounded-lg hover:bg-gray-800 whitespace-nowrap"
                        >
                          Buy on {storeName(item.store_url)} →
                        </a>
                      )}
                      {!isClaimed && !item.store_url && (
                        <button
                          onClick={() => setClaimingItem(item)}
                          className="text-xs px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                        >
                          Reserve it
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!showCashSection && items.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">No gift list yet</p>
          </div>
        )}
      </div>

      {claimingItem && (
        <ClaimModal
          item={claimingItem}
          onClose={() => setClaimingItem(null)}
          onDone={(updated) => {
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
            setClaimingItem(null)
          }}
        />
      )}
    </div>
  )
}
