'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { capture } from '@/lib/posthog'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type CheckInResult = {
  success: boolean
  reason?: string
  guestName: string
  allocation: number
  checkedInCount: number
  remaining: number
  event?: { title: string; date: string | null; city: string | null } | null
}

type SearchResult = {
  id: string
  full_name: string
  allocation: number
  checked_in_count: number
  token: string
}

async function postCheckIn(token: string): Promise<CheckInResult> {
  const res = await fetch(`${API_URL}/invites/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Check-in failed')
  }
  return res.json()
}

export default function CheckInPage() {
  return (
    <Suspense>
      <CheckInContent />
    </Suspense>
  )
}

function CheckInContent() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'scan' | 'manual'>('scan')
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [processing, setProcessing] = useState(false)

  // Manual search state
  const [eventId, setEventId] = useState(searchParams.get('eventId') ?? '')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null)
  const scannerContainerId = 'qr-reader'

  const handleResult = async (token: string) => {
    if (processing) return
    setProcessing(true)
    setError(null)
    setResult(null)
    try {
      const data = await postCheckIn(token)
      setResult(data)
      capture('checkin_scanned', {
        success: data.success,
        reason: data.reason,
        allocation: data.allocation,
        checked_in_count: data.checkedInCount,
      })
      // Stop scanner after successful scan
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => null)
        setScanning(false)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Check-in failed')
    } finally {
      setProcessing(false)
    }
  }

  const startScanner = async () => {
    const { Html5Qrcode } = await import('html5-qrcode')
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => null)
    }
    const scanner = new Html5Qrcode(scannerContainerId)
    scannerRef.current = scanner
    setScanning(true)
    setResult(null)
    setError(null)

    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText: string) => {
        // Extract token from invite URL or use raw value
        const match = decodedText.match(/\/invite\/([a-f0-9-]{36})/)
        const token = match ? match[1] : decodedText.trim()
        await handleResult(token)
      },
      () => null, // ignore per-frame errors
    )
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => null)
      setScanning(false)
    }
  }

  // Clean up scanner on unmount or tab change
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => null)
      }
    }
  }, [])

  useEffect(() => {
    if (tab !== 'scan' && scannerRef.current) {
      scannerRef.current.stop().catch(() => null)
      setScanning(false)
    }
  }, [tab])

  const handleSearch = async () => {
    if (!eventId.trim() || !query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(
        `${API_URL}/invites/events/${encodeURIComponent(eventId.trim())}/search-guests?q=${encodeURIComponent(query)}`,
      )
      if (!res.ok) throw new Error('Search failed')
      setSearchResults(await res.json())
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const resetResult = () => {
    setResult(null)
    setError(null)
    setSearchResults([])
    setQuery('')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 text-center">
        <h1 className="text-2xl font-bold">Check-in</h1>
        <p className="text-gray-400 text-sm mt-1">Scan QR code or search by name</p>
      </div>

      {/* Result overlay */}
      {result && (
        <div
          className={`mx-4 mb-6 rounded-2xl p-6 text-center ${
            result.success ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          <div className="text-4xl mb-3">{result.success ? '✓' : '✗'}</div>
          <p className="text-xl font-bold">{result.guestName}</p>
          {result.success ? (
            <>
              <p className="text-sm opacity-90 mt-1">Checked in successfully</p>
              <div className="mt-3 bg-white/20 rounded-xl p-3 text-sm">
                <p>
                  {result.checkedInCount} of {result.allocation} spot
                  {result.allocation !== 1 ? 's' : ''} used
                </p>
                {result.remaining > 0 && (
                  <p className="opacity-80">{result.remaining} remaining</p>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm opacity-90 mt-1">
                {result.reason === 'over_limit'
                  ? 'All spots already used'
                  : 'Invalid invite'}
              </p>
              <div className="mt-3 bg-white/20 rounded-xl p-3 text-sm">
                <p>
                  {result.checkedInCount} of {result.allocation} spot
                  {result.allocation !== 1 ? 's' : ''} already used
                </p>
              </div>
            </>
          )}
          <button
            onClick={resetResult}
            className="mt-4 px-6 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30"
          >
            Scan next guest
          </button>
        </div>
      )}

      {/* Error */}
      {error && !result && (
        <div className="mx-4 mb-4 p-4 bg-red-900/50 border border-red-700 rounded-xl text-sm text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      {!result && (
        <div className="flex mx-4 mb-4 bg-gray-900 rounded-xl p-1">
          {(['scan', 'manual'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
                tab === t ? 'bg-white text-gray-900' : 'text-gray-400'
              }`}
            >
              {t === 'scan' ? 'Camera scan' : 'Manual lookup'}
            </button>
          ))}
        </div>
      )}

      {/* Camera scan tab */}
      {!result && tab === 'scan' && (
        <div className="flex-1 flex flex-col items-center px-4">
          {/* Scanner container — always rendered so html5-qrcode can attach */}
          <div
            id={scannerContainerId}
            className={`w-full max-w-sm rounded-2xl overflow-hidden bg-gray-900 ${
              scanning ? 'min-h-64' : 'hidden'
            }`}
          />

          {!scanning && (
            <div className="w-full max-w-sm">
              <div className="aspect-square rounded-2xl bg-gray-900 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-gray-700">
                <div className="text-5xl">📷</div>
                <p className="text-gray-400 text-sm text-center px-8">
                  Tap the button below to start scanning guest QR codes
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 w-full max-w-sm">
            {scanning ? (
              <button
                onClick={stopScanner}
                className="w-full py-4 rounded-xl bg-gray-800 text-white text-base font-medium"
              >
                Stop scanning
              </button>
            ) : (
              <button
                onClick={startScanner}
                className="w-full py-4 rounded-xl bg-white text-gray-900 text-base font-bold"
              >
                Start camera
              </button>
            )}
          </div>

          {processing && (
            <p className="mt-4 text-sm text-gray-400 animate-pulse">Processing...</p>
          )}
        </div>
      )}

      {/* Manual lookup tab */}
      {!result && tab === 'manual' && (
        <div className="flex-1 px-4">
          <div className="max-w-sm mx-auto space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Event ID</label>
              <input
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="Paste event ID"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Guest name</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Start typing..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !eventId.trim() || !query.trim()}
              className="w-full py-3 bg-white text-gray-900 rounded-xl text-sm font-bold disabled:opacity-40"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>

            {searchResults.length > 0 && (
              <div className="space-y-2 mt-2">
                {searchResults.map((guest) => (
                  <button
                    key={guest.id}
                    onClick={() => handleResult(guest.token)}
                    disabled={processing}
                    className="w-full flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-800 hover:border-gray-600 transition disabled:opacity-50"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium">{guest.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {guest.checked_in_count}/{guest.allocation} checked in
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {guest.checked_in_count >= guest.allocation ? (
                        <span className="text-red-400">Full</span>
                      ) : (
                        <span className="text-green-400">Check in →</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {searchResults.length === 0 && query && !searching && (
              <p className="text-xs text-gray-500 text-center pt-2">No guests found</p>
            )}
          </div>
        </div>
      )}

      <div className="h-10" />
    </div>
  )
}
