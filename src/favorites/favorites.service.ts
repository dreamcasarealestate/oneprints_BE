import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './favorite.entity';
import { ToggleFavoriteDto } from './dto/toggle-favorite.dto';

function normalizeResourceKey(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly repo: Repository<Favorite>,
  ) {}

  async toggle(userId: string, dto: ToggleFavoriteDto) {
    const resourceKey = normalizeResourceKey(dto.resourceKey);
    if (!resourceKey) {
      throw new BadRequestException('resourceKey is required');
    }

    const existing = await this.repo.findOne({
      where: { userId, resourceKey },
    });

    if (existing) {
      await this.repo.remove(existing);
      return {
        isFavourite: false,
        favorite: null,
      };
    }

    const favorite = this.repo.create({
      userId,
      resourceKey,
      resourceType: dto.resourceType?.trim() || 'generic',
      title: dto.title?.trim() || null,
      payload: dto.payload ?? {},
    });

    const saved = await this.repo.save(favorite);
    return {
      isFavourite: true,
      favorite: saved,
    };
  }

  async check(userId: string, resourceKey: string) {
    const key = normalizeResourceKey(resourceKey);
    if (!key) {
      throw new BadRequestException('resourceKey is required');
    }

    const favorite = await this.repo.findOne({
      where: { userId, resourceKey: key },
    });

    return {
      isFavourite: !!favorite,
      favorite,
    };
  }

  async listMine(userId: string, resourceType?: string) {
    const type = resourceType?.trim();
    return this.repo.find({
      where: type ? { userId, resourceType: type } : { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async removeByKey(userId: string, resourceKey: string) {
    const key = normalizeResourceKey(resourceKey);
    if (!key) {
      throw new BadRequestException('resourceKey is required');
    }

    const favorite = await this.repo.findOne({
      where: { userId, resourceKey: key },
    });
    if (!favorite) {
      throw new NotFoundException('Favourite not found');
    }

    await this.repo.remove(favorite);
    return {
      deleted: true,
      resourceKey: key,
    };
  }
}
