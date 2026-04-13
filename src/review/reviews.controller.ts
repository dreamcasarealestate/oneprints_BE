import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('by-designer/:designerId')
  @ApiOperation({ summary: 'Public reviews for a designer' })
  byDesigner(@Param('designerId', new ParseUUIDPipe()) designerId: string) {
    return this.reviews.listByDesigner(designerId);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Current user reviews' })
  mine(@CurrentUser() user: User) {
    return this.reviews.listMine(user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create review for an order you placed' })
  @ApiBody({ type: CreateReviewDto })
  create(@CurrentUser() user: User, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List reviews for designerId (query, public)' })
  list(@Query('designerId') designerId?: string) {
    if (!designerId?.trim()) {
      return [];
    }
    if (!isUUID(designerId, '4')) {
      throw new BadRequestException('designerId must be a UUID');
    }
    return this.reviews.listByDesigner(designerId);
  }
}
