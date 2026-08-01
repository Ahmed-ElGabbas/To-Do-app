import { randomUUID } from 'crypto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import * as multer from 'multer';
import { Request, Response } from 'express';

/**
 * Maps multer upload errors (e.g. LIMIT_FILE_SIZE) to the standard error
 * envelope instead of falling through to a generic 500. Runs before the
 * global exception filter because it is controller-scoped.
 */
@Catch(multer.MulterError)
export class FileUploadErrorFilter implements ExceptionFilter {
  catch(exception: multer.MulterError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();
    const correlationId = request.correlationId ?? randomUUID();

    const isTooLarge = exception.code === 'LIMIT_FILE_SIZE';
    const status = isTooLarge
      ? HttpStatus.PAYLOAD_TOO_LARGE
      : HttpStatus.BAD_REQUEST;
    const code = isTooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_REJECTED';

    response.status(status).json({
      success: false,
      error: {
        code,
        message: isTooLarge
          ? 'File exceeds the maximum allowed size'
          : exception.message,
        correlationId,
      },
    });
  }
}
