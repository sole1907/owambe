import QuestionnaireWizard from '@/components/questionnaire/QuestionnaireWizard'

export default function NewEventPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Plan a new event</h1>
        <p className="text-gray-500 text-sm">
          Answer a few questions and we&apos;ll build your personalised event plan
        </p>
      </div>
      <QuestionnaireWizard />
    </div>
  )
}
