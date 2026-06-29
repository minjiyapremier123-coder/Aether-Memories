import React, { useState } from 'react';
import { Star, Trash2, Calendar, Play, Volume2, Search, Quote } from 'lucide-react';
import { Keepsake, LovedOneProfile } from '../types';

interface KeepsakesAlbumProps {
  keepsakes: Keepsake[];
  onDeleteKeepsake: (id: string) => void;
  profiles: LovedOneProfile[];
}

export default function KeepsakesAlbum({ keepsakes, onDeleteKeepsake, profiles }: KeepsakesAlbumProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeepsake, setSelectedKeepsake] = useState<Keepsake | null>(null);

  // Filter keepsakes based on name or quote text
  const filteredKeepsakes = keepsakes.filter(k => 
    k.savedResponse.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.profileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.originalPrompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const speakKeepsake = (keepsake: Keepsake) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert("Speech synthesis not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();

    // Find the profile to get their calibrated voice pitch and speed
    const profile = profiles.find(p => p.id === keepsake.profileId);
    const utterance = new SpeechSynthesisUtterance(keepsake.savedResponse);

    if (profile) {
      const voiceConfig = profile.voiceConfig || { pitch: 1.0, rate: 1.0, voiceName: '', reverbIntensity: 40, calibrated: false };
      utterance.pitch = voiceConfig.pitch;
      utterance.rate = voiceConfig.rate;

      if (voiceConfig.voiceName) {
        const voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find(v => v.name === voiceConfig.voiceName);
        if (matchedVoice) utterance.voice = matchedVoice;
      }
    }

    window.speechSynthesis.speak(utterance);
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div id="keepsakes-album-container" className="space-y-6">
      
      {/* Search and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-lg">
        <div>
          <h2 className="font-serif text-2xl italic text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400/20" />
            Keepsakes Album
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            A preserved archive of deeply comforting words and moments shared with your loved ones.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search saved quotes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 text-xs bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* Keepsakes Grid */}
      {filteredKeepsakes.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.01] border border-white/10 border-dashed rounded-[32px] max-w-lg mx-auto p-8 space-y-4">
          <Star className="w-10 h-10 text-slate-600 mx-auto animate-pulse" />
          <div className="space-y-1">
            <h4 className="font-serif text-base italic text-slate-300">No Keepsakes Preserved Yet</h4>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              When talking to a loved one, click the star icon beneath any of their responses to save and cherish those comforting words here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredKeepsakes.map((keepsake) => (
            <div
              key={keepsake.id}
              className="group relative bg-white/[0.02] border border-white/10 hover:border-indigo-500/30 rounded-2xl p-6 shadow-inner hover:shadow-2xl hover:bg-white/[0.03] transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Vintage Letter Styling / Polaroid Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-serif text-base italic text-slate-200 leading-none">{keepsake.profileName}</h4>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1.5 font-mono">
                      <Calendar className="w-3 h-3" />
                      {formatDate(keepsake.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => speakKeepsake(keepsake)}
                      title="Speak quote"
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteKeepsake(keepsake.id)}
                      title="Remove from album"
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Keepsake quote */}
                <div className="relative">
                  <Quote className="w-7 h-7 text-white/5 absolute -top-3 -left-2 -z-10 transform scale-x-[-1]" />
                  <p className="text-sm font-serif italic text-slate-300 pl-4 border-l-2 border-indigo-500/40 leading-relaxed whitespace-pre-line select-text">
                    "{keepsake.savedResponse}"
                  </p>
                </div>
              </div>

              {/* Context prompt triggers */}
              <div className="mt-5 pt-4 border-t border-white/5 flex flex-col gap-1 text-[11px] text-slate-500">
                <span className="font-mono uppercase tracking-wider text-slate-600">In response to:</span>
                <span className="truncate italic text-slate-400">"{keepsake.originalPrompt}"</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
