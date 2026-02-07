import { LyricLine } from '../types';

const TIME_REGEXP = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

export const parseLRC = (lrcContent: string): LyricLine[] => {
  const lines = lrcContent.split('\n');
  const result: LyricLine[] = [];

  lines.forEach((line, index) => {
    const match = line.match(TIME_REGEXP);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3], 10);
      const text = match[4].trim();

      // Convert to total seconds
      // ms in LRC can be 2 or 3 digits. standard is usually hundredths (2 digits)
      const msDivisor = match[3].length === 3 ? 1000 : 100;
      const totalSeconds = minutes * 60 + seconds + milliseconds / msDivisor;

      result.push({
        id: `line-${index}-${Date.now()}`,
        timestamp: totalSeconds,
        text,
      });
    }
  });

  return result.sort((a, b) => a.timestamp - b.timestamp);
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  const format = (num: number) => (num < 10 ? `0${num}` : `${num}`);
  
  return `[${format(mins)}:${format(secs)}.${format(ms)}]`;
};

export const exportLRC = (lyrics: LyricLine[]): string => {
  return lyrics
    .map((line) => `${formatTime(line.timestamp)} ${line.text}`)
    .join('\n');
};

export const formatDisplayTime = (seconds: number): string => {
   const mins = Math.floor(seconds / 60);
   const secs = Math.floor(seconds % 60);
   const ms = Math.floor((seconds % 1) * 10); // Display tenths
   return `${mins}:${secs < 10 ? '0' : ''}${secs}.${ms}`;
};
