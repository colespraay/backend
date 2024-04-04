import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AdmindashboardService } from './admindashboard.service';
import { CreateAdmindashboardDto } from './dto/create-admindashboard.dto';
import { UpdateAdmindashboardDto } from './dto/update-admindashboard.dto';

@Controller('admindashboard')
export class AdmindashboardController {
  constructor(private readonly admindashboardService: AdmindashboardService) {}

}
