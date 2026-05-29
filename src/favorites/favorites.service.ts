import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './favorite.entity';
import { ToggleFavoriteDto } from './dto/toggle-favorite.dto';
import { Product } from '../catalogue/product.entity';

function normalizeResourceKey(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Pull the catalogue product id out of a favourite's resourceKey.
 * Product favourites are keyed as `product:<uuid>`; anything else
 * returns null and skips the live-price refresh.
 */
function extractProductId(fav: Favorite): string | null {
  if (fav.resourceType === 'product' && fav.resourceKey.startsWith('product:')) {
    const id = fav.resourceKey.slice('product:'.length).trim();
    return id || null;
  }
  const payloadId =
    fav.payload && typeof fav.payload['productId'] === 'string'
      ? (fav.payload['productId'] as string)
      : null;
  return payloadId;
}

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly repo: Repository<Favorite>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
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
    const favorites = await this.repo.find({
      where: type ? { userId, resourceType: type } : { userId },
      order: { updatedAt: 'DESC' },
    });

    // Live-price refresh: anywhere a product is rendered to the
    // shopper (cart, PDP, /saved) we want the current admin-set
    // catalogue price to win — orders/invoices snapshot the price at
    // checkout time and live in their own pipeline. We resolve the
    // current `basePrice` / `image` in-memory only; the favourite
    // row's payload is the cached snapshot and we leave it untouched
    // on the DB so unrelated metadata (e.g. category slug renames)
    // stays stable.
    const productIds = Array.from(
      new Set(
        favorites
          .map((f) => extractProductId(f))
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    if (productIds.length === 0) return favorites;

    const products = await this.productsRepo.find({
      where: productIds.map((id) => ({ id })),
    });
    const productById = new Map<string, Product>(
      products.map((p) => [p.id, p]),
    );

    return favorites.map((fav) => {
      const productId = extractProductId(fav);
      if (!productId) return fav;
      const product = productById.get(productId);
      if (!product) return fav;

      const livePayload = {
        ...(fav.payload ?? {}),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        basePrice: Number(product.basePrice),
        availableColours: product.availableColours ?? [],
        availableSizes: product.availableSizes ?? [],
        image:
          (Array.isArray(product.images) && product.images[0]) ||
          (fav.payload && typeof fav.payload['image'] === 'string'
            ? (fav.payload['image'] as string)
            : null),
        isActive: product.isActive,
      };

      return { ...fav, payload: livePayload };
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
