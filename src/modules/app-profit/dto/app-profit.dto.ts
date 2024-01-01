import { AppProfit } from '@entities/app-profit.entity';
import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseTypeDTO, PaginationResponseType } from '@utils/index';

export class CurrentAppProfitDTO extends BaseResponseTypeDTO {
    @ApiProperty()
    total: number;
}

export class CreateAppProfitDTO {
    @ApiProperty()
    transactionId: string;

    @ApiProperty()
    amount: number;
}

export class AppProfitResponseDTO extends BaseResponseTypeDTO {
    @ApiProperty({ type: () => AppProfit })
    data: AppProfit;
}

export class AppProfitsResponseDTO extends BaseResponseTypeDTO {
    @ApiProperty({ type: () => [AppProfit] })
    data: AppProfit[];

    @ApiProperty({ type: () => PaginationResponseType })
    paginationControl?: PaginationResponseType;
}
