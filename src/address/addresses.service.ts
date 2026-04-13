import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from './address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly repo: Repository<Address>,
  ) {}

  listMine(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.repo.update({ userId }, { isDefault: false });
    }
    const a = this.repo.create({
      userId,
      isDefault: dto.isDefault ?? false,
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      addressLine1: dto.addressLine1.trim(),
      addressLine2: dto.addressLine2?.trim() ?? null,
      city: dto.city.trim(),
      state: dto.state.trim(),
      country: dto.country.trim(),
      pinCode: dto.pinCode.trim(),
    });
    return this.repo.save(a);
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    const a = await this.repo.findOne({ where: { id, userId } });
    if (!a) throw new NotFoundException('Address not found');
    if (dto.isDefault === true) {
      await this.repo.update({ userId }, { isDefault: false });
    }
    if (dto.fullName !== undefined) a.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) a.phone = dto.phone.trim();
    if (dto.addressLine1 !== undefined)
      a.addressLine1 = dto.addressLine1.trim();
    if (dto.addressLine2 !== undefined)
      a.addressLine2 = dto.addressLine2?.trim() ?? null;
    if (dto.city !== undefined) a.city = dto.city.trim();
    if (dto.state !== undefined) a.state = dto.state.trim();
    if (dto.country !== undefined) a.country = dto.country.trim();
    if (dto.pinCode !== undefined) a.pinCode = dto.pinCode.trim();
    if (dto.isDefault !== undefined) a.isDefault = dto.isDefault;
    return this.repo.save(a);
  }

  async remove(userId: string, id: string) {
    const a = await this.repo.findOne({ where: { id, userId } });
    if (!a) throw new NotFoundException('Address not found');
    await this.repo.remove(a);
    return { id, deleted: true };
  }
}
