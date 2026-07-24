import * as FileSystem from 'expo-file-system/legacy';

const RECORDINGS_DIR = `${FileSystem.documentDirectory}SafeGo/recordings/`;

class RecordingCacheService {
  constructor() {
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(RECORDINGS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('[RecordingCacheService] Failed to create recordings directory:', error);
    }
  }

  public getLocalPath(id: string): string {
    return `${RECORDINGS_DIR}${id}.m4a`;
  }

  public async exists(id: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(this.getLocalPath(id));
      return info.exists;
    } catch (e) {
      return false;
    }
  }

  public async delete(id: string): Promise<boolean> {
    try {
      if (await this.exists(id)) {
        await FileSystem.deleteAsync(this.getLocalPath(id), { idempotent: true });
      }
      return true;
    } catch (e) {
      console.error('[RecordingCacheService] Failed to delete local recording:', e);
      return false;
    }
  }

  public async download(
    id: string, 
    url: string, 
    onProgress?: (progress: number) => void
  ): Promise<string | null> {
    await this.ensureDirectoryExists();
    const destPath = this.getLocalPath(id);

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        destPath,
        {},
        (downloadProgress) => {
          if (onProgress) {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            onProgress(Math.round(progress * 100));
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result && result.uri) {
        return result.uri;
      }
      return null;
    } catch (e) {
      console.error('[RecordingCacheService] Failed to download recording:', e);
      return null;
    }
  }
}

export default new RecordingCacheService();
