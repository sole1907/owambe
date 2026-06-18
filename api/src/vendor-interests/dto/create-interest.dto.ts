export class MenuSelectionDto {
  menuItemId: string
  servings: number
}

export class CreateInterestDto {
  vendorId: string
  preferenceRank: number // 1=A, 2=B, 3=C
  offeredPrice?: number  // used for non-caterer vendors; caterers compute from menuSelections
  isFinalOffer?: boolean
  menuSelections?: MenuSelectionDto[] // caterer menu order
  discountRequested?: number // caterers only: organiser requests this flat discount on the computed total
}
