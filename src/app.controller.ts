import {
  Controller,
  Get,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiResponse, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { FileResponseDTO, MulterValidators } from '@utils/index';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appSrv: AppService) {}

  @Get()
  getHello(): { message: string } {
    return this.appSrv.getHello();
  }

  @Get('/health-check')
  healthCheck(@Res() res: Response): void {
    const healthcheck = {
      uptime: process.uptime(),
      message: 'OK',
      timestamp: Date.now(),
    };
    try {
      res.send(healthcheck);
    } catch (ex) {
      healthcheck.message = ex;
      res.status(503).send();
    }
  }

  @ApiConsumes('multipart/form-data')
  @ApiResponse({ type: () => FileResponseDTO })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        'files[]': {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files[]', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: MulterValidators.preserveOriginalFileName,
      }),
      fileFilter: MulterValidators.fileTypeFilter,
    }),
  )
  @Post('/upload-files')
  async uploadMultipleFiles(
    @UploadedFiles() files: Array<Express.Multer.File>,
  ): Promise<FileResponseDTO> {
    return await this.appSrv.uploadMultipleFiles(files);
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async keepServerActive(): Promise<void> {
    const today = new Date().toLocaleDateString();
    console.log({
      today,
      time: Date.now(),
      message: 'keep server active for 30 more seconds 😊',
    });
  }
}
