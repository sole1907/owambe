import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { VendorsService } from './vendors.service'
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
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

// Admin-only vendor management
@Controller('admin/vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminVendorsController {
  constructor(private vendors: VendorsService) {}

  @Get()
  getAllVendors() {
    return this.vendors.adminGetAllVendors()
  }

  @Get(':id')
  getVendor(@Param('id') id: string) {
    return this.vendors.adminGetVendor(id)
  }

  @Post()
  createVendor(@Body() dto: CreateVendorDto) {
    return this.vendors.adminCreateVendor(dto)
  }

  @Patch(':id')
  updateVendor(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.vendors.adminUpdateVendor(id, dto)
  }
}
