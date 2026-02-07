import React, { useState, useRef, useEffect, useCallback } from 'react';
import WaveformPlayer, { WaveformPlayerRef } from './components/WaveformPlayer';
import LyricEditor from './components/LyricEditor';
import { LyricLine, AppMode } from './types';
import { parseLRC, exportLRC, formatDisplayTime } from './utils/lrcParser';
import { generateLyricSuggestion } from './services/geminiService';
import { Upload, Download, Mic2, FileText, Music, Sparkles, Plus, Keyboard } from 'lucide-react';

const App: React.FC = () => {
  const playerRef = useRef<WaveformPlayerRef>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>(AppMode.EDIT);
  const [syncIndex, setSyncIndex] = useState(0); // Tracks which line is next to sync
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const handleLrcUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const parsed = parseLRC(ev.target.result as string);
          setLyrics(parsed);
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  };

  const handleExportLrc = () => {
    const content = exportLRC(lyrics);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lyrics.lrc';
    a.click();
    URL.revokeObjectURL(url);
    showNotification('LRC exported successfully!');
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);

    // Sync Logic: Find current active line
    // We reverse to find the *last* line that has a timestamp <= currentTime
    const active = [...lyrics]
      .reverse()
      .find((line) => line.timestamp <= time + 0.2); // 0.2s buffer/tolerance

    if (active && active.id !== activeLineId) {
      setActiveLineId(active.id);
    }
  }, [lyrics, activeLineId]);

  const handleAddLine = () => {
    const newLine: LyricLine = {
      id: `line-${Date.now()}`,
      timestamp: currentTime,
      text: '',
    };
    // Insert correctly sorted by time? Or just append?
    // For manual add, appending or inserting at current time index is best.
    // Simplifying to append for now, sort later.
    const newLyrics = [...lyrics, newLine].sort((a, b) => a.timestamp - b.timestamp);
    setLyrics(newLyrics);
  };

  const handleTapSync = useCallback(() => {
    if (mode !== AppMode.TAP_SYNC) return;
    
    // Assign current timestamp to the current syncIndex
    if (syncIndex < lyrics.length) {
      const newLyrics = [...lyrics];
      newLyrics[syncIndex] = {
        ...newLyrics[syncIndex],
        timestamp: playerRef.current?.getCurrentTime() || 0
      };
      setLyrics(newLyrics);
      setActiveLineId(newLyrics[syncIndex].id); // Highlight immediately
      setSyncIndex(prev => prev + 1);
    } else {
      showNotification("End of lines reached");
    }
  }, [mode, syncIndex, lyrics]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Spacebar for Tap Sync Mode
      if (mode === AppMode.TAP_SYNC && e.code === 'Space') {
        e.preventDefault(); // Prevent scroll/play-pause default if focused
        handleTapSync();
      } 
      // Spacebar for Play/Pause in Edit Mode (if not focused on input)
      else if (mode === AppMode.EDIT && e.code === 'Space') {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          if (playerRef.current?.isPlaying()) {
            playerRef.current.pause();
          } else {
            playerRef.current?.play();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, handleTapSync]);

  const handleAiSuggestion = async (index: number) => {
    setIsAiLoading(true);
    // Get context: prev 3 lines
    const contextLines = lyrics
      .slice(Math.max(0, index - 3), index + 1)
      .map(l => l.text);
    
    const suggestion = await generateLyricSuggestion(contextLines);
    
    if (suggestion) {
       // Insert new line with suggestion
       const newLine: LyricLine = {
         id: `ai-${Date.now()}`,
         timestamp: lyrics[index].timestamp + 3,
         text: suggestion
       };
       const newLyrics = [...lyrics];
       newLyrics.splice(index + 1, 0, newLine);
       setLyrics(newLyrics);
    }
    setIsAiLoading(false);
  };

  const toggleMode = () => {
    if (mode === AppMode.EDIT) {
      setMode(AppMode.TAP_SYNC);
      setSyncIndex(0);
      showNotification("Entered Tap Sync Mode. Press SPACE to timestamp lines.");
    } else {
      setMode(AppMode.EDIT);
      showNotification("Back to Edit Mode.");
    }
  };

  const handlePasteLyrics = () => {
    const text = prompt("Paste your lyrics here:");
    if (text) {
      const lines = text.split('\n').filter(t => t.trim() !== '');
      const newLyrics = lines.map((line, i) => ({
        id: `imported-${i}-${Date.now()}`,
        timestamp: 0, // Default to 0, ready for sync
        text: line.trim()
      }));
      setLyrics(newLyrics);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Header */}
      <header className="h-16 border-b border-gray-800 bg-gray-900/50 backdrop-blur px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Mic2 size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            LyricFlow Studio
          </h1>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-4">
          {audioFile && (
            <button
              onClick={toggleMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition border ${
                mode === AppMode.TAP_SYNC
                  ? 'bg-red-500/10 border-red-500 text-red-500 animate-pulse'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300'
              }`}
            >
              <Keyboard size={16} />
              {mode === AppMode.TAP_SYNC ? 'TAP SYNC ACTIVE' : 'Tap to Sync'}
            </button>
          )}

          <div className="h-6 w-px bg-gray-700 mx-2" />

          <button onClick={handleExportLrc} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
            <Download size={16} /> Export LRC
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top: Waveform */}
        <div className="p-6 pb-2 shrink-0 z-10">
           {!audioFile ? (
             <div className="border-2 border-dashed border-gray-700 rounded-2xl h-32 flex flex-col items-center justify-center text-gray-500 hover:border-indigo-500 hover:bg-gray-800/30 transition cursor-pointer relative">
               <input type="file" accept="audio/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
               <Music size={32} className="mb-2" />
               <p className="font-medium">Drop audio file or click to upload</p>
               <p className="text-xs mt-1">Supports MP3, WAV</p>
             </div>
           ) : (
             <WaveformPlayer 
                ref={playerRef} 
                audioFile={audioFile} 
                onTimeUpdate={handleTimeUpdate} 
             />
           )}
        </div>

        {/* Middle: Lyrics */}
        <div className="flex-1 flex flex-col relative min-h-0">
          {/* Toolbar */}
          <div className="px-6 py-2 flex items-center justify-between border-b border-gray-800/50">
             <div className="text-sm text-gray-500 font-mono">
               {activeLineId ? 'Current Line Active' : 'Waiting for playback...'}
             </div>
             <div className="flex gap-2">
                <label className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer text-xs text-gray-300 transition">
                  <Upload size={14} /> Import Text/LRC
                  <input type="file" accept=".lrc,.txt" onChange={handleLrcUpload} className="hidden" />
                </label>
                <button onClick={handlePasteLyrics} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition">
                  <FileText size={14} /> Paste Text
                </button>
             </div>
          </div>

          <LyricEditor 
            lyrics={lyrics}
            currentTime={currentTime}
            activeLineId={activeLineId}
            mode={mode}
            onUpdateLyrics={setLyrics}
            onJumpToTime={(t) => playerRef.current?.seekTo(t)}
            onRequestSuggestion={handleAiSuggestion}
            isSuggestionLoading={isAiLoading}
          />
          
          {/* Add Line FAB */}
          {mode === AppMode.EDIT && (
            <button
              onClick={handleAddLine}
              className="absolute bottom-8 right-8 p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-900/50 transition transform hover:scale-105"
              title="Add Line"
            >
              <Plus size={24} />
            </button>
          )}

           {/* Sync Overlay */}
           {mode === AppMode.TAP_SYNC && (
             <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent pointer-events-none flex flex-col items-center justify-end pb-8">
                <div className="bg-red-500/20 border border-red-500/50 backdrop-blur-md px-6 py-3 rounded-xl flex items-center gap-3 animate-pulse">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="font-bold text-red-200">PRESS SPACE TO SYNC NEXT LINE</span>
                </div>
                {lyrics[syncIndex] && (
                  <p className="mt-2 text-gray-400 text-sm">Next: "{lyrics[syncIndex].text.substring(0, 30)}..."</p>
                )}
             </div>
           )}
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-xl border border-gray-700 animate-fade-in-up z-50">
          {notification}
        </div>
      )}
    </div>
  );
};

export default App;
