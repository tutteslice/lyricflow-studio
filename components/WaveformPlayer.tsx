import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Play, Pause, RotateCcw, Volume2, Repeat, Trash2 } from 'lucide-react';

interface WaveformPlayerProps {
  audioFile: File | null;
  onTimeUpdate: (time: number) => void;
  onReady?: (duration: number) => void;
}

export interface WaveformPlayerRef {
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
  isPlaying: () => boolean;
  getCurrentTime: () => number;
}

const WaveformPlayer = forwardRef<WaveformPlayerRef, WaveformPlayerProps>(
  ({ audioFile, onTimeUpdate, onReady }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const regionsRef = useRef<RegionsPlugin | null>(null);
    const activeRegionRef = useRef<any>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [hasRegion, setHasRegion] = useState(false);
    const [isLooping, setIsLooping] = useState(false);

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (wavesurferRef.current) {
          wavesurferRef.current.setTime(time);
        }
      },
      play: () => wavesurferRef.current?.play(),
      pause: () => wavesurferRef.current?.pause(),
      isPlaying: () => isPlaying,
      getCurrentTime: () => wavesurferRef.current?.getCurrentTime() || 0,
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: '#4b5563',
        progressColor: '#818cf8', // Indigo-400
        cursorColor: '#c7d2fe',
        barWidth: 2,
        barGap: 1,
        height: 128,
        normalize: true,
        backend: 'WebAudio',
      });

      const wsRegions = RegionsPlugin.create();
      ws.registerPlugin(wsRegions);
      
      regionsRef.current = wsRegions;
      wavesurferRef.current = ws;

      // Event Listeners
      ws.on('ready', () => {
        setVolume(ws.getVolume());
        if (onReady) onReady(ws.getDuration());
      });

      ws.on('play', () => setIsPlaying(true));
      ws.on('pause', () => setIsPlaying(false));
      ws.on('timeupdate', (currentTime) => onTimeUpdate(currentTime));

      // Region Logic
      wsRegions.on('region-created', (region) => {
        // Enforce single region: remove others
        const regions = wsRegions.getRegions();
        regions.forEach(r => {
           if (r !== region) r.remove();
        });
        
        activeRegionRef.current = region;
        setHasRegion(true);
        setIsLooping(false); // Default to off
        
        // Default styling
        region.setOptions({ 
          loop: false, 
          color: 'rgba(129, 140, 248, 0.2)',
          drag: true,
          resize: true
        });
      });

      wsRegions.on('region-updated', (region) => {
        activeRegionRef.current = region;
      });

      wsRegions.on('region-out', (region) => {
        if (region.loop) {
          region.play();
        }
      });

      wsRegions.on('region-clicked', (region, e) => {
        e.stopPropagation();
        region.play();
        setIsPlaying(true);
      });
      
      wsRegions.on('region-removed', () => {
         // Only reset if we removed the active one and no others exist
         if (wsRegions.getRegions().length === 0) {
            activeRegionRef.current = null;
            setHasRegion(false);
            setIsLooping(false);
         }
      });

      // Enable drag selection to create regions
      wsRegions.enableDragSelection({
        color: 'rgba(129, 140, 248, 0.2)',
      });

      return () => {
        ws.destroy();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (audioFile && wavesurferRef.current) {
        // Reset regions when loading new file
        regionsRef.current?.clearRegions();
        setHasRegion(false);
        setIsLooping(false);

        const url = URL.createObjectURL(audioFile);
        wavesurferRef.current.load(url);
        return () => URL.revokeObjectURL(url);
      }
    }, [audioFile]);

    const handlePlayPause = () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.playPause();
      }
    };

    const handleRestart = () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.seekTo(0);
      }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVol = parseFloat(e.target.value);
      setVolume(newVol);
      wavesurferRef.current?.setVolume(newVol);
    };

    const toggleLoop = () => {
       const region = activeRegionRef.current;
       if (region) {
           const nextState = !region.loop;
           region.setOptions({ 
             loop: nextState,
             color: nextState ? 'rgba(99, 102, 241, 0.4)' : 'rgba(129, 140, 248, 0.2)'
           });
           setIsLooping(nextState);
       }
    };

    const clearRegion = () => {
        activeRegionRef.current?.remove();
    };

    return (
      <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700">
        <div ref={containerRef} className="w-full mb-4" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleRestart}
              className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition"
              title="Restart"
            >
              <RotateCcw size={20} />
            </button>
            <button
              onClick={handlePlayPause}
              className={`p-3 rounded-full transition shadow-md ${
                isPlaying 
                  ? 'bg-indigo-500 hover:bg-indigo-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
            
            <div className="h-8 w-px bg-gray-700 mx-2" />

            {/* Loop Controls */}
            <div className="flex items-center gap-2">
                 <button 
                    onClick={toggleLoop}
                    disabled={!hasRegion}
                    className={`p-2 rounded-full transition flex items-center gap-1 ${
                        isLooping 
                        ? 'bg-indigo-500 text-white hover:bg-indigo-600' 
                        : hasRegion ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-600 cursor-not-allowed'
                    }`}
                    title={hasRegion ? "Toggle Loop" : "Drag on waveform to create loop"}
                 >
                    <Repeat size={18} />
                 </button>
                 
                 {hasRegion && (
                    <button
                        onClick={clearRegion}
                        className="p-2 rounded-full text-gray-400 hover:text-red-400 hover:bg-gray-700 transition"
                        title="Clear Selection"
                    >
                        <Trash2 size={18} />
                    </button>
                 )}
             </div>

            <div className="text-sm font-mono text-gray-400 ml-2 hidden sm:block">
             <span className="text-xs text-gray-500">
               {hasRegion ? (isLooping ? "Loop Active" : "Region Selected") : "Drag to loop"}
             </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Volume2 size={16} className="text-gray-400" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-24 accent-indigo-500 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
    );
  }
);

WaveformPlayer.displayName = 'WaveformPlayer';

export default WaveformPlayer;