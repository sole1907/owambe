'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

const PAYMENT_METHODS = [
  { value: 'platform', label: 'Platform (full escrow)' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash on the day' },
  { value: 'combination', label: 'Combination' },
]

type Profile = {
  phone: string | null
  whatsapp: string | null
  email: string | null
  instagram: string | null
  website: string | null
  description: string | null
  service_fee: number | null
  per_unit_cost: number | null
  per_unit_label: string | null
  has_material_costs: boolean
  price_min: number | null
  price_max: number | null
  commitment_fee_percentage: number
  balance_payment_methods: string[]
  cancellation_policy: {
    full_refund_days: number
    partial_refund_days: number
    partial_refund_percentage: number
  }
}

export default function VendorProfilePage() {
  const { token } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<Partial<Profile>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    api.get<Profile>('/vendor-portal/profile', token).then((p) => {
      setProfile(p)
      setForm({
        phone: p.phone ?? '',
        whatsapp: p.whatsapp ?? '',
        email: p.email ?? '',
        instagram: p.instagram ?? '',
        website: p.website ?? '',
        description: p.description ?? '',
        service_fee: p.service_fee,
        per_unit_cost: p.per_unit_cost,
        per_unit_label: p.per_unit_label ?? '',
        has_material_costs: p.has_material_costs,
        price_min: p.price_min,
        price_max: p.price_max,
        commitment_fee_percentage: p.commitment_fee_percentage,
        balance_payment_methods: p.balance_payment_methods ?? ['bank_transfer'],
        cancellation_policy: p.cancellation_policy ?? { full_refund_days: 14, partial_refund_days: 7, partial_refund_percentage: 50 },
      })
    })
  }, [token])

  const togglePaymentMethod = (method: string) => {
    const current = form.balance_payment_methods ?? []
    setForm({
      ...form,
      balance_payment_methods: current.includes(method)
        ? current.filter((m) => m !== method)
        : [...current, method],
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    try {
      await api.patch('/vendor-portal/profile', {
        phone: form.phone,
        whatsapp: form.whatsapp,
        email: form.email,
        instagram: form.instagram,
        website: form.website,
        description: form.description,
        servicefee: form.service_fee,
        perUnitCost: form.per_unit_cost,
        perUnitLabel: form.per_unit_label,
        hasMaterialCosts: form.has_material_costs,
        priceMin: form.price_min,
        priceMax: form.price_max,
        commitmentFeePercentage: form.commitment_fee_percentage,
        balancePaymentMethods: form.balance_payment_methods,
        cancellationPolicy: form.cancellation_policy,
      }, token)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return <p className="text-gray-400 text-sm">Loading...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Profile</h1>
      <p className="text-gray-500 text-sm mb-8">Keep your rates and details up to date so clients see accurate information.</p>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}
      {saved && <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg">Changes saved.</div>}

      <form onSubmit={handleSave} className="space-y-8">

        {/* Contact */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">Contact details</h2>
          <div className="grid grid-cols-2 gap-4">
            {([['phone', 'Phone'], ['whatsapp', 'WhatsApp'], ['email', 'Email'], ['instagram', 'Instagram'], ['website', 'Website']] as const).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input
                  type="text"
                  value={(form[field] as string) ?? ''}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">About / Bio</label>
            <textarea
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </section>

        {/* Pricing */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">Pricing</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Service fee (₦)</label>
              <input
                type="number"
                min={0}
                value={form.service_fee ?? ''}
                onChange={(e) => setForm({ ...form, service_fee: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Display price range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min={0}
                  value={form.price_min ?? ''}
                  onChange={(e) => setForm({ ...form, price_min: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  value={form.price_max ?? ''}
                  onChange={(e) => setForm({ ...form, price_max: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="hasMaterial"
              checked={form.has_material_costs ?? false}
              onChange={(e) => setForm({ ...form, has_material_costs: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="hasMaterial" className="text-sm text-gray-700">I charge for materials (e.g. food, décor items)</label>
          </div>

          {form.has_material_costs && (
            <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Per-unit cost (₦)</label>
                <input
                  type="number"
                  min={0}
                  value={form.per_unit_cost ?? ''}
                  onChange={(e) => setForm({ ...form, per_unit_cost: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Unit label</label>
                <input
                  type="text"
                  placeholder="e.g. per guest, per table"
                  value={form.per_unit_label ?? ''}
                  onChange={(e) => setForm({ ...form, per_unit_label: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          )}
        </section>

        {/* Booking settings */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">Booking settings</h2>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Commitment fee: <span className="text-gray-900 font-semibold">{form.commitment_fee_percentage}%</span>
              <span className="text-gray-400 font-normal ml-2">(10–50%)</span>
            </label>
            <input
              type="range"
              min={10}
              max={50}
              step={5}
              value={form.commitment_fee_percentage ?? 20}
              onChange={(e) => setForm({ ...form, commitment_fee_percentage: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>10%</span><span>50%</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Balance payment methods accepted</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => togglePaymentMethod(m.value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    form.balance_payment_methods?.includes(m.value)
                      ? 'bg-black text-white border-black'
                      : 'border-gray-300 text-gray-600 hover:border-gray-500'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Cancellation policy */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-1 pb-2 border-b border-gray-100">Cancellation policy</h2>
          <p className="text-xs text-gray-500 mb-4">This is shown to clients before they pay the commitment fee.</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full refund if cancelled ≥ N days before</label>
              <input
                type="number"
                min={1}
                value={form.cancellation_policy?.full_refund_days ?? 14}
                onChange={(e) => setForm({ ...form, cancellation_policy: { ...form.cancellation_policy!, full_refund_days: parseInt(e.target.value) } })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Partial refund if cancelled ≥ N days before</label>
              <input
                type="number"
                min={0}
                value={form.cancellation_policy?.partial_refund_days ?? 7}
                onChange={(e) => setForm({ ...form, cancellation_policy: { ...form.cancellation_policy!, partial_refund_days: parseInt(e.target.value) } })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Partial refund %</label>
              <input
                type="number"
                min={0}
                max={99}
                value={form.cancellation_policy?.partial_refund_percentage ?? 50}
                onChange={(e) => setForm({ ...form, cancellation_policy: { ...form.cancellation_policy!, partial_refund_percentage: parseInt(e.target.value) } })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
          {form.cancellation_policy && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
              Cancelled ≥ {form.cancellation_policy.full_refund_days} days before event → full refund ·
              Cancelled ≥ {form.cancellation_policy.partial_refund_days} days → {form.cancellation_policy.partial_refund_percentage}% refund ·
              Cancelled within {form.cancellation_policy.partial_refund_days} days → no refund
            </div>
          )}
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
