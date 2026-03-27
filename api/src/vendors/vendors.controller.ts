import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { VendorsService } from './vendors.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

@Controller('vendors')
@UseGuards(JwtAuthGuard)
export class VendorsController {
  constructor(private vendors: VendorsService) {}

  @Get('categories')
  getCategories() {
    return this.vendors.getCategories()
  }

  @Get()
  getVendors(
    @Query('category') categorySlug?: string,
    @Query('city') city?: string,
    @Query('budgetMax') budgetMax?: string,
  ) {
    return this.vendors.getVendors({
      categorySlug,
      city,
      budgetMax: budgetMax ? parseInt(budgetMax) : undefined,
    })
  }

  @Get(':slug')
  getVendor(@Param('slug') slug: string) {
    return this.vendors.getVendor(slug)
  }
}
