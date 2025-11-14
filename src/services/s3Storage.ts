import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string; // For DigitalOcean Spaces
}

export class S3StorageService {
  private client: S3Client;
  private bucket: string;

  constructor(config: S3Config) {
    this.bucket = config.bucket;
    
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint && { endpoint: config.endpoint }),
    });
  }

  async savePassword(filename: string, data: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: `passwords/${filename}`,
      Body: data,
      ContentType: 'application/json',
    });

    await this.client.send(command);
  }

  async getPassword(filename: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: `passwords/${filename}`,
    });

    const response = await this.client.send(command);
    const body = await response.Body?.transformToString();
    return body || '';
  }

  async listPasswords(): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: 'passwords/',
    });

    const response = await this.client.send(command);
    return response.Contents?.map(item => item.Key?.replace('passwords/', '') || '') || [];
  }

  async deletePassword(filename: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: `passwords/${filename}`,
    });

    await this.client.send(command);
  }
}

// DigitalOcean Spaces helper
export function createDigitalOceanSpacesClient(config: Omit<S3Config, 'endpoint'>): S3StorageService {
  return new S3StorageService({
    ...config,
    endpoint: `https://${config.region}.digitaloceanspaces.com`,
  });
}
