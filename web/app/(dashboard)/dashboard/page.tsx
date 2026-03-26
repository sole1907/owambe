'use client'

import { useAuth } from '@/context/auth'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome, {user?.full_name?.split(' ')[0]}
      </h1>
      <p className="text-gray-500 text-sm">Ready to start planning your event?</p>
    </div>
  )
}
