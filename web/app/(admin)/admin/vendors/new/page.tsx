'use client'

import Link from 'next/link'
import VendorForm from '@/components/admin/VendorForm'

export default function NewVendorPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/vendors" className="text-sm text-gray-400 hover:text-black mb-3 inline-block">
          ← Vendors
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add vendor</h1>
      </div>
      <VendorForm />
    </div>
  )
}
