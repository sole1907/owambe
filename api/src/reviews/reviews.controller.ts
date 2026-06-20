import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ReviewsService } from './reviews.service'
import { SubmitReviewDto } from './dto/submit-review.dto'

@Controller()
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  // Submit a review for a committed vendor interest
  @Post('vendor-interests/:interestId/review')
  @UseGuards(JwtAuthGuard)
  submitReview(
    @Param('interestId') interestId: string,
    @Body() dto: SubmitReviewDto,
    @CurrentUser() user: any,
  ) {
    return this.reviews.submitReview(user.id, interestId, dto)
  }

  // Get all vendor reviews (public — shown on vendor profile page)
  @Get('vendors/:slug/reviews')
  getVendorReviews(@Param('slug') slug: string) {
    return this.reviews.getVendorReviews(slug)
  }

  // Get commitments the user can review (event passed, no review yet)
  @Get('reviews/reviewable')
  @UseGuards(JwtAuthGuard)
  getReviewable(@CurrentUser() user: any) {
    return this.reviews.getReviewable(user.id)
  }
}
