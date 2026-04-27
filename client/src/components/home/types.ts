import type { Track } from "@/hooks/useAudioQueue";
import type { Playlist } from "@/hooks/usePlaylists";
import type { StreamingParams } from "@/hooks/useIntegratedAudioProcessor";

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export type HomeTabType =
  | "player"
  | "library"
  | "search"
  | "eq"
  | "dsp"
  | "settings";

export type HomeLibraryView =
  | "main"
  | "songs"
  | "artists"
  | "albums"
  | "hires"
  | "playlists"
  | "playlist-detail";

export type HomeSongSort = "default" | "name" | "artist";

export interface HomeTrackActions {
  onPlayNow: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onPlayNext: (track: Track) => void;
  onAddToPlaylist: (track: Track) => void;
}

export interface HomePlaybackCollectionActions {
  onPlayInOrder: (tracks: Track[]) => void;
  onShufflePlay: (tracks: Track[]) => void;
}

export interface HomePlaylistSelection {
  selectedPlaylist: Playlist | null;
  setSelectedPlaylist: (playlist: Playlist | null) => void;
}

export interface DspParamConfig {
  key: keyof StreamingParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}
