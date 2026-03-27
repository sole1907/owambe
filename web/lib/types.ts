export type EventType =
  | 'wedding'
  | 'birthday'
  | 'naming_ceremony'
  | 'corporate'
  | 'burial'
  | 'other'

export type QuestionnaireAnswers = {
  eventType: EventType | ''
  eventTitle: string
  eventDate: string         // ISO date string, or empty if approximate
  eventDateApproximate: string // e.g. "Q3 2026", if no exact date
  location: string
  city: string
  guestCount: number | null
  budgetEstimate: number | null
  styleTheme: string
  hasExistingVendors: boolean | null
  existingVendorCategories: string[]
}

export const INITIAL_ANSWERS: QuestionnaireAnswers = {
  eventType: '',
  eventTitle: '',
  eventDate: '',
  eventDateApproximate: '',
  location: '',
  city: '',
  guestCount: null,
  budgetEstimate: null,
  styleTheme: '',
  hasExistingVendors: null,
  existingVendorCategories: [],
}
