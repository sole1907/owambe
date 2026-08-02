'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

// Contact Picker API types (not in standard TS lib yet)
declare global {
  interface Navigator {
    contacts?: {
      select: (
        properties: string[],
        options?: { multiple?: boolean },
      ) => Promise<{ name?: string[]; email?: string[]; tel?: string[] }[]>
    }
  }
}

type Guest = {
  id: string
  full_name: string
  email: string
  phone: string | null
  allocation: number
  rsvp_status: 'pending' | 'accepted' | 'declined'
  checked_in_count: number
  invite_sent_at: string | null
}

type PlusOneRequest = {
  id: string
  requested_count: number
  reason: string | null
  status: string
  created_at: string
  guest_invites: {
    id: string
    full_name: string
    email: string
    allocation: number
  }
}

type Stats = {
  totalGuests: number
  totalAllocation: number
  totalCheckedIn: number
  accepted: number
  declined: number
  pending: number
}

type Props = { eventId: string }

const RSVP_STYLES = {
  pending: 'bg-gray-100 text-gray-500',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
}

type ImportRow = { fullName: string; email: string; phone: string; allocation: number; error?: string }

function parseCSV(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  // Detect if first line is a header (contains non-email text like "name" or "email")
  const firstLower = lines[0].toLowerCase()
  const startIndex = firstLower.includes('name') || firstLower.includes('email') ? 1 : 0

  return lines.slice(startIndex).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const fullName = cols[0] ?? ''
    const email = cols[1] ?? ''
    const phone = cols[2] ?? ''
    const allocation = parseInt(cols[3] ?? '1') || 1
    const error = !fullName ? 'Missing name' : !email.includes('@') ? 'Invalid email' : undefined
    return { fullName, email, phone, allocation, error }
  }).filter((r) => r.fullName || r.email) // drop blank lines
}

