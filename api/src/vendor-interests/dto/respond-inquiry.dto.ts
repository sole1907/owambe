export class RespondInquiryDto {
  available: boolean
  counterPrice?: number // set if vendor wants to counter the offered price
  isFinalOffer?: boolean // when true, user can only accept or decline the counter
  notes?: string
}
