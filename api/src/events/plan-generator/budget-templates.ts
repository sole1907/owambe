export type BudgetAllocation = {
  category: string
  percentage: number
}

const WEDDING: BudgetAllocation[] = [
  { category: 'Venue', percentage: 25 },
  { category: 'Catering', percentage: 33 },
  { category: 'Decoration', percentage: 10 },
  { category: 'Photography', percentage: 8 },
  { category: 'Videography', percentage: 5 },
  { category: 'DJ / Live Band', percentage: 5 },
  { category: 'MC', percentage: 2 },
  { category: 'Makeup Artist', percentage: 3 },
  { category: 'Miscellaneous', percentage: 9 },
]

const BIRTHDAY: BudgetAllocation[] = [
  { category: 'Venue', percentage: 20 },
  { category: 'Catering', percentage: 38 },
  { category: 'Decoration', percentage: 12 },
  { category: 'Photography', percentage: 8 },
  { category: 'DJ / Entertainment', percentage: 12 },
  { category: 'Miscellaneous', percentage: 10 },
]

const NAMING_CEREMONY: BudgetAllocation[] = [
  { category: 'Venue', percentage: 18 },
  { category: 'Catering', percentage: 45 },
  { category: 'Decoration', percentage: 12 },
  { category: 'Photography', percentage: 8 },
  { category: 'MC', percentage: 3 },
  { category: 'Miscellaneous', percentage: 14 },
]

const CORPORATE: BudgetAllocation[] = [
  { category: 'Venue', percentage: 35 },
  { category: 'Catering', percentage: 28 },
  { category: 'AV / Technical Equipment', percentage: 15 },
  { category: 'Photography / Videography', percentage: 8 },
  { category: 'Branding & Materials', percentage: 7 },
  { category: 'Miscellaneous', percentage: 7 },
]

const BURIAL: BudgetAllocation[] = [
  { category: 'Venue', percentage: 18 },
  { category: 'Catering', percentage: 45 },
  { category: 'Decoration', percentage: 10 },
  { category: 'Photography / Videography', percentage: 8 },
  { category: 'MC', percentage: 3 },
  { category: 'Miscellaneous', percentage: 16 },
]

const OTHER: BudgetAllocation[] = [
  { category: 'Venue', percentage: 25 },
  { category: 'Catering', percentage: 35 },
  { category: 'Entertainment', percentage: 15 },
  { category: 'Decoration', percentage: 10 },
  { category: 'Photography', percentage: 8 },
  { category: 'Miscellaneous', percentage: 7 },
]

export const BUDGET_TEMPLATES: Record<string, BudgetAllocation[]> = {
  wedding: WEDDING,
  birthday: BIRTHDAY,
  naming_ceremony: NAMING_CEREMONY,
  corporate: CORPORATE,
  burial: BURIAL,
  other: OTHER,
}
