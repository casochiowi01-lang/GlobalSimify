import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service.js';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('countries')
  async countries(@Query('region') region?: string) {
    await this.catalog.ensureFresh();
    return this.catalog.listCountries(region);
  }

  @Get('countries/:iso')
  async country(@Param('iso') iso: string) {
    await this.catalog.ensureFresh();
    const country = this.catalog.getCountry(iso);
    if (!country) throw new NotFoundException(`Unknown destination: ${iso}`);
    return {
      ...country,
      products: this.catalog.listProducts(country.iso),
    };
  }

  @Get('products')
  async products(@Query('dest') dest?: string) {
    await this.catalog.ensureFresh();
    return this.catalog.listProducts(dest);
  }

  @Get('products/:id')
  async product(@Param('id') id: string) {
    await this.catalog.ensureFresh();
    const product = this.catalog.getProduct(id);
    if (!product) throw new NotFoundException(`Unknown product: ${id}`);
    return product;
  }

  @Get('search')
  async search(@Query('q') q?: string) {
    await this.catalog.ensureFresh();
    return this.catalog.search(q ?? '');
  }
}
