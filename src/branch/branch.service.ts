import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

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

  /** Pick branch whose pinCodePrefixes match the start of pinCode */
  async assignBranchForPinCode(pinCode: string): Promise<Branch | null> {
    const normalized = (pinCode || '').replace(/\s/g, '');
    if (!normalized) return null;
    const branches = await this.repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
    for (const b of branches) {
      for (const p of b.pinCodePrefixes || []) {
        if (p && normalized.startsWith(String(p).trim())) {
          return b;
        }
      }
    }
    return branches[0] ?? null;
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
    return this.repo.save(branch);
  }
}
