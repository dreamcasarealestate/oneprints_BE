import { Injectable } from '@nestjs/common';
import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { RequestChecksumCalculation } from '@aws-sdk/middleware-flexible-checksums';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly region: string;

  constructor() {
    this.region = process.env.AWS_REGION?.trim() || 'ap-south-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

    this.s3 = new S3Client({
      region: this.region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
      requestChecksumCalculation: RequestChecksumCalculation.WHEN_REQUIRED,
    });
  }

  private ensureS3Configured(): void {
    if (
      !process.env.AWS_ACCESS_KEY_ID?.trim() ||
      !process.env.AWS_SECRET_ACCESS_KEY?.trim()
    ) {
      throw new Error(
        'S3 credentials not set. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to your .env file (e.g. .env.development).',
      );
    }
    if (!process.env.S3_BUCKET_NAME?.trim()) {
      throw new Error('S3_BUCKET_NAME is not set in your .env file.');
    }
  }

  async generateUploadURL(fileName: string, fileType: string): Promise<string> {
    this.ensureS3Configured();
    const bucket = process.env.S3_BUCKET_NAME?.trim();
    if (!bucket) throw new Error('S3_BUCKET_NAME is not set');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      ContentType: fileType,
    });

    // v3 expects expiresIn in seconds
    return getSignedUrl(this.s3, command, { expiresIn: 60 });
  }

  generatePublicURL(key: string): string {
    const bucket = process.env.S3_BUCKET_NAME?.trim();
    if (!bucket) throw new Error('S3_BUCKET_NAME is not set');
    return `https://${bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async generateSignedReadURL(
    fileUrl: string,
    expiresIn = 3600,
  ): Promise<string> {
    this.ensureS3Configured();
    const bucket = process.env.S3_BUCKET_NAME?.trim();
    if (!bucket) throw new Error('S3_BUCKET_NAME is not set');

    let key = fileUrl;
    if (/^https?:\/\//i.test(fileUrl)) {
      const url = new URL(fileUrl);
      key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    }

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async deleteFile(fileName: string): Promise<void> {
    this.ensureS3Configured();
    const bucket = process.env.S3_BUCKET_NAME?.trim();
    if (!bucket) throw new Error('S3_BUCKET_NAME is not set');

    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: fileName,
      }),
    );
  }

  async deleteFileByUrl(fileUrl: string): Promise<void> {
    if (!fileUrl) return;

    const trimmed = fileUrl.trim();
    if (!trimmed) return;

    try {
      if (/^https?:\/\//i.test(trimmed)) {
        const url = new URL(trimmed);
        const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
        if (!key) return;
        await this.deleteFile(key);
        return;
      }

      await this.deleteFile(trimmed);
    } catch (err) {
      console.error('Failed to delete file from S3:', err);
    }
  }
}
