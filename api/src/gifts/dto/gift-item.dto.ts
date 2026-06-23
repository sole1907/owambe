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

export class UpdateGiftSettingsDto {
  bankAccountName?: string
  bankAccountNumber?: string
  bankName?: string
  bankCode?: string
  cashContributionEnabled?: boolean
}

export class ClaimItemDto {
  claimerName: string
}

export class InitGiftPaymentDto {
  giftAmountNaira: number
  gifterName: string
  gifterEmail?: string
  message?: string
}

export class ReportDirectTransferDto {
  gifterName: string
  amountNaira: number
  message?: string
}
