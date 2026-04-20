import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

export type AssignBranchInput = {
  pinCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/** Great-circle distance between two lat/lng points, in kilometres. */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function hasCoords(
  branch: Branch,
): branch is Branch & { latitude: number; longitude: number } {
  return (
    typeof branch.latitude === 'number' &&
    typeof branch.longitude === 'number' &&
    Number.isFinite(branch.latitude) &&
    Number.isFinite(branch.longitude)
  );
}

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly repo: Repository<Branch>,
  ) {}

  findActivePublic() {
    return this.repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        country: true,
        isActive: true,
      },
    });
  }

  findAllForAdmin() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const b = await this.repo.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Branch not found');
    return b;
  }

  /**
   * Pick the branch that should fulfil an order using a hybrid strategy:
   *  1. Longest matching `pinCodePrefixes` wins (more specific prefix beats a
   *     shorter one — e.g. `"5000"` beats `"500"`).
   *  2. If several branches tie at the same longest prefix length (or none
   *     match and the caller still needs a branch) and the customer supplied
   *     coordinates, break the tie by picking the branch with the shortest
   *     haversine distance — considering only branches that have their own
   *     lat/lng on file.
   *  3. Final fallback keeps the legacy behaviour (first active branch
   *     alphabetically) so existing deployments without coordinates still
   *     resolve to something sensible.
   */
  async assignBranchForOrder(input: AssignBranchInput): Promise<Branch | null> {
    const normalized = (input.pinCode || '').replace(/\s/g, '');
    const branches = await this.repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
    if (branches.length === 0) return null;

    const custLat =
      typeof input.latitude === 'number' && Number.isFinite(input.latitude)
        ? input.latitude
        : null;
    const custLng =
      typeof input.longitude === 'number' && Number.isFinite(input.longitude)
        ? input.longitude
        : null;
    const customerHasCoords = custLat !== null && custLng !== null;

    let longest = 0;
    let prefixMatches: Branch[] = [];
    if (normalized) {
      for (const branch of branches) {
        let best = 0;
        for (const raw of branch.pinCodePrefixes || []) {
          const prefix = String(raw || '').trim();
          if (!prefix) continue;
          if (normalized.startsWith(prefix) && prefix.length > best) {
            best = prefix.length;
          }
        }
        if (best > 0 && best > longest) {
          longest = best;
          prefixMatches = [branch];
        } else if (best > 0 && best === longest) {
          prefixMatches.push(branch);
        }
      }
    }

    if (prefixMatches.length === 1) {
      return prefixMatches[0];
    }

    if (prefixMatches.length > 1) {
      if (customerHasCoords) {
        const geo = prefixMatches.filter(hasCoords);
        if (geo.length > 0) {
          return geo.reduce((nearest, candidate) =>
            haversineKm(custLat!, custLng!, candidate.latitude, candidate.longitude) <
            haversineKm(custLat!, custLng!, nearest.latitude, nearest.longitude)
              ? candidate
              : nearest,
          );
        }
      }
      return prefixMatches[0];
    }

    if (customerHasCoords) {
      const geo = branches.filter(hasCoords);
      if (geo.length > 0) {
        return geo.reduce((nearest, candidate) =>
          haversineKm(custLat!, custLng!, candidate.latitude, candidate.longitude) <
          haversineKm(custLat!, custLng!, nearest.latitude, nearest.longitude)
            ? candidate
            : nearest,
        );
      }
    }

    return branches[0];
  }

  /** Back-compat shim: pin-only entry point still used by callers that don't have coords. */
  assignBranchForPinCode(pinCode: string): Promise<Branch | null> {
    return this.assignBranchForOrder({ pinCode });
  }

  create(dto: CreateBranchDto) {
    const entity = this.repo.create({
      name: dto.name.trim(),
      city: dto.city?.trim() ?? null,
      state: dto.state?.trim() ?? null,
      country: dto.country?.trim() ?? null,
      address: dto.address?.trim() ?? null,
      contactEmail: dto.contactEmail?.trim().toLowerCase() ?? null,
      contactPhone: dto.contactPhone?.trim() ?? null,
      gstNumber: dto.gstNumber?.trim() ?? null,
      isActive: dto.isActive ?? true,
      managerUserId: dto.managerUserId ?? null,
      pinCodePrefixes: dto.pinCodePrefixes ?? [],
      latitude:
        typeof dto.latitude === 'number' && Number.isFinite(dto.latitude)
          ? dto.latitude
          : null,
      longitude:
        typeof dto.longitude === 'number' && Number.isFinite(dto.longitude)
          ? dto.longitude
          : null,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateBranchDto) {
    const branch = await this.findOne(id);
    if (dto.name !== undefined) branch.name = dto.name.trim();
    if (dto.city !== undefined) branch.city = dto.city?.trim() ?? null;
    if (dto.state !== undefined) branch.state = dto.state?.trim() ?? null;
    if (dto.country !== undefined) branch.country = dto.country?.trim() ?? null;
    if (dto.address !== undefined) branch.address = dto.address?.trim() ?? null;
    if (dto.contactEmail !== undefined)
      branch.contactEmail = dto.contactEmail?.trim().toLowerCase() ?? null;
    if (dto.contactPhone !== undefined)
      branch.contactPhone = dto.contactPhone?.trim() ?? null;
    if (dto.gstNumber !== undefined)
      branch.gstNumber = dto.gstNumber?.trim() ?? null;
    if (dto.isActive !== undefined) branch.isActive = dto.isActive;
    if (dto.managerUserId !== undefined)
      branch.managerUserId = dto.managerUserId ?? null;
    if (dto.pinCodePrefixes !== undefined)
      branch.pinCodePrefixes = dto.pinCodePrefixes ?? [];
    if (dto.latitude !== undefined)
      branch.latitude =
        typeof dto.latitude === 'number' && Number.isFinite(dto.latitude)
          ? dto.latitude
          : null;
    if (dto.longitude !== undefined)
      branch.longitude =
        typeof dto.longitude === 'number' && Number.isFinite(dto.longitude)
          ? dto.longitude
          : null;
    return this.repo.save(branch);
  }
}
