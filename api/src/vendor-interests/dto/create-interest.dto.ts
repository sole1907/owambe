export class CreateInterestDto {
  vendorId: string
  preferenceRank: number // 1=A, 2=B, 3=C
  offeredPrice?: number  // user's negotiated offer (pre-filled from category budget)
}
