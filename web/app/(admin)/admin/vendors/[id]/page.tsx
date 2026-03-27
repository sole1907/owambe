'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'
import VendorForm from '@/components/admin/VendorForm'

type Vendor = {
  id: string
  name: string
  category_id: string
  description: string | null
  location: string
  city: string
  price_min: number | null
  price_max: number | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  instagram: string | null
  website: string | null
  photos: string[]
  is_featured: boolean
  is_active: boolean
}

export default function EditVendorPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    api
      .get<Vendor>(`/admin/vendors/${id}`, token)
      .then(setVendor)
      .finally(() => setLoading(false))
  }, [id, token])

  if (loading) return <p className="text-gray-400 text-sm">Loading...</p>
  if (!vendor) return <p className="text-gray-500">Vendor not found.</p>

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/vendors" className="text-sm text-gray-400 hover:text-black mb-3 inline-block">
          ← Vendors
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
          <a
            href={`/vendors/${vendor.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-black"
          >
            View public profile →
          </a>
        </div>
      </div>
      <VendorForm
        vendorId={vendor.id}
        initialData={{
          name: vendor.name,
          categoryId: vendor.category_id,
          description: vendor.description ?? '',
          location: vendor.location,
          city: vendor.city,
          priceMin: vendor.price_min?.toString() ?? '',
          priceMax: vendor.price_max?.toString() ?? '',
          phone: vendor.phone ?? '',
          whatsapp: vendor.whatsapp ?? '',
          email: vendor.email ?? '',
          instagram: vendor.instagram ?? '',
          website: vendor.website ?? '',
          photos: vendor.photos.join('\n'),
          isFeatured: vendor.is_featured,
          isActive: vendor.is_active,
        }}
      />
    </div>
  )
}
