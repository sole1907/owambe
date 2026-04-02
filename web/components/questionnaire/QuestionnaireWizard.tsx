'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth'
import { api } from '@/lib/api'
import { INITIAL_ANSWERS, QuestionnaireAnswers } from '@/lib/types'
import StepEventType from './StepEventType'
import StepEventDetails from './StepEventDetails'
import StepLocation from './StepLocation'
import StepGuestCount from './StepGuestCount'
import StepBudget from './StepBudget'
import StepStyleTheme from './StepStyleTheme'
import StepExistingVendors from './StepExistingVendors'

const STEPS = [
  { id: 'event-type', label: 'Event Type' },
  { id: 'event-details', label: 'Details' },
  { id: 'location', label: 'Location' },
  { id: 'guest-count', label: 'Guests' },
  { id: 'budget', label: 'Budget' },
  { id: 'style', label: 'Style' },
  { id: 'vendors', label: 'Vendors' },
]

function canProceed(step: number, answers: QuestionnaireAnswers): boolean {
  switch (step) {
    case 0: return !!answers.eventType
    case 1: return !!answers.eventTitle && (!!answers.eventDate || !!answers.eventDateApproximate)
    case 2: return !!answers.city
    case 3: return answers.guestCount !== null
    case 4: return answers.budgetEstimate !== null
    case 5: return true // style is optional
    case 6: return answers.hasExistingVendors !== null
    default: return false
  }
}

export default function QuestionnaireWizard() {
  const { token } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(INITIAL_ANSWERS)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const onChange = (updates: Partial<QuestionnaireAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...updates }))
  }

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
  }

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const event = await api.post<{ id: string }>('/events/generate-plan', answers, token ?? undefined)
      router.push(`/events/${event.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span>{STEPS[step].label}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-black h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="min-h-72">
        {step === 0 && <StepEventType answers={answers} onChange={onChange} />}
        {step === 1 && <StepEventDetails answers={answers} onChange={onChange} />}
        {step === 2 && <StepLocation answers={answers} onChange={onChange} />}
        {step === 3 && <StepGuestCount answers={answers} onChange={onChange} />}
        {step === 4 && <StepBudget answers={answers} onChange={onChange} />}
        {step === 5 && <StepStyleTheme answers={answers} onChange={onChange} />}
        {step === 6 && <StepExistingVendors answers={answers} onChange={onChange} />}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Back
          </button>
        )}
        {isLast ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed(step, answers) || submitting}
            className="flex-1 py-3 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition"
          >
            {submitting ? 'Generating your plan...' : 'Generate my plan'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed(step, answers)}
            className="flex-1 py-3 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  )
}
