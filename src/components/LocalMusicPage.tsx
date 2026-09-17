"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  RefreshCw,
  Music,
  HardDrive,
  HardDriveDownload,
  WifiOff,
  Trash2,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { LocalMusicPlugin, LocalMusicFile } from "@/plugins/local-music";
import { MusicTrack } from "@/types/music";
import { MusicPlaylistView } from "./MusicPlaylistView";
import { cn } from "@/lib/utils";
import { PageLayout } from "./PageLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import toast from "react-hot-toast";
import { convertToMusicTrack } from "@/lib/utils/download";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { getPlayAllStartIndex } from "@/hooks/usePlayHelper";
import { useLocalMusicStore } from "@/store/local-music-store";
import { logger } from "@/lib/logger";
import { useNavigate } from "react-router-dom";

function mergeLocalMusicFiles(
  oldFiles: LocalMusicFile[],
  newFiles: LocalMusicFile[]
): LocalMusicFile[] {
  const oldMap = new Map(oldFiles.map((f) => [f.localPath, f]));
  return newFiles.map((newFile) => {
    const oldFile = oldMap.get(newFile.localPath);
    if (!oldFile) return newFile;
    return {
      ...oldFile,
      ...newFile,
      name: newFile.name || oldFile.name,
      artist: newFile.artist || oldFile.artist,
      album: newFile.album || oldFile.album,
      duration: newFile.duration || oldFile.duration,
      fileSize: newFile.fileSize || oldFile.fileSize,
      modifiedTime: newFile.modifiedTime || oldFile.modifiedTime,
    };
  });
}

interface LocalMusicPageProps {
  onBack?: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[], contextId?: string) => void;
  currentTrackId?: string;
  isPlaying: boolean;
}

