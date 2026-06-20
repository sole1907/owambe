'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'

type ReviewableInterest = {
  id: string
  vendor_id: string
  event_id: string
  vendors: { id: string; name: string; slug: string; vendor_categories: { name: string } }
  events: { id: string; title: string; event_date: string }
  vendor_reviews: { id: string }[]
}

const STAR_LABELS = ['', 'Poor', 'Below average', 'Average', 'Good', 'Excellent']

export default function ReviewPage() {
  const { interestId } = useParams<{ interestId: string }>()
  const { token, user, isLoading } = useAuth()
  const router = useRouter()

  const [interest, setInterest] = useState<ReviewableInterest | null>(null)
  const [loadError, setLoadError] = useState('')
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!user || !token) {
      router.replace(`/login?next=/review/${interestId}`)
      return
    }

    api
      .get<ReviewableInterest[]>('/reviews/reviewable', token)
      .then((items) => {
        const match = items.find((i) => i.id === interestId)
        if (!match) {
          setLoadError('This review link is not valid, has already been used, or your event has not passed yet.')
        } else {
          setInterest(match)
        }
      })
      .catch(() => setLoadError('Could not load review details.'))
  }, [interestId, token, user, isLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || rating === 0) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await api.post(`/vendor-interests/${interestId}/review`, { rating, comment: comment || undefined }, token)
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit review.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md">
        {loadError ? (
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-4">{loadError}</p>
            <Link href="/dashboard" className="text-black text-sm font-medium hover:underline">
              Back to dashboard
            </Link>
          </div>
        ) : submitted ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h1>
            <p className="text-gray-500 text-sm mb-6">
              Your {rating}-star review for{' '}
              <strong>{interest?.vendors?.name}</strong> has been submitted. It helps other
              organisers make better choices.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition"
            >
              Back to dashboard
            </Link>
          </div>
        ) : !interest ? (
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-xs text-gray-400 mb-1">
                {interest.events?.title} ·{' '}
                {interest.events?.event_date
                  ? new Date(interest.events.event_date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : ''}
              </p>
              <h1 className="text-xl font-bold text-gray-900">
                How was {interest.vendors?.name}?
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {interest.vendors?.vendor_categories?.name}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Star rating */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-3">Your rating</p>
                <div className="flex gap-2 justify-center mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                    >
                      <span
                        className={
                          star <= (hovered || rating) ? 'text-amber-400' : 'text-gray-200'
                        }
                      >
                        ★
                      </span>
                    </button>
                  ))}
                </div>
                {(hovered || rating) > 0 && (
                  <p className="text-center text-sm font-medium text-gray-700">
                    {STAR_LABELS[hovered || rating]}
                  </p>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tell us more <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="What did they do well? What could be improved?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {submitError && <p className="text-xs text-red-600">{submitError}</p>}

              <button
                type="submit"
                disabled={rating === 0 || submitting}
                className="w-full py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-40 transition"
              >
                {submitting ? 'Submitting...' : 'Submit review'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
