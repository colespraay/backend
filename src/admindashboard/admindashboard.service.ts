import { Injectable } from '@nestjs/common';
import { CreateAdmindashboardDto } from './dto/create-admindashboard.dto';
import { UpdateAdmindashboardDto } from './dto/update-admindashboard.dto';

@Injectable()
export class AdmindashboardService {
  create(createAdmindashboardDto: CreateAdmindashboardDto) {
    return 'This action adds a new admindashboard';
  }

  findAll() {
    return `This action returns all admindashboard`;
  }

  findOne(id: number) {
    return `This action returns a #${id} admindashboard`;
  }

  update(id: number, updateAdmindashboardDto: UpdateAdmindashboardDto) {
    return `This action updates a #${id} admindashboard`;
  }

  remove(id: number) {
    return `This action removes a #${id} admindashboard`;
  }
}
