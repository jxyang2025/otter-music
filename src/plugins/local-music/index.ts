import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface LocalMusicFile {
  id: string;
  name: string | null;
  artist: string | null;
  album: string | null;
  duration: number;
  localPath: string;
  fileSize: number;
  modifiedTime?: number;
}

export interface ScanResult {
  success: boolean;
  files: LocalMusicFile[];
  error?: string;
}

export interface LocalFileUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface EmbeddedCoverResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

export interface EmbeddedLyricsResult {
  success: boolean;
  lyric?: string;
  tlyric?: string;
  error?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export interface ExcludedFoldersResult {
  success: boolean;
  folders: string[];
  error?: string;
}

export interface PickDirectoryResult {
  success: boolean;
  path?: string;
  uri?: string;
  error?: string;
}

export interface OpenSettingsResult {
  success: boolean;
}

export interface PickDownloadDirectoryResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface SystemDarkModeResult {
  isDarkMode: boolean;
}

export interface DarkModeChangeEvent {
  isDarkMode: boolean;
}

export interface LocalMusicPlugin {
  scanLocalMusic(): Promise<ScanResult>;
  getLocalFileUrl(options: { localPath: string }): Promise<LocalFileUrlResult>;
  getEmbeddedCover(options: {
    localPath: string;
  }): Promise<EmbeddedCoverResult>;
  getEmbeddedLyrics(options: {
    localPath: string;
  }): Promise<EmbeddedLyricsResult>;
  deleteLocalMusic(options: { localPath: string }): Promise<DeleteResult>;
  scanAllStorage(): Promise<ScanResult>;
  getExcludedFolders(): Promise<ExcludedFoldersResult>;
  pickExcludedDirectory(): Promise<PickDirectoryResult>;
  removeExcludedFolder(options: { folder: string }): Promise<DeleteResult>;
  openManageStorageSettings(): Promise<OpenSettingsResult>;
  pickDownloadDirectory(): Promise<PickDownloadDirectoryResult>;
  getSystemDarkMode(): Promise<SystemDarkModeResult>;
  addListener(
    eventName: "darkModeChange",
    listenerFunc: (event: DarkModeChangeEvent) => void
  ): Promise<PluginListenerHandle>;
}

export const LocalMusicPlugin = registerPlugin<LocalMusicPlugin>("LocalMusicPlugin");
