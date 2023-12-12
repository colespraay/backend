import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const errorResponse = exception['response'];
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    if (
      errorResponse &&
      errorResponse['statusCode'] &&
      typeof errorResponse['statusCode'] !== 'undefined'
    ) {
      statusCode = errorResponse['statusCode'];
    }
    if (typeof exception.getStatus === 'function') {
      const exceptionStatusCode = exception.getStatus();
      if (exceptionStatusCode) {
        statusCode = exceptionStatusCode;
      }
    }
    response.status(statusCode).json({
      name: exception.name,
      message: exception.message,
      success: false,
      code: statusCode,
      time: new Date().toISOString(),
      url: request.path,
    });
  }
}
