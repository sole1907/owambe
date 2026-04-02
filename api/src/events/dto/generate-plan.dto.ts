export class GeneratePlanDto {
  eventType: string
  eventTitle: string
  eventDate?: string
  eventDateApproximate?: string
  location?: string
  city?: string
  guestCount?: number
  budgetEstimate?: number
  styleTheme?: string
  hasExistingVendors?: boolean
  existingVendorCategories?: string[]
}
