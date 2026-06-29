import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Sparkles, Music, CloudRain, BookOpen, Compass, X } from 'lucide-react';
import { ambientAudio, SoundscapePreset } from '../lib/ambientAudio';

interface AmbientPlayerProps {
  lastSentiment?: string; // Optional: last detected chat sentiment for auto-mapping
}

export default function AmbientPlayer({ lastSentiment }: AmbientPlayerProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [preset, setPreset] = useState<SoundscapePreset>(ambientAudio.getPreset());
  const [volume, setVolume] = useState<number>(ambientAudio.getVolume());
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isAutoSync, setIsAutoSync] = useState<boolean>(true);
  const [savedVolume, setSavedVolume] = useState<number>(volume);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state on mount
  useEffect(() => {
    setPreset(ambientAudio.getPreset());
    setVolume(ambientAudio.getVolume());
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Keep open if playing or active to allow easy adjustments, or close for tidiness
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Map incoming sentiments to ambient presets if AutoSync is active
  useEffect(() => {
    if (!isAutoSync || !lastSentiment || preset === 'off') return;

    let targetPreset: SoundscapePreset = 'cosmic';
    const s = lastSentiment.toLowerCase();

    if (s.includes('grief') || s.includes('sad')) {
      targetPreset = 'rain'; // Rainy Afternoon for gentle, reflective tears
    } else if (s.includes('nostalgia') || s.includes('remember')) {
      targetPreset = 'library'; // Warm Library with vinyl crackles
    } else if (s.includes('anxiety') || s.includes('stress')) {
      targetPreset = 'cosmic'; // Cosmic Serenity for deep calming sweeps
    } else if (s.includes('joy') || s.includes('gratitude') || s.includes('peace')) {
      targetPreset = 'ocean'; // Ocean Waves for bright, steady rhythms
    } else {
      targetPreset = 'library';
    }

    if (targetPreset !== preset) {
      handlePresetChange(targetPreset);
    }
  }, [lastSentiment, isAutoSync]);

  const handlePresetChange = (newPreset: SoundscapePreset) => {
    setPreset(newPreset);
    if (newPreset === 'off') {
      ambientAudio.stop();
    } else {
      ambientAudio.start(newPreset);
      if (isMuted) {
        setIsMuted(false);
        ambientAudio.setVolume(savedVolume > 0 ? savedVolume : 0.35);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setSavedVolume(val);
    if (val > 0) {
      setIsMuted(false);
    }
    ambientAudio.setVolume(val);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      const targetVol = savedVolume > 0 ? savedVolume : 0.35;
      setVolume(targetVol);
      ambientAudio.setVolume(targetVol);
    } else {
      setSavedVolume(volume);
      setIsMuted(true);
      setVolume(0);
      ambientAudio.setVolume(0);
    }
  };

  const presetLabels: Record<Exclude<SoundscapePreset, 'off'>, { label: string; icon: any; color: string; desc: string; glow: string }> = {
    rain: { label: 'Rainy Afternoon', icon: CloudRain, color: 'text-sky-400 border-sky-500/20 bg-sky-950/20', glow: 'shadow-[0_0_15px_rgba(56,189,248,0.2)]', desc: 'White-noise rain and raindrop drips' },
    library: { label: 'Warm Library', icon: BookOpen, color: 'text-amber-400 border-amber-500/20 bg-amber-950/20', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]', desc: 'Warm crackling hearth and soft vintage vinyl' },
    ocean: { label: 'Ocean Waves', icon: Compass, color: 'text-emerald-400 border-emerald-500/20 bg-emerald-950/20', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]', desc: 'LFO-modulated deep rhythmic beach wash' },
    cosmic: { label: 'Cosmic Serenity', icon: Music, color: 'text-purple-400 border-purple-500/20 bg-purple-950/20', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]', desc: 'Serene sweeping chord synthesizers' }
  };

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Collapsed Pulse Button */}
      {!isOpen && (
        <button
          type="button"
          id="ambient-player-trigger"
          onClick={() => setIsOpen(true)}
          className={`w-14 h-14 rounded-full bg-[#0b0c10]/95 border border-white/10 flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 hover:border-indigo-500/30 ${
            preset !== 'off' 
              ? 'shadow-[0_0_20px_rgba(99,102,241,0.35)] animate-[pulse_3s_infinite]' 
              : 'shadow-xl'
          }`}
          title="Open Background Soundscape Player"
        >
          {preset !== 'off' ? (
            <div className="relative flex items-center justify-center">
              {/* Pulsing rings */}
              <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400/20 opacity-75 animate-ping"></span>
              {preset === 'rain' && <CloudRain className="w-5 h-5 text-sky-400 relative z-10" />}
              {preset === 'library' && <BookOpen className="w-5 h-5 text-amber-400 relative z-10" />}
              {preset === 'ocean' && <Compass className="w-5 h-5 text-emerald-400 relative z-10" />}
              {preset === 'cosmic' && <Music className="w-5 h-5 text-purple-400 relative z-10" />}
            </div>
          ) : (
            <Volume2 className="w-5 h-5 text-slate-400 hover:text-indigo-400 transition-colors" />
          )}
        </button>
      )}

      {/* Expanded Interface Panel */}
      {isOpen && (
        <div 
          className={`bg-[#0b0c10]/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl w-80 space-y-4 transition-all duration-300 ${
            preset !== 'off' ? presetLabels[preset]?.glow : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Volume2 className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-semibold tracking-wider text-white uppercase">Ambient Soundscapes</h4>
                <p className="text-[9px] text-slate-400 font-mono tracking-wide">
                  {preset === 'off' ? 'Engine Silent' : `${presetLabels[preset]?.label} active`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* AutoSync Switch */}
              <button
                type="button"
                onClick={() => setIsAutoSync(!isAutoSync)}
                title="Toggle Emotional Sync Mode"
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider transition-all border ${
                  isAutoSync
                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    : 'bg-white/5 text-slate-400 border-white/5 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-2 h-2" />
                {isAutoSync ? 'Sync' : 'Manual'}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                title="Collapse Player"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Preset Grid */}
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(presetLabels).map(([key, data]) => {
              const Icon = data.icon;
              const isSelected = preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePresetChange(key as SoundscapePreset)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                    isSelected
                      ? `${data.color} ring-1 ring-indigo-500/30`
                      : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  <span className="text-[10px] font-medium tracking-wide leading-tight">{data.label}</span>
                </button>
              );
            })}
          </div>

          {/* Volume Dashboard */}
          <div className="flex items-center gap-3 pt-1 border-t border-white/5">
            <button
              type="button"
              onClick={toggleMute}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400 animate-pulse" /> : <Volume2 className="w-4 h-4 text-indigo-400" />}
            </button>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
              title="Ambient Volume"
            />
            <span className="text-[9px] text-slate-500 font-mono w-6 text-right">
              {Math.round(volume * 125)}%
            </span>
          </div>

          {/* Aesthetic Description */}
          {preset !== 'off' && (
            <p className="text-[9px] text-indigo-300/40 italic leading-snug text-center select-none pt-1">
              {presetLabels[preset]?.desc}
            </p>
          )}

          {preset !== 'off' && (
            <button
              type="button"
              onClick={() => handlePresetChange('off')}
              className="w-full text-center py-1.5 rounded-lg text-[9px] font-semibold text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/5 transition-all uppercase tracking-wider"
            >
              Silence Ambient Audio
            </button>
          )}
        </div>
      )}
    </div>
  );
}
