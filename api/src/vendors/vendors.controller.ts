import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { VendorsService } from './vendors.service'
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'

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
    @Query('minCapacity') minCapacity?: string,
  ) {
    return this.vendors.getVendors({
      categorySlug,
      city,
      budgetMax: budgetMax ? parseInt(budgetMax) : undefined,
      minCapacity: minCapacity ? parseInt(minCapacity) : undefined,
    })
  }

  @Get('menu-catalog')
  getMenuCatalog(@Query('city') city: string) {
    return this.vendors.getMenuCatalog(city || '')
  }

  @Get(':slug/menu')
  getVendorMenu(@Param('slug') slug: string) {
    return this.vendors.getVendorMenu(slug)
  }

  @Get('style-catalog')
  getStyleCatalog(@Query('city') city: string) {
    return this.vendors.getStyleCatalog(city || '')
  }

  @Get(':slug/packages')
  getVendorPackages(@Param('slug') slug: string) {
    return this.vendors.getVendorPackages(slug)
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

  @Post(':id/create-account')
  createVendorUser(@Param('id') id: string, @Body() body: { email: string; password: string }) {
    return this.vendors.adminCreateVendorUser(id, body.email, body.password)
  }
}
