import type { StateCreator } from "zustand";
import type { MusicState } from "./types";
import type { MusicTrack, Playlist } from "@/types/music";
import { v4 as uuidv4 } from "uuid";
import { toastUtils } from "@/lib/utils/toast";
import { withMeta, updateList, replaceActiveWithTombstones } from "./shared";

export interface PlaylistSlice {
  playlists: Playlist[];
  createPlaylist: (name: string, coverUrl?: string) => string;
  deletePlaylist: (id: string) => void;
  restorePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  updatePlaylist: (id: string, data: Partial<Playlist>) => void;
  addToPlaylist: (playlistId: string, track: MusicTrack) => void;
  addBatchToPlaylist: (playlistId: string, tracks: MusicTrack[]) => void;
  removeBatchFromPlaylist: (playlistId: string, trackIds: string[]) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  setPlaylistTracks: (playlistId: string, tracks: MusicTrack[]) => void;
  replaceActivePlaylistTracks: (
    playlistId: string,
    tracks: MusicTrack[]
  ) => void;
  reorderPlaylistTracks: (playlistId: string, tracks: MusicTrack[]) => void;
  updateTrackInPlaylists: (
    trackId: string,
    newTrack: MusicTrack,
    playlistId?: string
  ) => number;
}

export const createPlaylistSlice: StateCreator<
  MusicState,
  [],
  [],
  PlaylistSlice
> = (set) => ({
  playlists: [],
  createPlaylist: (name, coverUrl) => {
    const id = uuidv4();
    set((s) => ({
      playlists: [
        {
          id,
          name,
          coverUrl,
          tracks: [],
          createdAt: Date.now(),
          update_time: Date.now(),
          is_deleted: false,
        },
        ...s.playlists,
      ],
    }));
    return id;
  },
  deletePlaylist: (id) =>
    set((s) => ({
      playlists: updateList(s.playlists, id, { is_deleted: true }),
    })),
  restorePlaylist: (id) =>
    set((s) => ({
      playlists: updateList(s.playlists, id, { is_deleted: false }),
    })),
  renamePlaylist: (id, name) =>
    set((s) => ({
      playlists: updateList(s.playlists, id, { name, is_deleted: false }),
    })),
  updatePlaylist: (id, data) =>
    set((s) => ({
      playlists: updateList(s.playlists, id, {
        ...data,
        is_deleted: false,
      }),
    })),
  addToPlaylist: (pid, track) =>
    set((s) => {
      return {
        playlists: updateList(s.playlists, pid, (p) => {
          const nextTrack = { ...withMeta(track), is_deleted: false };
          const exists = p.tracks.find((t) => t.id === track.id);
          return {
            tracks: exists
              ? updateList(p.tracks, track.id, nextTrack)
              : [nextTrack, ...p.tracks],
            is_deleted: false,
          };
        }),
      };
    }),
  removeFromPlaylist: (pid, tid) =>
    set((s) => ({
      playlists: updateList(s.playlists, pid, (p) => ({
        tracks: updateList(p.tracks, tid, { is_deleted: true }),
      })),
    })),
  addBatchToPlaylist: (pid, tracks) =>
    set((s) => {
      if (!tracks.length) return s;
      return {
        playlists: updateList(s.playlists, pid, (p) => {
          const existingIds = new Set(p.tracks.map((t) => t.id));
          const toAdd = tracks
            .filter((t) => !existingIds.has(t.id))
            .map((t) => ({ ...withMeta(t), is_deleted: false }));
          const updatedTracks = p.tracks.map((t) => {
            const incoming = tracks.find((e) => e.id === t.id);
            return incoming ? { ...withMeta(incoming), is_deleted: false } : t;
          });
          return {
            tracks: [...toAdd, ...updatedTracks],
            is_deleted: false,
          };
        }),
      };
    }),
  removeBatchFromPlaylist: (pid, ids) =>
    set((s) => {
      const idSet = new Set(ids);
      return {
        playlists: updateList(s.playlists, pid, (p) => ({
          tracks: p.tracks.map((t) =>
            idSet.has(t.id)
              ? { ...t, is_deleted: true, update_time: Date.now() }
              : t
          ),
        })),
      };
    }),
  setPlaylistTracks: (pid, tracks) =>
    set((s) => ({
      playlists: updateList(s.playlists, pid, {
        tracks: tracks.map(withMeta),
        is_deleted: false,
      }),
    })),
  replaceActivePlaylistTracks: (pid, tracks) =>
    set((s) => ({
      playlists: updateList(s.playlists, pid, (p) => ({
        tracks: replaceActiveWithTombstones(p.tracks, tracks),
        is_deleted: false,
      })),
    })),
  reorderPlaylistTracks: (pid, tracks) =>
    set((s) => ({
      playlists: updateList(s.playlists, pid, (p) => ({
        tracks: [...tracks, ...p.tracks.filter((t) => t.is_deleted)],
        is_deleted: false,
      })),
    })),
  updateTrackInPlaylists: (tid, newTrack, pid) => {
    let count = 0;
    set((s) => ({
      playlists: s.playlists.map((p) => {
        // 如果指定了 playlistId，只更新该歌单
        if (pid && p.id !== pid) return p;
        if (!p.tracks.some((t) => t.id === tid)) return p;
        count++;
        return {
          ...p,
          update_time: Date.now(),
          tracks: updateList(p.tracks, tid, {
            ...withMeta(newTrack),
            is_deleted: false,
          }),
        };
      }),
    }));
    return count;
  },
});
