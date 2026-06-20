'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type PaymentStructure = {
  id: string
  commitment_pct: number
  materials_pct: number
  balance_pct: number
  commitment_release_days: number
  materials_release_days: number
  balance_release_hours: number
  is_active: boolean
  terms_agreed_at: string | null
}

const EXAMPLE_CONTRACT = 500000

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function VendorPaymentsPage() {
  const { token } = useAuth()

  const [structure, setStructure] = useState<PaymentStructure | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [agreeing, setAgreeing] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [agreeError, setAgreeError] = useState<string | null>(null)
  const [termsChecked, setTermsChecked] = useState(false)
  const termsRef = useRef<HTMLDivElement>(null)

  // Form state
  const [commitmentPct, setCommitmentPct] = useState(30)
  const [materialsPct, setMaterialsPct] = useState(20)
  const [commitmentReleaseDays, setCommitmentReleaseDays] = useState(14)
  const [materialsReleaseDays, setMaterialsReleaseDays] = useState(14)
  const [balanceReleaseHours, setBalanceReleaseHours] = useState(48)

  const balancePct = 100 - commitmentPct - materialsPct

  // Validation
  const sumIs100 = commitmentPct + materialsPct + balancePct === 100
  const balanceOk = balancePct >= 20
  const commitmentOk = commitmentPct >= 10
  const formValid = sumIs100 && balanceOk && commitmentOk

  function validationMessage() {
    if (!commitmentOk) return 'Commitment fee must be at least 10%.'
    if (!balanceOk) return 'Balance (quality guarantee) must be at least 20%.'
    if (!sumIs100) return 'Percentages must sum to 100%.'
    return null
  }

  // Refund preview amounts
  const materialsAmt = Math.round((EXAMPLE_CONTRACT * materialsPct) / 100)
  const balanceAmt = Math.round((EXAMPLE_CONTRACT * balancePct) / 100)
  const materialsAndBalanceAmt = materialsAmt + balanceAmt

  useEffect(() => {
    if (!token) return
    api
      .get<PaymentStructure | null>('/vendor-portal/payment-structure', token)
      .then((data) => {
        setStructure(data)
        if (data) {
          setCommitmentPct(data.commitment_pct)
          setMaterialsPct(data.materials_pct)
          setCommitmentReleaseDays(data.commitment_release_days)
          setMaterialsReleaseDays(data.materials_release_days)
          setBalanceReleaseHours(data.balance_release_hours)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  async function handleSave() {
    if (!token || !formValid) return
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)
    try {
      const saved = await api.post<PaymentStructure>(
        '/vendor-portal/payment-structure',
        {
          commitmentPct,
          materialsPct,
          balancePct,
          commitmentReleaseDays,
          materialsReleaseDays,
          balanceReleaseHours,
        },
        token,
      )
      setStructure(saved)
      setSaveSuccess(true)
      if (!saved.is_active) {
        setTimeout(() => termsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      }
    } catch {
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAgreeTerms() {
    if (!token || !termsChecked) return
    setAgreeing(true)
    setAgreeError(null)
    try {
      const updated = await api.post<PaymentStructure>(
        '/vendor-portal/payment-structure/agree-terms',
        {},
        token,
      )
      setStructure(updated)
    } catch {
      setAgreeError('Failed to activate. Please try again.')
    } finally {
      setAgreeing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading payment structure…
      </div>
    )
  }

  const validationMsg = validationMessage()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment Structure</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure how client payments are split and released for your bookings.
        </p>
      </div>

      {/* Warning banner — no active structure */}
      {!structure?.is_active && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          <span className="font-semibold">You cannot accept new bookings</span> until you set up and
          activate a payment structure.
        </div>
      )}

      {/* Active status banner */}
      {structure?.is_active && structure.terms_agreed_at && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-sm text-green-800">
          <span className="font-semibold">Your payment structure is active.</span> Agreed on{' '}
          {formatDate(structure.terms_agreed_at)}.
        </div>
      )}

      {/* Section 1 — Bucket inputs */}
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {/* Commitment fee */}
        <div className="px-6 py-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Commitment fee</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Paid at booking. Shows intent. Released to you {commitmentReleaseDays} day
              {commitmentReleaseDays !== 1 ? 's' : ''} before your event.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Percentage (%)</label>
              <input
                type="number"
                min={10}
                max={60}
                step={1}
                value={commitmentPct}
                onChange={(e) => setCommitmentPct(Number(e.target.value))}
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Release days before event</label>
              <input
                type="number"
                min={7}
                max={90}
                step={1}
                value={commitmentReleaseDays}
                onChange={(e) => setCommitmentReleaseDays(Number(e.target.value))}
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        </div>

        {/* Materials fee */}
        <div className="px-6 py-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Materials fee</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Released to you {materialsReleaseDays} day{materialsReleaseDays !== 1 ? 's' : ''}{' '}
              before event so you can source materials. Set to 0 if you have no material costs.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Percentage (%)</label>
              <input
                type="number"
                min={0}
                max={60}
                step={1}
                value={materialsPct}
                onChange={(e) => setMaterialsPct(Number(e.target.value))}
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            {materialsPct > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Release days before event
                </label>
                <input
                  type="number"
                  min={7}
                  max={90}
                  step={1}
                  value={materialsReleaseDays}
                  onChange={(e) => setMaterialsReleaseDays(Number(e.target.value))}
                  className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            )}
          </div>
        </div>

        {/* Balance */}
        <div className="px-6 py-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Balance</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Quality guarantee. Held until your service is confirmed delivered.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Percentage (auto-calculated)</label>
              <input
                type="number"
                value={balancePct}
                readOnly
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Release hours after event</label>
              <input
                type="number"
                min={24}
                max={168}
                step={1}
                value={balanceReleaseHours}
                onChange={(e) => setBalanceReleaseHours(Number(e.target.value))}
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live validation */}
      {validationMsg && (
        <p className="text-sm text-red-600 font-medium">{validationMsg}</p>
      )}

      {/* Section 2 — Refund policy preview */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">What organisers see when booking you</p>
          <p className="text-xs text-gray-400 mt-0.5">Example based on {formatNaira(EXAMPLE_CONTRACT)} contract.</p>
        </div>
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex justify-between gap-4 py-2 border-b border-gray-100">
            <span className="text-gray-500">
              Cancel before {commitmentReleaseDays} days out
            </span>
            <span className="font-medium text-green-700">
              Full refund — {formatNaira(EXAMPLE_CONTRACT)}
            </span>
          </div>
          <div className="flex justify-between gap-4 py-2 border-b border-gray-100">
            <span className="text-gray-500">
              Cancel {materialsReleaseDays > 0 ? `${materialsReleaseDays}–` : ''}{commitmentReleaseDays} days out
            </span>
            <span className="font-medium text-amber-700">
              {formatNaira(materialsAndBalanceAmt)} refund
            </span>
          </div>
          <div className="flex justify-between gap-4 py-2 border-b border-gray-100">
            <span className="text-gray-500">
              Cancel within {materialsReleaseDays > 0 ? materialsReleaseDays : commitmentReleaseDays} days
            </span>
            <span className="font-medium text-orange-700">
              {formatNaira(balanceAmt)} refund (balance only)
            </span>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <span className="text-gray-500">After event</span>
            <span className="font-medium text-red-700">No refund</span>
          </div>
        </div>
      </div>

      {/* Section 3 — Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || !formValid}
          className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {saving ? 'Saving…' : 'Save payment structure'}
        </button>
        {saveSuccess && (
          <p className="text-sm text-green-700 font-medium">Payment structure saved.</p>
        )}
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      </div>

      {/* Section 4 — Terms agreement gate */}
      {structure && !structure.is_active && (
        <div ref={termsRef} className="bg-white border-2 border-gray-300 rounded-xl px-6 py-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Activate your payment structure</h2>
          <p className="text-sm text-gray-600">
            Before going live, you must agree to the following terms:
          </p>
          <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
            <li>
              Held funds are managed by Owambe on your behalf until the release conditions are met.
            </li>
            <li>
              If you cancel a confirmed booking, any held funds are returned to the organiser
              immediately and in full.
            </li>
            <li>
              Any amounts already released to you must be refunded to Owambe within 7 days of
              cancellation.
            </li>
            <li>
              Outstanding refunds may be deducted from future payouts across any of your other
              active bookings.
            </li>
          </ul>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={termsChecked}
              onChange={(e) => setTermsChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-black cursor-pointer"
            />
            <span className="text-sm text-gray-700 group-hover:text-gray-900 transition">
              I understand and agree to these terms
            </span>
          </label>
          <div className="space-y-2">
            <button
              onClick={handleAgreeTerms}
              disabled={agreeing || !termsChecked}
              className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {agreeing ? 'Activating…' : 'Activate payment structure'}
            </button>
            {agreeError && <p className="text-sm text-red-600">{agreeError}</p>}
            <p className="text-xs text-gray-400">
              Your payment structure will not be activated until you confirm. You cannot accept new
              bookings without an active payment structure.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
