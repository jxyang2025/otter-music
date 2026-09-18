import { useState, memo, useCallback } from "react";
import { MusicCover } from "@/components/MusicCover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Search, Repeat, Repeat1, Shuffle } from "lucide-react";
import type { MusicTrack } from "@/types/music";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";

export interface CommonDetailHeaderProps {
  title: string;
  coverUrl: string;
  description?: string;
  creator?: string;
  publishTime?: number;
  countDesc?: string;
  fallbackIcon?: React.ReactNode;
  onPlayTrack?: (track: MusicTrack) => void;
  isShuffle?: boolean;
  tracks?: MusicTrack[];
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  /** 是否显示播放模式按钮，默认 true */
  showModeButton?: boolean;
}

export const CommonDetailHeader = memo(function CommonDetailHeader({
  title,
  coverUrl,
  description,
  creator,
  publishTime,
  countDesc,
  fallbackIcon,
  onPlayTrack,
  isShuffle,
  tracks,
  searchQuery = "",
  onSearchChange,
  showModeButton = true,
}: CommonDetailHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { isRepeat, toggleRepeat, toggleShuffle } = useMusicStore(
    useShallow((s) => ({
      isRepeat: s.isRepeat,
      toggleRepeat: s.toggleRepeat,
      toggleShuffle: s.toggleShuffle,
    }))
  );

  const hasDesc = !!description;
  const hasTracks = !!(onPlayTrack && tracks && tracks.length > 0);

  const handleModeCycle = () => {
    // 循环切换：列表循环 → 单曲循环 → 随机播放 → 列表循环
    if (!isShuffle && !isRepeat) {
      toggleRepeat();
    } else if (isRepeat) {
      toggleRepeat();
      toggleShuffle();
    } else {
      toggleShuffle();
    }
  };

  const handlePlay = useCallback(() => {
    if (!hasTracks) return;
    const index = isShuffle ? Math.floor(Math.random() * tracks!.length) : 0;
    onPlayTrack!(tracks![index]);
  }, [isShuffle, tracks, onPlayTrack, hasTracks]);

  // 根据是否有描述，动态映射样式配置，避免在 JSX 中写死大量三元运算符
  const styles = {
    bar: hasDesc
      ? "mt-3 pb-5 grid grid-cols-3 gap-2 w-full"
      : "mt-auto flex items-center gap-2",
    btn: hasDesc
      ? "rounded-full px-3 h-9 col-span-1 min-w-0"
      : "rounded-full px-3 h-8 md:h-9 gap-1.5 min-w-0 shrink",
    searchWrapper: hasDesc ? "relative col-span-2" : "relative flex-1 min-w-0",
    searchIcon: hasDesc
      ? "absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60"
      : "absolute left-2 top-2.5 h-3 w-3 text-muted-foreground md:h-4 md:w-4 md:top-2",
    input: hasDesc
      ? "pl-9 h-9 rounded-md text-xs bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/50 w-full"
      : "pl-8 h-8 text-xs w-full md:h-9 md:text-sm",
  };

  const playSearchBar = hasTracks && (
    <div className={styles.bar}>
      <Button size="sm" className={styles.btn} onClick={handlePlay}>
        <Play className="h-3 w-3 fill-current" />
        {hasDesc && <span>播放全部</span>}
      </Button>

      {showModeButton && (
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            styles.btn,
            "text-muted-foreground hover:text-foreground",
            (isShuffle || isRepeat) && "text-primary"
          )}
          onClick={handleModeCycle}
          title={
            isRepeat
              ? "单曲循环，点击切换为随机播放"
              : isShuffle
                ? "随机播放，点击恢复列表循环"
                : "列表循环，点击切换为单曲循环"
          }
        >
          {isRepeat ? (
            <Repeat1 className="h-3 w-3" />
          ) : isShuffle ? (
            <Shuffle className="h-3 w-3" />
          ) : (
            <Repeat className="h-3 w-3" />
          )}
          {hasDesc && (
            <span className="ml-1 text-[11px]">
              {isRepeat ? "单曲" : isShuffle ? "随机" : "列表"}
            </span>
          )}
        </Button>
      )}

      {onSearchChange && (
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} />
          <Input
            placeholder="搜索..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={styles.input}
          />
        </div>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "w-full shrink-0 p-5 flex items-start",
        hasDesc ? "flex-col pb-0" : "flex-row items-stretch"
      )}
    >
      {/* items-stretch：右侧列拉伸至封面高度，无描述时播放栏的 mt-auto 才能贴底 */}
      <div className="flex gap-4 items-stretch w-full">
        <MusicCover
          src={coverUrl}
          alt={title}
          previewable
          className="shrink-0 size-24 rounded-xl shadow-md ring-1 ring-white/10 object-cover"
          fallbackIcon={fallbackIcon}
        />
        <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
          <h2
            className="text-base font-bold text-foreground/90 line-clamp-2"
            title={title}
          >
            {title}
          </h2>

          <div className="flex items-center flex-wrap gap-x-3 text-xs text-muted-foreground/80">
            {creator && (
              <span className="truncate max-w-[140px]">{creator}</span>
            )}
            {countDesc && <span>{countDesc}</span>}
            {publishTime && <span>{format(publishTime, "yyyy-MM-dd")}</span>}
          </div>

          {hasDesc && (
            <p
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                "mt-1 text-[11px] leading-relaxed transition-colors cursor-pointer text-muted-foreground/60 hover:text-muted-foreground/90",
                isExpanded ? "whitespace-pre-line" : "line-clamp-2"
              )}
            >
              {description}
            </p>
          )}

          {/* 当没有描述时，播放栏嵌套在右侧文本下方 */}
          {!hasDesc && playSearchBar}
        </div>
      </div>

      {/* 当有描述时，播放栏渲染在底部（独占一行） */}
      {hasDesc && playSearchBar}
    </div>
  );
});
