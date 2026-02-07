import React, { useRef, useEffect } from 'react';
import { LyricLine, AppMode } from '../types';
import { formatDisplayTime } from '../utils/lrcParser';
import { Trash2, Play, Sparkles } from 'lucide-react';

interface LyricEditorProps {
  lyrics: LyricLine[];
  currentTime: number;
  mode: AppMode;
  onUpdateLyrics: (newLyrics: LyricLine[]) => void;
  onJumpToTime: (time: number) => void;
  activeLineId: string | null;
  onRequestSuggestion: (index: number) => void;
  isSuggestionLoading: boolean;
}

const LyricEditor: React.FC<LyricEditorProps> = ({
  lyrics,
  currentTime,
  mode,
  onUpdateLyrics,
  onJumpToTime,
  activeLineId,
  onRequestSuggestion,
  isSuggestionLoading,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeItemRef.current && listRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineId]);

  const handleTextChange = (id: string, newText: string) => {
    const updated = lyrics.map((l) => (l.id === id ? { ...l, text: newText } : l));
    onUpdateLyrics(updated);
  };

  const handleDelete = (id: string) => {
    const updated = lyrics.filter((l) => l.id !== id);
    onUpdateLyrics(updated);
  };

  const handleTimeChange = (id: string, newTimeStr: string) => {
    // Basic validation could go here
    const parts = newTimeStr.split(':');
    if (parts.length === 2) {
      const min = parseFloat(parts[0]);
      const sec = parseFloat(parts[1]);
      if (!isNaN(min) && !isNaN(sec)) {
        const total = min * 60 + sec;
        const updated = lyrics.map((l) => (l.id === id ? { ...l, timestamp: total } : l));
        // Sort needed if time changes significantly, but let's keep it simple for now
        // Usually we re-sort on save or explicit action
        onUpdateLyrics(updated.sort((a, b) => a.timestamp - b.timestamp));
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Insert new line after current
      const newLine: LyricLine = {
        id: `line-${Date.now()}`,
        timestamp: lyrics[index].timestamp + 2, // Arbitrary +2s offset
        text: '',
      };
      const newLyrics = [...lyrics];
      newLyrics.splice(index + 1, 0, newLine);
      onUpdateLyrics(newLyrics);
      
      // Focus logic would ideally go here (managing refs for inputs is complex in a long list)
    }
    if (e.key === 'Backspace' && lyrics[index].text === '' && lyrics.length > 1) {
      e.preventDefault();
      handleDelete(lyrics[index].id);
    }
  };

  return (
    <div 
      ref={listRef} 
      className="flex-1 overflow-y-auto bg-gray-900 px-4 py-8 space-y-2 scroll-smooth"
    >
      {lyrics.length === 0 && (
        <div className="text-center text-gray-500 mt-20">
          <p className="text-xl">No lyrics yet.</p>
          <p className="text-sm">Click "Add Line" or Paste text to start.</p>
        </div>
      )}

      {lyrics.map((line, index) => {
        const isActive = line.id === activeLineId;
        
        return (
          <div
            key={line.id}
            ref={isActive ? activeItemRef : null}
            className={`group flex items-center gap-4 p-3 rounded-lg transition-all duration-200 border border-transparent
              ${isActive 
                ? 'bg-gray-800 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)] scale-[1.01]' 
                : 'hover:bg-gray-800/50'
              }
            `}
          >
            {/* Timestamp Control */}
            <div className="flex flex-col items-center min-w-[80px]">
               <input
                 type="text"
                 className={`bg-transparent text-sm font-mono text-center w-20 focus:outline-none focus:text-indigo-400
                   ${isActive ? 'text-indigo-400 font-bold' : 'text-gray-500'}
                 `}
                 value={formatDisplayTime(line.timestamp)}
                 onChange={(e) => handleTimeChange(line.id, e.target.value)}
                 readOnly={mode === AppMode.TAP_SYNC}
               />
               <button
                 onClick={() => onJumpToTime(line.timestamp)}
                 className="opacity-0 group-hover:opacity-100 p-1 hover:text-indigo-400 transition"
                 title="Jump to time"
               >
                 <Play size={10} fill="currentColor"/>
               </button>
            </div>

            {/* Lyric Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={line.text}
                onChange={(e) => handleTextChange(line.id, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                placeholder="Type lyric line..."
                disabled={mode === AppMode.TAP_SYNC}
                className={`w-full bg-transparent text-lg focus:outline-none placeholder-gray-600
                  ${isActive ? 'text-white font-medium' : 'text-gray-300'}
                  ${mode === AppMode.TAP_SYNC ? 'cursor-not-allowed opacity-80' : ''}
                `}
              />
            </div>

            {/* Actions */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
               {/* Gemini Suggestion Trigger */}
              <button
                onClick={() => onRequestSuggestion(index)}
                disabled={isSuggestionLoading}
                className="p-2 text-gray-500 hover:text-purple-400 hover:bg-gray-700 rounded-md transition"
                title="AI Suggest Next Line"
              >
                <Sparkles size={16} className={isSuggestionLoading ? "animate-pulse" : ""} />
              </button>

              <button
                onClick={() => handleDelete(line.id)}
                className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded-md transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        );
      })}
      
      {/* Spacer for bottom scrolling */}
      <div className="h-40" />
    </div>
  );
};

export default LyricEditor;
