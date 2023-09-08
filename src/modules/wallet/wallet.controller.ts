import { Controller, Res, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  @Post('/webhook')
  async wemaBankWebhook(@Res() res: Response): Promise<void> {
    console.log({ res });
  }
}
