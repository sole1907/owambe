export class CreateVendorDto {
  name: string
  categoryId: string
  description?: string
  location: string
  city: string
  priceMin?: number
  priceMax?: number
  phone?: string
  whatsapp?: string
  email?: string
  instagram?: string
  website?: string
  photos?: string[]
  videos?: string[]
  capacity?: number
  isFeatured?: boolean
}

export class UpdateVendorDto {
  name?: string
  categoryId?: string
  description?: string
  location?: string
  city?: string
  priceMin?: number
  priceMax?: number
  phone?: string
  whatsapp?: string
  email?: string
  instagram?: string
  website?: string
  photos?: string[]
  videos?: string[]
  capacity?: number
  isFeatured?: boolean
  isActive?: boolean
}
