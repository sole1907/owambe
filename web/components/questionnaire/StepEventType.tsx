import { EventType, QuestionnaireAnswers } from '@/lib/types'

const EVENT_TYPES: { value: EventType; label: string; emoji: string }[] = [
  { value: 'wedding', label: 'Wedding', emoji: '💍' },
  { value: 'birthday', label: 'Birthday', emoji: '🎂' },
  { value: 'naming_ceremony', label: 'Naming Ceremony', emoji: '👶' },
  { value: 'corporate', label: 'Corporate', emoji: '🏢' },
  { value: 'burial', label: 'Burial / Funeral', emoji: '🕊️' },
  { value: 'other', label: 'Other', emoji: '🎉' },
]

type Props = {
  answers: QuestionnaireAnswers
  onChange: (updates: Partial<QuestionnaireAnswers>) => void
}

export default function StepEventType({ answers, onChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">What type of event are you planning?</h2>
      <p className="text-gray-500 text-sm mb-6">Select the one that best fits your occasion</p>
      <div className="grid grid-cols-2 gap-3">
        {EVENT_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange({ eventType: type.value })}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition ${
              answers.eventType === type.value
                ? 'border-black bg-black text-white'
                : 'border-gray-200 hover:border-gray-400 text-gray-800'
            }`}
          >
            <span className="text-2xl">{type.emoji}</span>
            <span className="font-medium text-sm">{type.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
