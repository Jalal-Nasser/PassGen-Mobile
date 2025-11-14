import { google } from 'googleapis';

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleDriveService {
  private oauth2Client: any;
  private drive: any;

  constructor(config: GoogleDriveConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
    });
  }

  async setCredentials(code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  async setTokens(tokens: any): Promise<void> {
    this.oauth2Client.setCredentials(tokens);
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  getTokens(): any {
    return this.oauth2Client.credentials;
  }

  async savePassword(filename: string, data: string): Promise<string> {
    const fileMetadata = {
      name: filename,
      mimeType: 'application/json',
    };

    const media = {
      mimeType: 'application/json',
      body: data,
    };

    // Check if file exists
    const existingFile = await this.findFile(filename);
    
    if (existingFile) {
      // Update existing file
      const response = await this.drive.files.update({
        fileId: existingFile.id,
        media: media,
      });
      return response.data.id;
    } else {
      // Create new file
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
      });
      return response.data.id;
    }
  }

  async getPassword(filename: string): Promise<string> {
    const file = await this.findFile(filename);
    
    if (!file) {
      throw new Error('File not found');
    }

    const response = await this.drive.files.get({
      fileId: file.id,
      alt: 'media',
    });

    return JSON.stringify(response.data);
  }

  async listPasswords(): Promise<Array<{ id: string; name: string }>> {
    const response = await this.drive.files.list({
      q: "mimeType='application/json' and name contains 'passwords'",
      fields: 'files(id, name, createdTime, modifiedTime)',
      spaces: 'drive',
    });

    return response.data.files || [];
  }

  async deletePassword(fileId: string): Promise<void> {
    await this.drive.files.delete({
      fileId: fileId,
    });
  }

  private async findFile(filename: string): Promise<any> {
    const response = await this.drive.files.list({
      q: `name='${filename}' and mimeType='application/json'`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    return response.data.files?.[0];
  }
}
