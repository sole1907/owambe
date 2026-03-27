'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type Category = { id: string; name: string; slug: string }

type VendorFormData = {
  name: string
  categoryId: string
  description: string
  location: string
  city: string
  priceMin: string
  priceMax: string
  phone: string
  whatsapp: string
  email: string
  instagram: string
  website: string
  photos: string
  isFeatured: boolean
  isActive: boolean
}

const EMPTY: VendorFormData = {
  name: '',
  categoryId: '',
  description: '',
  location: '',
  city: '',
  priceMin: '',
  priceMax: '',
  phone: '',
  whatsapp: '',
  email: '',
  instagram: '',
  website: '',
  photos: '',
  isFeatured: false,
  isActive: true,
}

type Props = {
  vendorId?: string
  initialData?: Partial<VendorFormData>
}

export default function VendorForm({ vendorId, initialData }: Props) {
  const { token } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState<VendorFormData>({ ...EMPTY, ...initialData })
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    api.get<Category[]>('/vendors/categories', token).then(setCategories)
  }, [token])

  const set = (field: keyof VendorFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.categoryId || !form.location || !form.city) {
      setError('Name, category, location and city are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        categoryId: form.categoryId,
        description: form.description || undefined,
        location: form.location,
        city: form.city,
        priceMin: form.priceMin ? parseInt(form.priceMin) : undefined,
        priceMax: form.priceMax ? parseInt(form.priceMax) : undefined,
        phone: form.phone || undefined,
        whatsapp: form.whatsapp || undefined,
        email: form.email || undefined,
        instagram: form.instagram || undefined,
        website: form.website || undefined,
        photos: form.photos ? form.photos.split('\n').map((s) => s.trim()).filter(Boolean) : [],
        isFeatured: form.isFeatured,
        isActive: form.isActive,
      }

      if (vendorId) {
        await api.patch(`/admin/vendors/${vendorId}`, payload, token ?? undefined)
      } else {
        await api.post('/admin/vendors', payload, token ?? undefined)
      }
      router.push('/admin/vendors')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Basic info */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Basic info</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Vendor name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
            <select
              required
              value={form.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
            <input
              type="text"
              required
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="e.g. Lagos"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Location / area *</label>
            <input
              type="text"
              required
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. Victoria Island, Lagos"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Pricing (₦)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Min price</label>
            <input
              type="number"
              min={0}
              value={form.priceMin}
              onChange={(e) => set('priceMin', e.target.value)}
              placeholder="e.g. 50000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Max price</label>
            <input
              type="number"
              min={0}
              value={form.priceMax}
              onChange={(e) => set('priceMax', e.target.value)}
              placeholder="e.g. 200000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            { field: 'phone', label: 'Phone', placeholder: '+234...' },
            { field: 'whatsapp', label: 'WhatsApp number', placeholder: '+234...' },
            { field: 'email', label: 'Email', placeholder: 'vendor@example.com' },
            { field: 'instagram', label: 'Instagram handle', placeholder: '@handle' },
            { field: 'website', label: 'Website', placeholder: 'https://...' },
          ] as const).map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type="text"
                value={form[field]}
                onChange={(e) => set(field, e.target.value)}
                placeholder={placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Photos */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Photos</h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Photo URLs — one per line
          </label>
          <textarea
            value={form.photos}
            onChange={(e) => set('photos', e.target.value)}
            rows={4}
            placeholder={'https://...\nhttps://...'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black resize-none"
          />
        </div>
      </section>

      {/* Settings */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Settings</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(e) => set('isFeatured', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-black"
          />
          <span className="text-sm text-gray-700">Featured vendor</span>
        </label>
        {vendorId && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-black"
            />
            <span className="text-sm text-gray-700">Active (visible to users)</span>
          </label>
        )}
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : vendorId ? 'Save changes' : 'Create vendor'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/vendors')}
          className="px-6 py-2.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
