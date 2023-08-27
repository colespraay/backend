import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  FileResponseDTO,
  uploadFileToImageKit,
  uploadFileToS3,
} from '@utils/index';

@Injectable()
export class AppService {
  private logger = new Logger(AppService.name);

  getHello(): string {
    return 'Hello World!';
  }

  async uploadMultipleFiles(
    files: Array<Express.Multer.File>,
  ): Promise<FileResponseDTO> {
    try {
      const filePaths = files.map((data) => ({
        path: `uploads/${data.filename}`,
        mimeType: data.mimetype,
      }));
      const filePathAsync = filePaths.map((file) => {
        if (file.mimeType.startsWith('image')) {
          return uploadFileToImageKit(file.path, true);
        }
        return uploadFileToS3(file.path, true);
      });
      const [...uploadedFilePaths] = await Promise.all(filePathAsync);
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Uploaded',
        data: uploadedFilePaths,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
