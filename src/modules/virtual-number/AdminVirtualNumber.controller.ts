import {
    Controller,
    Get,
    Query,
    UseGuards,
    Param,
    Post,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiQuery,
} from '@nestjs/swagger';
import { Roles, RolesGuard } from '@schematics/index';
import { VirtualNumberService } from './virtual-number.service';
import { ListAllOrdersDto } from './dto/virtual-number.dto';
import { AppRole } from '@utils/utils.constant';

@UseGuards(RolesGuard)
@ApiBearerAuth('JWT')
@Roles(AppRole.ADMIN) 
@ApiTags('admin/virtual-numbers')
@Controller('admin/virtual-numbers')
export class AdminVirtualNumberController {
    constructor(private readonly virtualNumberSrv: VirtualNumberService) {}

    @ApiOperation({ description: 'Get virtual numbers dashboard statistics (Admin)' })
    @Get('dashboard')
    async getAdminDashboard() {
        return await this.virtualNumberSrv.getAdminDashboard();
    }

    @ApiOperation({ description: 'List all virtual number orders with pagination (Admin)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'status', required: false, enum: ['WAITING_SMS', 'RECEIVED', 'COMPLETED', 'CANCELLED', 'TIMEOUT', 'FAILED'] })
    @ApiQuery({ name: 'service', required: false, type: String })
    @ApiQuery({ name: 'country', required: false, type: String })
    @ApiQuery({ name: 'userId', required: false, type: String })
    @Get('orders')
    async listAllOrders(@Query() query: ListAllOrdersDto) {
        return await this.virtualNumberSrv.listAllOrders(query);
    }

    @ApiOperation({ description: 'Get specific order details (Admin)' })
    @Get('orders/:id')
    async getOrderDetail(@Param('id') id: string) {
        return await this.virtualNumberSrv.getOrderDetailAdmin(id);
    }

    @ApiOperation({ description: 'Manually refresh order status from provider (Admin)' })
    @Post('orders/:id/refresh')
    async refreshOrder(@Param('id') id: string) {
        return await this.virtualNumberSrv.refreshOrderAdmin(id);
    }

    @ApiOperation({ description: 'Cancel an order (Admin)' })
    @Post('orders/:id/cancel')
    async cancelOrder(@Param('id') id: string) {
        return await this.virtualNumberSrv.cancelOrderAdmin(id);
    }
}