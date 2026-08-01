import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

/**
 * Validates that a route parameter is a UUID v4. Rejects non-UUID values with
 * a 400 instead of letting them reach the service layer.
 */
@Injectable()
export class ParseUUIDPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isUUID(value, '4')) {
      throw new BadRequestException(
        `Expected a UUID v4 but received "${value}"`,
      );
    }
    return value;
  }
}
