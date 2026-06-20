import { useState } from 'react'
import { QuestionnaireAnswers } from '@/lib/types'

type Props = {
  answers: QuestionnaireAnswers
  onChange: (updates: Partial<QuestionnaireAnswers>) => void
}

export default function StepCoordinator({ answers, onChange }: Props) {
  const [showBenefits, setShowBenefits] = useState(false)

  const select = (value: boolean) => {
    setShowBenefits(false)
    onChange({ wantsCoordinator: value })
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">
        Would you like to hire an event coordinator?
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        Your answer will personalise your planning checklist.
      </p>

      <div className="flex flex-col gap-3 mb-4">
        <button
          type="button"
          onClick={() => select(true)}
          className={`w-full py-3 px-4 rounded-xl border-2 text-sm font-medium text-left transition ${
            answers.wantsCoordinator === true
              ? 'border-black bg-black text-white'
              : 'border-gray-200 hover:border-gray-400 text-gray-800'
          }`}
        >
          Yes — I want a professional to manage the day
        </button>
        <button
          type="button"
          onClick={() => select(false)}
          className={`w-full py-3 px-4 rounded-xl border-2 text-sm font-medium text-left transition ${
            answers.wantsCoordinator === false
              ? 'border-black bg-black text-white'
              : 'border-gray-200 hover:border-gray-400 text-gray-800'
          }`}
        >
          No — I&apos;ll manage it myself
        </button>
        <button
          type="button"
          onClick={() => { setShowBenefits(true); onChange({ wantsCoordinator: null }) }}
          className={`w-full py-3 px-4 rounded-xl border-2 text-sm font-medium text-left transition ${
            showBenefits && answers.wantsCoordinator === null
              ? 'border-gray-400 bg-gray-50 text-gray-800'
              : 'border-gray-200 hover:border-gray-400 text-gray-800'
          }`}
        >
          Not sure — show me the benefits
        </button>
      </div>

      {showBenefits && answers.wantsCoordinator === null && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2">
          <p className="text-sm font-semibold text-gray-900 mb-2">What does an event coordinator do?</p>
          <p className="text-sm text-gray-600 mb-3">
            A coordinator takes the operational weight off you on the day — they liaise with vendors,
            manage the timeline, handle last-minute issues, and make sure everything runs to plan
            so you can actually enjoy your event.
          </p>

          <ul className="text-sm text-gray-700 space-y-1.5 mb-3">
            <li className="flex gap-2"><span className="text-green-600">✓</span> You&apos;re not the one chasing the caterer at 2pm</li>
            <li className="flex gap-2"><span className="text-green-600">✓</span> Someone experienced handles problems you didn&apos;t see coming</li>
            <li className="flex gap-2"><span className="text-green-600">✓</span> Guests see a polished, well-run event</li>
          </ul>

          <p className="text-xs text-gray-500 mb-4">
            <span className="font-medium">Typical cost:</span> ₦150,000 – ₦500,000+ depending on event size and scope. The app helps you track and manage them once hired.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => select(true)}
              className="flex-1 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 transition"
            >
              Yes, I&apos;d like one
            </button>
            <button
              type="button"
              onClick={() => select(false)}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              No, I&apos;ll manage it myself
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
