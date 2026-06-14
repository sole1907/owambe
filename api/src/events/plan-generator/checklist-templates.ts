export type ChecklistTemplate = {
  title: string
  weeksBeforeEvent: number // how many weeks before event this should be done
}

const WEDDING: ChecklistTemplate[] = [
  { title: 'Set your event date and confirm availability', weeksBeforeEvent: 20 },
  { title: 'Book venue', weeksBeforeEvent: 16 },
  { title: 'Book caterer', weeksBeforeEvent: 14 },
  { title: 'Book photographer', weeksBeforeEvent: 14 },
  { title: 'Book videographer', weeksBeforeEvent: 14 },
  { title: 'Book DJ or live band', weeksBeforeEvent: 12 },
  { title: 'Book MC', weeksBeforeEvent: 12 },
  { title: 'Book decorator', weeksBeforeEvent: 12 },
  { title: 'Book makeup artist', weeksBeforeEvent: 10 },
  { title: 'Send out invitations', weeksBeforeEvent: 8 },
  { title: 'Finalise aso-ebi and colour scheme', weeksBeforeEvent: 8 },
  { title: 'Confirm guest count with caterer', weeksBeforeEvent: 4 },
  { title: 'Confirm all vendor bookings', weeksBeforeEvent: 3 },
  { title: 'Prepare day-of timeline and run sheet', weeksBeforeEvent: 2 },
  { title: 'Make final payments to vendors', weeksBeforeEvent: 1 },
  { title: 'Confirm logistics — parking, transport, accommodation', weeksBeforeEvent: 1 },
]

const BIRTHDAY: ChecklistTemplate[] = [
  { title: 'Set your event date and choose a venue', weeksBeforeEvent: 12 },
  { title: 'Book caterer', weeksBeforeEvent: 10 },
  { title: 'Book DJ or entertainment', weeksBeforeEvent: 10 },
  { title: 'Book decorator', weeksBeforeEvent: 8 },
  { title: 'Book photographer', weeksBeforeEvent: 8 },
  { title: 'Send out invitations', weeksBeforeEvent: 6 },
  { title: 'Order birthday cake', weeksBeforeEvent: 4 },
  { title: 'Confirm guest count with caterer', weeksBeforeEvent: 3 },
  { title: 'Confirm all vendor bookings', weeksBeforeEvent: 2 },
  { title: 'Prepare day-of schedule', weeksBeforeEvent: 1 },
  { title: 'Make final payments to vendors', weeksBeforeEvent: 1 },
]

const NAMING_CEREMONY: ChecklistTemplate[] = [
  { title: 'Book venue', weeksBeforeEvent: 8 },
  { title: 'Book caterer', weeksBeforeEvent: 6 },
  { title: 'Book photographer', weeksBeforeEvent: 6 },
  { title: 'Book decorator', weeksBeforeEvent: 6 },
  { title: 'Book MC', weeksBeforeEvent: 5 },
  { title: 'Send out invitations', weeksBeforeEvent: 4 },
  { title: 'Finalise aso-ebi and colour scheme', weeksBeforeEvent: 4 },
  { title: 'Confirm guest count with caterer', weeksBeforeEvent: 2 },
  { title: 'Confirm all vendor bookings', weeksBeforeEvent: 1 },
  { title: 'Prepare naming ceremony programme', weeksBeforeEvent: 1 },
]

const CORPORATE: ChecklistTemplate[] = [
  { title: 'Define event objectives, agenda and target audience', weeksBeforeEvent: 16 },
  { title: 'Book venue', weeksBeforeEvent: 14 },
  { title: 'Confirm speakers and presenters', weeksBeforeEvent: 12 },
  { title: 'Book AV and technical equipment', weeksBeforeEvent: 10 },
  { title: 'Arrange catering', weeksBeforeEvent: 10 },
  { title: 'Send invitations and open registrations', weeksBeforeEvent: 8 },
  { title: 'Book photographer and/or videographer', weeksBeforeEvent: 8 },
  { title: 'Arrange guest accommodation if needed', weeksBeforeEvent: 6 },
  { title: 'Prepare event materials, banners, and branding', weeksBeforeEvent: 3 },
  { title: 'Confirm catering numbers', weeksBeforeEvent: 2 },
  { title: 'Final vendor confirmations and payments', weeksBeforeEvent: 1 },
  { title: 'Prepare event run sheet and day-of brief', weeksBeforeEvent: 1 },
]

const BURIAL: ChecklistTemplate[] = [
  { title: 'Book venue', weeksBeforeEvent: 4 },
  { title: 'Notify family and close friends', weeksBeforeEvent: 4 },
  { title: 'Book caterer', weeksBeforeEvent: 3 },
  { title: 'Book photographer and videographer', weeksBeforeEvent: 3 },
  { title: 'Book MC', weeksBeforeEvent: 2 },
  { title: 'Book decorator', weeksBeforeEvent: 2 },
  { title: 'Prepare programme and order of service', weeksBeforeEvent: 2 },
  { title: 'Confirm guest count with caterer', weeksBeforeEvent: 1 },
  { title: 'Confirm all arrangements', weeksBeforeEvent: 1 },
]

const OTHER: ChecklistTemplate[] = [
  { title: 'Book venue', weeksBeforeEvent: 12 },
  { title: 'Book caterer', weeksBeforeEvent: 10 },
  { title: 'Book entertainment', weeksBeforeEvent: 8 },
  { title: 'Book photographer', weeksBeforeEvent: 8 },
  { title: 'Book decorator', weeksBeforeEvent: 6 },
  { title: 'Send out invitations', weeksBeforeEvent: 6 },
  { title: 'Confirm guest count with caterer', weeksBeforeEvent: 3 },
  { title: 'Confirm all vendor bookings', weeksBeforeEvent: 2 },
  { title: 'Prepare day-of schedule', weeksBeforeEvent: 1 },
  { title: 'Make final payments to vendors', weeksBeforeEvent: 1 },
]

export const CHECKLIST_TEMPLATES: Record<string, ChecklistTemplate[]> = {
  wedding: WEDDING,
  birthday: BIRTHDAY,
  naming_ceremony: NAMING_CEREMONY,
  corporate: CORPORATE,
  burial: BURIAL,
  other: OTHER,
}