export function LocalMusicPage({
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: LocalMusicPageProps) {
  /* --- 状态 --- */
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 删除状态（统一为数组，单删/批删复用）
  const [deleteTargets, setDeleteTargets] = useState<MusicTrack[]>([]);
  const [deleteLocalFile, setDeleteLocalFile] = useState(false);
  const singleDeleteTarget =
    deleteTargets.length === 1 ? deleteTargets[0] : null;

  // 扫描与排除目录状态
  const [scanDrawerOpen, setScanDrawerOpen] = useState(false);

  /* --- Store --- */
  const { queue, currentIndex, skipToNext, isShuffle } = useMusicStore(
    useShallow((state) => ({
      queue: state.queue,
      currentIndex: state.currentIndex,
      skipToNext: state.skipToNext,
      isShuffle: state.isShuffle,
    }))
  );
  const { files, setFiles, updateFiles, setScanning } = useLocalMusicStore();
  const navigate = useNavigate();

  /* --- 扫描逻辑 --- */
  const performScan = useCallback(
    async () => {
      setIsLoading(true);
      setError(null);
      setScanning(true, "quick");

      try {
        const result = await LocalMusicPlugin.scanLocalMusic();

        if (result.success) {
          setFiles(result.files);
          return result.files.length;
        }

        throw new Error(result.error || "扫描失败");
      } catch (err: any) {
        const message = err.message || String(err);
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
        setScanning(false);
      }
    },
    [files, setFiles, setScanning]
  );

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || files.length > 0) return;
    initRef.current = true;

    performScan("quick").catch((err) => {
      logger.error("LocalMusicPage", "Initial local music scan failed", err);
    });
  }, [files.length, performScan]);

  const handleScan = (type: "quick" | "full") => {
    if (isLoading) return;
    toast.promise(performScan(type), {
      loading: "正在扫描本地音乐...",
      success: (count) =>
        count === 0 ? "未找到本地音乐" : `找到 ${count} 首本地音乐`,
      error: (err) => err.message,
    });
  };

  /* --- 删除逻辑 --- */
  const removeLocalTrack = useCallback(
    async (track: MusicTrack, shouldDeleteFile: boolean) => {
      if (!track.url_id) throw new Error("缺少文件路径");
      try {
        if (shouldDeleteFile) {
          const result = await LocalMusicPlugin.deleteLocalMusic({
            localPath: track.url_id,
          });
          if (!result.success) throw new Error(result.error || "删除失败");
        }
        updateFiles((prev) => prev.filter((f) => f.localPath !== track.url_id));
        if (queue[currentIndex]?.id === track.id) skipToNext();
      } catch (error) {
        logger.error("LocalMusicPage", "Delete local track failed", error, {
          trackId: track.id,
          localPath: track.url_id,
        });
        throw error;
      }
    },
    [currentIndex, queue, skipToNext, updateFiles]
  );

  const resetDeleteState = () => {
    setDeleteTargets([]);
    setDeleteLocalFile(false);
  };

  const confirmDeleteTracks = async () => {
    if (!deleteTargets.length) return;
    const promise = Promise.all(
      deleteTargets.map((t) => removeLocalTrack(t, deleteLocalFile))
    ).then(resetDeleteState);

    toast.promise(promise, {
      loading: deleteLocalFile ? "正在删除文件..." : "正在移除...",
      success: deleteLocalFile ? "已删除文件" : "已从列表移除",
      error: (err) => err.message,
    });
    await promise;
  };

  /* --- 数据转换与播放 --- */
  const tracks = useMemo(
    () =>
      files
        .map((file, index) => ({ file, index }))
        .sort(
          (a, b) =>
            (b.file.modifiedTime ?? -Infinity) -
              (a.file.modifiedTime ?? -Infinity) || a.index - b.index
        )
        .map(({ file }) => convertToMusicTrack(file)),
    [files]
  );

  const handlePlay = (track: MusicTrack | null, index?: number) => {
    const targetTrack =
      track ||
      (index !== undefined
        ? tracks[index]
        : tracks[getPlayAllStartIndex(tracks.length, isShuffle)]);
    if (targetTrack) onPlay(targetTrack, tracks, "local");
  };

  /* --- 渲染部分 --- */
  const isEmpty = files.length === 0;

  return (
    <PageLayout
      title="本地音乐"
      onBack={onBack}
      action={
        <button
          onClick={() => setScanDrawerOpen(true)}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          <HardDrive className="h-3.5 w-3.5" />
          全盘扫描
        </button>
      }
    >
      {/* 状态视图与内容视图 */}
      {isLoading && isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <RefreshCw className="h-10 w-10 text-primary/80 animate-spin" />
          <p className="text-foreground text-sm font-medium">
            正在扫描本地音乐...
          </p>
        </div>
      ) : error && isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <Music className="h-14 w-14 text-muted-foreground/30 mb-4" />
          <p className="text-sm mb-2">{error}</p>
          <button
            onClick={() => handleScan("quick")}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            重试
          </button>
        </div>
      ) : (
        <MusicPlaylistView
          title="本地音乐"
          tracks={tracks}
          icon={<HardDriveDownload className="h-8 w-8 text-primary/80" />}
          onPlay={handlePlay}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          onRemove={(track) => setDeleteTargets([track])}
          onBatchRemove={setDeleteTargets}
          removeLabel="删除"
          confirmRemove={false}
          action={
            <button
              onClick={() => navigate("/playlist/__offline__")}
              className="flex items-center gap-1.5 px-3 h-8 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <WifiOff size={14} className="shrink-0" />
            </button>
          }
        />
      )}

      {/* 弹窗及抽屉 */}
      <Dialog
        open={deleteTargets.length > 0}
        onOpenChange={(open) => !open && resetDeleteState()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {singleDeleteTarget
                ? `删除《${singleDeleteTarget.name}》`
                : `删除选中的 ${deleteTargets.length} 首歌曲`}
            </DialogTitle>
            <DialogDescription>
              默认从当前列表移除，重新扫描后会再次出现。
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              data-testid="delete-local-file"
              checked={deleteLocalFile}
              onCheckedChange={(checked) =>
                setDeleteLocalFile(checked === true)
              }
            />
            <span className="text-sm">删除本地文件</span>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetDeleteState}>
              取消
            </Button>
            <Button
              variant="destructive"
              data-testid="confirm-local-delete"
              onClick={confirmDeleteTracks}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer open={scanDrawerOpen} onOpenChange={setScanDrawerOpen}>
        <DrawerContent className="outline-none">
          <DrawerHeader className="px-5 pt-6 pb-2">
            <DrawerTitle className="text-lg font-semibold text-center">
              全盘扫描
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-5 py-4 space-y-4">
            <button
              type="button"
              onClick={() => {
                setScanDrawerOpen(false);
                handleScan("quick");
              }}
              disabled={isLoading}
              className="w-full h-10 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <HardDrive className="h-4 w-4" />
              {isLoading ? "扫描中..." : "开始扫描"}
            </button>
          </div>
          <div className="h-6" />
        </DrawerContent>
      </Drawer>
    </PageLayout>
  );
}