export default function GuestListSection({ eventId }: Props) {
  const { token } = useAuth()
  const [guests, setGuests] = useState<Guest[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [plusOneRequests, setPlusOneRequests] = useState<PlusOneRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', allocation: 1 })
  const [saving, setSaving] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null)

  const fetchGuests = async () => {
    if (!token) return
    const [guestData, statsData, requestsData] = await Promise.all([
      api.get<Guest[]>(`/events/${eventId}/guests`, token),
      api.get<Stats>(`/events/${eventId}/guests/stats`, token),
      api.get<PlusOneRequest[]>(`/events/${eventId}/plus-one-requests`, token),
    ])
    setGuests(guestData)
    setStats(statsData)
    setPlusOneRequests(requestsData)
  }

  useEffect(() => {
    fetchGuests().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, token])

  const resetForm = () => {
    setForm({ fullName: '', email: '', phone: '', allocation: 1 })
    setShowForm(false)
    setEditingGuest(null)
  }

  const handleSubmit = async () => {
    if (!form.fullName || !form.email) return
    setSaving(true)
    const allocation = Number.isNaN(form.allocation) ? 1 : Math.min(20, Math.max(1, form.allocation))
    try {
      if (editingGuest) {
        await api.patch(`/guests/${editingGuest.id}`, {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || undefined,
          allocation,
        }, token ?? undefined)
      } else {
        await api.post(`/events/${eventId}/guests`, {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || undefined,
          allocation,
        }, token ?? undefined)
      }
      await fetchGuests()
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (guest: Guest) => {
    setEditingGuest(guest)
    setForm({
      fullName: guest.full_name,
      email: guest.email,
      phone: guest.phone ?? '',
      allocation: guest.allocation,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    await api.delete(`/guests/${id}`, token ?? undefined)
    await fetchGuests()
  }

  const handleReview = async (requestId: string, approved: boolean) => {
    setReviewing(requestId)
    try {
      await api.patch(`/plus-one-requests/${requestId}`, { approved }, token ?? undefined)
      await fetchGuests()
    } finally {
      setReviewing(null)
    }
  }

  const handleContactPicker = async () => {
    if (!navigator.contacts) return
    try {
      const selected = await navigator.contacts.select(['name', 'email', 'tel'], { multiple: true })
      const rows: ImportRow[] = selected.map((c) => {
        const fullName = c.name?.[0]?.trim() ?? ''
        const email = c.email?.[0]?.trim() ?? ''
        const phone = c.tel?.[0]?.trim() ?? ''
        const error = !fullName ? 'Missing name' : !email.includes('@') ? 'No email for this contact' : undefined
        return { fullName, email, phone, allocation: 1, error }
      }).filter((r) => r.fullName || r.email)
      if (rows.length) {
        setImportRows(rows)
        setImportResult(null)
      }
    } catch {
      // user cancelled — do nothing
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setImportRows(parseCSV(text))
      setImportResult(null)
    }
    reader.readAsText(file)
    e.target.value = '' // reset so same file can be re-selected
  }

  const handleImportConfirm = async () => {
    if (!importRows) return
    const valid = importRows.filter((r) => !r.error)
    if (!valid.length) return
    setImporting(true)
    try {
      const result = await api.post<{ imported: number }>(
        `/events/${eventId}/guests/import`,
        { guests: valid.map(({ fullName, email, phone, allocation }) => ({ fullName, email, phone: phone || undefined, allocation })) },
        token ?? undefined,
      )
      setImportResult(result)
      setImportRows(null)
      await fetchGuests()
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading guests...</p>

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total invites', value: stats.totalGuests },
            { label: 'Total spots', value: stats.totalAllocation },
            { label: 'Accepted', value: stats.accepted },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pending plus-one requests */}
      {plusOneRequests.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold text-gray-900">Plus-one requests</h2>
            <span className="bg-black text-white text-xs font-medium px-2 py-0.5 rounded-full">
              {plusOneRequests.length}
            </span>
          </div>
          <div className="space-y-2">
            {plusOneRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-100 rounded-xl"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {req.guest_invites.full_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Requesting {req.requested_count} extra spot{req.requested_count !== 1 ? 's' : ''}
                    {req.reason ? ` — "${req.reason}"` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Current allocation: {req.guest_invites.allocation} spot{req.guest_invites.allocation !== 1 ? 's' : ''}
                    {' '}→ would become {req.guest_invites.allocation + req.requested_count}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleReview(req.id, true)}
                    disabled={reviewing === req.id}
                    className="px-3 py-1.5 bg-black text-white text-xs rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {reviewing === req.id ? '...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReview(req.id, false)}
                    disabled={reviewing === req.id}
                    className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Guests <span className="text-gray-400 font-normal text-sm">({guests.length})</span>
        </h2>
        <div className="flex gap-2">
          {typeof navigator !== 'undefined' && navigator.contacts && (
            <button
              onClick={handleContactPicker}
              className="text-sm border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              From contacts
            </button>
          )}
          <label className="text-sm border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition cursor-pointer">
            Import CSV
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
          </label>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
          >
            + Add guest
          </button>
        </div>
      </div>

      {/* Import success banner */}
      {importResult && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Successfully imported {importResult.imported} guest{importResult.imported !== 1 ? 's' : ''}. Invites are being sent.
        </div>
      )}

      {/* CSV preview */}
      {importRows && (
        <div className="mb-5 border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Preview — {importRows.filter((r) => !r.error).length} valid
                {importRows.some((r) => r.error) && (
                  <span className="text-red-500 ml-1">· {importRows.filter((r) => r.error).length} invalid</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Expected columns: Name, Email, Phone (optional), Allocation (optional)</p>
            </div>
            <button onClick={() => setImportRows(null)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {importRows.map((row, i) => (
              <div key={i} className={`flex items-center gap-4 px-4 py-2.5 border-b border-gray-100 last:border-0 text-sm ${row.error ? 'bg-red-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900">{row.fullName || '—'}</span>
                  <span className="text-gray-400 ml-2">{row.email}</span>
                </div>
                {row.phone && <span className="text-xs text-gray-400">{row.phone}</span>}
                <span className="text-xs text-gray-500">×{row.allocation}</span>
                {row.error && <span className="text-xs text-red-500">{row.error}</span>}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
            <button
              onClick={handleImportConfirm}
              disabled={importing || !importRows.some((r) => !r.error)}
              className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${importRows.filter((r) => !r.error).length} guests`}
            </button>
            <button
              onClick={() => setImportRows(null)}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="mb-5 p-4 border border-gray-200 rounded-xl bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            {editingGuest ? 'Edit guest' : 'Add a guest'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Phone <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Plus-one allocation{' '}
                <span className="text-gray-400">(total spots incl. themselves)</span>
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={Number.isNaN(form.allocation) ? '' : form.allocation}
                onChange={(e) => {
                  const raw = e.target.value
                  setForm({ ...form, allocation: raw === '' ? NaN : parseInt(raw, 10) })
                }}
                onBlur={() =>
                  setForm((f) => ({
                    ...f,
                    allocation: Number.isNaN(f.allocation) ? 1 : Math.min(20, Math.max(1, f.allocation)),
                  }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingGuest ? 'Save changes' : 'Add guest'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Guest list */}
      {guests.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-gray-400 text-sm">No guests added yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {guests.map((guest) => (
            <div
              key={guest.id}
              className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 group"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-gray-500">
                  {guest.full_name.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{guest.full_name}</p>
                <p className="text-xs text-gray-400">{guest.email}</p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-500">
                  +{guest.allocation - 1} guest{guest.allocation - 1 !== 1 ? 's' : ''}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${RSVP_STYLES[guest.rsvp_status]}`}>
                  {guest.rsvp_status}
                </span>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleEdit(guest)}
                    className="text-xs text-gray-400 hover:text-black"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(guest.id)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
