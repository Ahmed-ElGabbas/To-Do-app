import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { FileUploadErrorFilter } from '../filters/file-upload-error.filter';
import { FileService } from '../services/file.service';

/**
 * Hard memory-bomb guard applied by multer. The authoritative business limit
 * (`MAX_FILE_SIZE_MB`) is enforced in FileService with a clean 422 response.
 */
const MAX_UPLOAD_HARD_CAP_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function avatarFileFilter(
  _request: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    callback(
      new BadRequestException(`Unsupported file type: ${file.mimetype}`),
      false,
    );
    return;
  }
  callback(null, true);
}

@Controller('files')
@UseFilters(FileUploadErrorFilter)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_HARD_CAP_BYTES, files: 1 },
      fileFilter: avatarFileFilter,
    }),
  )
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.fileService.uploadAvatar(user.id, file);
  }

  @Get('avatar')
  getAvatar(@CurrentUser() user: AuthenticatedUser) {
    return this.fileService.getAvatar(user.id);
  }

  @Delete('avatar')
  deleteAvatar(@CurrentUser() user: AuthenticatedUser) {
    return this.fileService.deleteAvatar(user.id);
  }
}
