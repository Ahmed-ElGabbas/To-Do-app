import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

/**
 * S3-compatible object storage. Download URLs are short-lived pre-signed GET
 * URLs so private objects are never served directly from the API server.
 */
@Injectable()
export class S3StorageService extends StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly presignTtlSeconds: number;

  constructor(config: ConfigService) {
    super();
    this.bucket = config.get<string>('s3.bucket', '');
    this.presignTtlSeconds = config.get<number>('s3.presignTtlSeconds', 3600);
    this.client = new S3Client({
      region: config.get<string>('s3.region', 'us-east-1'),
      endpoint: config.get<string>('s3.endpoint') || undefined,
      credentials: {
        accessKeyId: config.get<string>('s3.accessKeyId', ''),
        secretAccessKey: config.get<string>('s3.secretAccessKey', ''),
      },
    });
  }

  async save(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  async getUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: this.presignTtlSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
