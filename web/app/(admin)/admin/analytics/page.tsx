'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type Stats = {
  events: {
    total: number
    withPlan: number
    byType: Record<string, number>
  }
  guests: {
    total: number
    invitesSent: number
    totalCheckIns: number
  }
  plusOneRequests: {
    pending: number
    approved: number
    rejected: number
  }
  vendors: {
    active: number
    featured: number
    total: number
  }
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  naming_ceremony: 'Naming Ceremony',
  corporate: 'Corporate',
  burial: 'Burial',
  other: 'Other',
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const { token } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    api
      .get<Stats>('/admin/analytics', token)
      .then(setStats)
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <p className="text-gray-400 text-sm">Loading analytics...</p>
  if (!stats) return <p className="text-gray-500">Failed to load analytics.</p>

  const conversionRate =
    stats.events.total > 0
      ? Math.round((stats.events.withPlan / stats.events.total) * 100)
      : 0

  const inviteSendRate =
    stats.guests.total > 0
      ? Math.round((stats.guests.invitesSent / stats.guests.total) * 100)
      : 0

  const byType = Object.entries(stats.events.byType).sort((a, b) => b[1] - a[1])
  const totalPlusOnes =
    stats.plusOneRequests.pending +
    stats.plusOneRequests.approved +
    stats.plusOneRequests.rejected

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Live counts from the database</p>
      </div>

      {/* Events */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Events
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total events created" value={stats.events.total} />
          <StatCard
            label="Questionnaire completions"
            value={stats.events.withPlan}
            sub={`${conversionRate}% of events`}
          />
        </div>

        {byType.length > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Events by type</p>
            </div>
            <div className="divide-y divide-gray-50">
              {byType.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-700">
                    {EVENT_TYPE_LABELS[type] ?? type}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-gray-900 h-1.5 rounded-full"
                        style={{
                          width: `${Math.round((count / stats.events.total) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-6 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Guests & invites */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Guests & invites
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Guests added" value={stats.guests.total} />
          <StatCard
            label="Invites sent"
            value={stats.guests.invitesSent}
            sub={`${inviteSendRate}% send rate`}
          />
          <StatCard label="Total check-ins" value={stats.guests.totalCheckIns} />
        </div>
      </section>

      {/* Plus-one requests */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Plus-one requests
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total requests" value={totalPlusOnes} />
          <StatCard label="Approved" value={stats.plusOneRequests.approved} />
          <StatCard label="Pending" value={stats.plusOneRequests.pending} />
        </div>
      </section>

      {/* Vendors */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Vendors
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total vendors" value={stats.vendors.total} />
          <StatCard label="Active vendors" value={stats.vendors.active} />
          <StatCard label="Featured vendors" value={stats.vendors.featured} />
        </div>
      </section>
    </div>
  )
}
