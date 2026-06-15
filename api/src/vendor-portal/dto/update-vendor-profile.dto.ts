export class UpdateVendorProfileDto {
  phone?: string
  whatsapp?: string
  email?: string
  instagram?: string
  website?: string
  description?: string
  servicefee?: number
  perUnitCost?: number
  perUnitLabel?: string
  hasMaterialCosts?: boolean
  priceMin?: number
  priceMax?: number
  commitmentFeePercentage?: number
  balancePaymentMethods?: string[]
  cancellationPolicy?: {
    fullRefundDays: number
    partialRefundDays: number
    partialRefundPercentage: number
  }
}
