import { QuestionnaireAnswers } from '@/lib/types'

const POPULAR_CITIES = [
  'Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano',
  'Enugu', 'Benin City', 'Warri', 'Calabar', 'Owerri',
]

type Props = {
  answers: QuestionnaireAnswers
  onChange: (updates: Partial<QuestionnaireAnswers>) => void
}

export default function StepLocation({ answers, onChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Where will the event be held?</h2>
      <p className="text-gray-500 text-sm mb-6">This helps us recommend vendors in the right area</p>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input
            type="text"
            placeholder="e.g. Lagos"
            value={answers.city}
            onChange={(e) => onChange({ city: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {POPULAR_CITIES.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => onChange({ city })}
                className={`px-3 py-1 rounded-full text-xs border transition ${
                  answers.city === city
                    ? 'bg-black text-white border-black'
                    : 'border-gray-300 text-gray-600 hover:border-gray-500'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Specific area or venue in mind{' '}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Victoria Island, Landmark Event Centre"
            value={answers.location}
            onChange={(e) => onChange({ location: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
      </div>
    </div>
  )
}
