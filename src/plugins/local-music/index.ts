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
  getSystemDarkMode(): Promise<SystemDarkModeResult>;
  addListener(
    eventName: "darkModeChange",
    listenerFunc: (event: DarkModeChangeEvent) => void
  ): Promise<PluginListenerHandle>;
}

const LocalMusicPlugin = registerPlugin<LocalMusicPlugin>("LocalMusicPlugin");
