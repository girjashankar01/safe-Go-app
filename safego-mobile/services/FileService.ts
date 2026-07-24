import * as FileSystem from 'expo-file-system/legacy';

export interface FileMetadata {
  exists: boolean;
  size?: number;
  uri?: string;
  isDirectory?: boolean;
}

class FileService {
  /**
   * Retrieves metadata for a file at the given URI.
   * @param uri The local URI of the file
   * @returns An object containing size in bytes and existence status
   */
  public async getFileMetadata(uri: string): Promise<FileMetadata> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        return {
          exists: true,
          size: info.size,
          uri: info.uri,
          isDirectory: info.isDirectory
        };
      } else {
        return { exists: false };
      }
    } catch (e: any) {
      console.warn(`[FileService] Error getting metadata for ${uri}:`, e.message);
      return { exists: false };
    }
  }
}

export default new FileService();
