import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Throttle } from '@nestjs/throttler';
import { AssistantService } from './assistant.service.js';
import { AssistantAuthGuard } from './assistant-auth.guard.js';
import { OptionalUserId } from '../auth/jwt-auth.guard.js';

class ChatMessageDto {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant';
  @IsString() @MaxLength(2000) content!: string;
}

class ChatDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}

@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  // Tighter rate limit than the global default — LLM calls cost money.
  @Get('status')
  @Header('Cache-Control', 'no-store, private')
  status() {
    return { enabled: this.assistant.enabled };
  }

  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('chat')
  @Header('Cache-Control', 'no-store, private')
  @UseGuards(AssistantAuthGuard)
  async chat(@Body() dto: ChatDto, @OptionalUserId() userId?: string) {
    if (
      dto.messages.at(-1)?.role !== 'user' ||
      !dto.messages.at(-1)?.content.trim()
    )
      throw new BadRequestException('End the conversation with your question.');
    if (dto.messages.reduce((n, m) => n + m.content.length, 0) > 12000)
      throw new BadRequestException(
        'Please clear chat and ask a shorter question.',
      );
    return this.assistant.chat(dto.messages, userId);
  }
}
