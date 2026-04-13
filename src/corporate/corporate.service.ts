import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorporateAccount } from './corporate-account.entity';
import { UpsertCorporateAccountDto } from './dto/upsert-corporate-account.dto';

@Injectable()
export class CorporateService {
  constructor(
    @InjectRepository(CorporateAccount)
    private readonly repo: Repository<CorporateAccount>,
  ) {}

  getMine(userId: string) {
    return this.repo.findOne({ where: { userId } });
  }

  async upsertMine(userId: string, dto: UpsertCorporateAccountDto) {
    let row = await this.repo.findOne({ where: { userId } });
    if (!row) {
      row = this.repo.create({
        userId,
        companyName: dto.companyName.trim(),
        gstNumber: dto.gstNumber?.trim() ?? null,
        poCapability: dto.poCapability ?? false,
        creditLimit: null,
      });
    } else {
      row.companyName = dto.companyName.trim();
      if (dto.gstNumber !== undefined)
        row.gstNumber = dto.gstNumber?.trim() ?? null;
      if (dto.poCapability !== undefined) row.poCapability = dto.poCapability;
    }
    return this.repo.save(row);
  }

  listAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }
}
