import { QuestionnaireAnswers } from '@/lib/types'

const POPULAR_THEMES = [
  'Elegant & Formal',
  'Afrobeats & Owambe',
  'Garden / Outdoor',
  'Traditional Nigerian',
  'Black Tie',
  'Colourful & Vibrant',
  'Minimalist',
  'Beach / Tropical',
]

type Props = {
  answers: QuestionnaireAnswers
  onChange: (updates: Partial<QuestionnaireAnswers>) => void
}

export default function StepStyleTheme({ answers, onChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Do you have a preferred style or theme?</h2>
      <p className="text-gray-500 text-sm mb-6">
        Totally optional — skip if you haven&apos;t decided yet
      </p>

      <div className="flex flex-wrap gap-2 mb-5">
        {POPULAR_THEMES.map((theme) => (
          <button
            key={theme}
            type="button"
            onClick={() =>
              onChange({ styleTheme: answers.styleTheme === theme ? '' : theme })
            }
            className={`px-4 py-2 rounded-full text-sm border transition ${
              answers.styleTheme === theme
                ? 'bg-black text-white border-black'
                : 'border-gray-300 text-gray-700 hover:border-gray-500'
            }`}
          >
            {theme}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Or describe your own theme
        </label>
        <input
          type="text"
          placeholder="e.g. Gold and ivory, Yoruba traditional..."
          value={answers.styleTheme}
          onChange={(e) => onChange({ styleTheme: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
    </div>
  )
}
