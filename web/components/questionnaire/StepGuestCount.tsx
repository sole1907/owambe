import { QuestionnaireAnswers } from '@/lib/types'

const RANGES = [
  { label: 'Under 50', value: 50 },
  { label: '50 – 100', value: 100 },
  { label: '100 – 200', value: 200 },
  { label: '200 – 500', value: 500 },
  { label: '500 – 1,000', value: 1000 },
  { label: 'Over 1,000', value: 1001 },
]

type Props = {
  answers: QuestionnaireAnswers
  onChange: (updates: Partial<QuestionnaireAnswers>) => void
}

export default function StepGuestCount({ answers, onChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">How many guests are you expecting?</h2>
      <p className="text-gray-500 text-sm mb-6">An estimate is fine — you can update this later</p>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {RANGES.map((range) => (
          <button
            key={range.value}
            type="button"
            onClick={() => onChange({ guestCount: range.value })}
            className={`p-4 rounded-xl border-2 text-sm font-medium transition ${
              answers.guestCount === range.value
                ? 'border-black bg-black text-white'
                : 'border-gray-200 hover:border-gray-400 text-gray-800'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Or enter an exact number
        </label>
        <input
          type="number"
          min={1}
          placeholder="e.g. 350"
          value={answers.guestCount && !RANGES.find((r) => r.value === answers.guestCount) ? answers.guestCount : ''}
          onChange={(e) => onChange({ guestCount: parseInt(e.target.value) || null })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
    </div>
  )
}
