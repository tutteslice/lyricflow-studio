export interface LyricLine {
  id: string;
  timestamp: number; // in seconds
  text: string;
}

export interface SongMetadata {
  title: string;
  artist: string;
  duration: number;
}

export enum AppMode {
  EDIT = 'EDIT',
  TAP_SYNC = 'TAP_SYNC',
}
