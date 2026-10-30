import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';
import { PromotionsService } from './promotions.service.js';

class ValidatePromoDto {
  @IsString() code!: string;
  @IsNumber() @Min(0) amountKes!: number;
}

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Post('validate')
  validate(@Body() dto: ValidatePromoDto) {
    return this.promotions.preview(dto.code, dto.amountKes);
  }
}
