import { QuestionnaireAnswers } from '@/lib/types'

type Props = {
  answers: QuestionnaireAnswers
  onChange: (updates: Partial<QuestionnaireAnswers>) => void
}

export default function StepEventDetails({ answers, onChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Tell us about your event</h2>
      <p className="text-gray-500 text-sm mb-6">Give your event a name and let us know when it is</p>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event name</label>
          <input
            type="text"
            placeholder="e.g. Tunde & Amaka's Wedding"
            value={answers.eventTitle}
            onChange={(e) => onChange({ eventTitle: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event date</label>
          <input
            type="date"
            value={answers.eventDate}
            onChange={(e) => onChange({ eventDate: e.target.value, eventDateApproximate: '' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Not sure of the exact date?{' '}
            <span className="text-gray-400 font-normal">Enter an approximate timeframe</span>
          </label>
          <input
            type="text"
            placeholder="e.g. December 2026, Q1 2027"
            value={answers.eventDateApproximate}
            onChange={(e) => onChange({ eventDateApproximate: e.target.value, eventDate: '' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
      </div>
    </div>
  )
}
