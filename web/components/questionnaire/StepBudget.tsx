import { QuestionnaireAnswers } from '@/lib/types'

const BUDGET_RANGES = [
  { label: 'Under ₦500k', value: 500000 },
  { label: '₦500k – ₦1M', value: 1000000 },
  { label: '₦1M – ₦3M', value: 3000000 },
  { label: '₦3M – ₦5M', value: 5000000 },
  { label: '₦5M – ₦10M', value: 10000000 },
  { label: 'Over ₦10M', value: 10000001 },
]

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value)
}

type Props = {
  answers: QuestionnaireAnswers
  onChange: (updates: Partial<QuestionnaireAnswers>) => void
}

export default function StepBudget({ answers, onChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">What is your approximate budget?</h2>
      <p className="text-gray-500 text-sm mb-6">
        This helps us tailor vendor recommendations to your range
      </p>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {BUDGET_RANGES.map((range) => (
          <button
            key={range.value}
            type="button"
            onClick={() => onChange({ budgetEstimate: range.value })}
            className={`p-4 rounded-xl border-2 text-sm font-medium transition ${
              answers.budgetEstimate === range.value
                ? 'border-black bg-black text-white'
                : 'border-gray-200 hover:border-gray-400 text-gray-800'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Or enter an exact amount</label>
        <div className="relative">
          <span className="absolute left-3 top-2 text-sm text-gray-400">₦</span>
          <input
            type="number"
            min={0}
            placeholder="e.g. 2500000"
            value={
              answers.budgetEstimate && !BUDGET_RANGES.find((r) => r.value === answers.budgetEstimate)
                ? answers.budgetEstimate
                : ''
            }
            onChange={(e) => onChange({ budgetEstimate: parseInt(e.target.value) || null })}
            className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        {answers.budgetEstimate && (
          <p className="mt-1 text-xs text-gray-400">{formatNaira(answers.budgetEstimate)}</p>
        )}
      </div>
    </div>
  )
}
