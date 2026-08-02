'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type DateStatus = 'blocked' | 'booked'
type AvailabilityMap = Record<string, DateStatus>

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Local calendar date, not UTC — toISOString() shifts to UTC and can land on
// the wrong day near midnight for timezones ahead of UTC (e.g. Lagos, UTC+1).
function localDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function VendorAvailabilityPage() {
  const { token } = useAuth()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-indexed
  const [availability, setAvailability] = useState<AvailabilityMap>({})
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchMonth = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const data = await api.get<{ date: string; status: DateStatus }[]>(
        `/vendor-portal/availability?year=${year}&month=${month}`,
        token
      )
      const map: AvailabilityMap = {}
      for (const d of data) map[d.date] = d.status
      setAvailability(map)
    } catch {
      setError('Could not load availability.')
    } finally {
      setLoading(false)
    }
  }, [token, year, month])

  useEffect(() => {
    fetchMonth()
  }, [fetchMonth])

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const handleDayClick = async (dateStr: string) => {
    if (!token) return
    const status = availability[dateStr]
    if (status === 'booked') return // can't change booked dates

    const isPast = dateStr < localDateStr(today)
    if (isPast) return

    setToggling(dateStr)
    setError('')
    try {
      if (status === 'blocked') {
        await api.delete(`/vendor-portal/availability/${dateStr}`, token)
        setAvailability(prev => {
          const next = { ...prev }
          delete next[dateStr]
          return next
        })
      } else {
        await api.post('/vendor-portal/availability/block', { date: dateStr }, token)
        setAvailability(prev => ({ ...prev, [dateStr]: 'blocked' }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update availability.')
    } finally {
      setToggling(null)
    }
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const todayStr = localDateStr(today)

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Availability</h1>
      <p className="text-gray-500 text-sm mb-6">Block dates you are unavailable. Booked dates are set automatically.</p>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

      {/* Legend */}
      <div className="flex gap-4 mb-6 text-xs text-gray-600">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-white border border-gray-300 inline-block" />Available</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Blocked by you</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />Booked</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />Past</div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
          ‹
        </button>
        <h2 className="text-base font-semibold text-gray-900">
          {MONTHS[month - 1]} {year}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
          ›
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading...</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} className="aspect-square" />

              const dateStr = `${year}-${pad(month)}-${pad(day)}`
              const status = availability[dateStr]
              const isPast = dateStr < todayStr
              const isToday = dateStr === todayStr
              const isToggling = toggling === dateStr

              let bg = 'hover:bg-gray-50 cursor-pointer'
              let textColor = 'text-gray-800'

              if (isPast) {
                bg = 'cursor-default'
                textColor = 'text-gray-300'
              } else if (status === 'booked') {
                bg = 'bg-blue-600 cursor-not-allowed'
                textColor = 'text-white'
              } else if (status === 'blocked') {
                bg = 'bg-red-500 hover:bg-red-600 cursor-pointer'
                textColor = 'text-white'
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isPast || status === 'booked' || isToggling}
                  onClick={() => handleDayClick(dateStr)}
                  className={`aspect-square flex items-center justify-center text-sm font-medium border-b border-r border-gray-50 transition ${bg} ${textColor} ${isToday ? 'ring-2 ring-inset ring-black' : ''}`}
                >
                  {isToggling ? (
                    <span className="opacity-50">{day}</span>
                  ) : (
                    day
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Click an available date to block it. Click a blocked date to unblock it. Booked dates cannot be changed.
      </p>
    </div>
  )
}
