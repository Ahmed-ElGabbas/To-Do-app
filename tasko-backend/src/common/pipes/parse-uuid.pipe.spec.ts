import { BadRequestException } from '@nestjs/common';
import { ParseUUIDPipe } from './parse-uuid.pipe';

describe('ParseUUIDPipe', () => {
  const pipe = new ParseUUIDPipe();

  it('passes valid UUIDs through unchanged', () => {
    const uuid = '3f476124-f646-4f0c-8e24-863eab0571b4';
    expect(pipe.transform(uuid)).toBe(uuid);
  });

  it('rejects non-UUID strings', () => {
    expect(() => pipe.transform('not-a-uuid')).toThrow(BadRequestException);
    expect(() => pipe.transform('12345')).toThrow(BadRequestException);
    expect(() => pipe.transform('')).toThrow(BadRequestException);
  });
});
