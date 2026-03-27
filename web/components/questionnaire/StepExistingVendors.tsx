import { QuestionnaireAnswers } from '@/lib/types'

const VENDOR_CATEGORIES = [
  'Venue', 'Caterer', 'Photographer', 'Videographer', 'DJ',
  'Live Band', 'MC', 'Decorator', 'Makeup Artist', 'Event Coordinator',
]

type Props = {
  answers: QuestionnaireAnswers
  onChange: (updates: Partial<QuestionnaireAnswers>) => void
}

export default function StepExistingVendors({ answers, onChange }: Props) {
  const toggleCategory = (category: string) => {
    const current = answers.existingVendorCategories
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category]
    onChange({ existingVendorCategories: updated })
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">
        Do you already have any vendors booked?
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        We&apos;ll focus recommendations on what you still need
      </p>

      <div className="flex gap-3 mb-6">
        <button
          type="button"
          onClick={() => onChange({ hasExistingVendors: false, existingVendorCategories: [] })}
          className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition ${
            answers.hasExistingVendors === false
              ? 'border-black bg-black text-white'
              : 'border-gray-200 hover:border-gray-400 text-gray-800'
          }`}
        >
          Starting from scratch
        </button>
        <button
          type="button"
          onClick={() => onChange({ hasExistingVendors: true })}
          className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition ${
            answers.hasExistingVendors === true
              ? 'border-black bg-black text-white'
              : 'border-gray-200 hover:border-gray-400 text-gray-800'
          }`}
        >
          I have some already
        </button>
      </div>

      {answers.hasExistingVendors === true && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Which ones do you already have?</p>
          <div className="flex flex-wrap gap-2">
            {VENDOR_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  answers.existingVendorCategories.includes(category)
                    ? 'bg-black text-white border-black'
                    : 'border-gray-300 text-gray-600 hover:border-gray-500'
                }`}
              >
                {answers.existingVendorCategories.includes(category) ? '✓ ' : ''}
                {category}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
