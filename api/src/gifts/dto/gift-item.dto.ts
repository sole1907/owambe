export class CreateGiftItemDto {
  title: string
  description?: string
  priceEstimate?: number
  storeUrl?: string
  sortOrder?: number
}

export class UpdateGiftItemDto {
  title?: string
  description?: string
  priceEstimate?: number
  storeUrl?: string
  isPurchased?: boolean
  purchasedBy?: string
  sortOrder?: number
}
