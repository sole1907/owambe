export class CreateGiftItemDto {
  title: string
  description?: string
  priceEstimate?: number
  sortOrder?: number
}

export class UpdateGiftItemDto {
  title?: string
  description?: string
  priceEstimate?: number
  isPurchased?: boolean
  purchasedBy?: string
  sortOrder?: number
}
