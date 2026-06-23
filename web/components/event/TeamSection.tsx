'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Collaborator = {
  id: string
  invited_email: string
  role: string
  status: 'pending' | 'active'
  accepted_at: string | null
  message: string | null
  created_at: string
  users: { full_name: string; email: string } | null
}

type Props = { eventId: string }

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export default function TeamSection({ eventId }: Props) {
  const { token } = useAuth()
  const [collabs, setCollabs] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invited, setInvited] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchCollabs = async () => {
    if (!token) return
    const res = await fetch(`${API_URL}/events/${eventId}/collaborators`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setCollabs(data)
    }
  }

  useEffect(() => {
    fetchCollabs().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, token])

  const sendInvite = async () => {
    if (!email.trim()) return
    setInviting(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim(), message: message.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to send invite')
      setInvited(email.trim())
      setEmail('')
      setMessage('')
      setShowForm(false)
      await fetchCollabs()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  const revoke = async (id: string) => {
    await fetch(`${API_URL}/events/${eventId}/collaborators/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    await fetchCollabs()
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading team…</p>

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Event coordinators</h2>
        <p className="text-xs text-gray-400">
          Coordinators can view vendor bookings, manage the guest list and checklist, and access
          event logistics. Payments stay with you.
        </p>
      </div>

      {/* Invited confirmation */}
      {invited && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          Invitation sent to <strong>{invited}</strong>. They&apos;ll receive an email with a link to accept.
        </div>
      )}

      {/* Collaborator list */}
      {collabs.length > 0 && (
        <div className="space-y-2">
          {collabs.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-4 p-4 bg-white border border-gray-100 rounded-xl group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {c.users?.full_name ?? c.invited_email}
                </p>
                {c.users?.full_name && (
                  <p className="text-xs text-gray-400">{c.invited_email}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'active'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {c.status === 'active' ? 'Active' : 'Invite pending'}
                  </span>
                  <span className="text-xs text-gray-400">
                    Invited {relativeDate(c.created_at)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => revoke(c.id)}
                className="text-xs text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      {showForm ? (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">Invite a coordinator</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
            placeholder="coordinator@email.com"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a personal note (optional)"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={sendInvite}
              disabled={inviting || !email.trim()}
              className="flex-1 py-2.5 bg-black text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-gray-800"
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null) }}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowForm(true); setInvited(null) }}
          className="w-full py-2.5 border border-dashed border-gray-300 text-gray-600 rounded-xl text-sm hover:border-gray-400 hover:text-gray-900 transition"
        >
          + Invite a coordinator
        </button>
      )}
    </div>
  )
}
