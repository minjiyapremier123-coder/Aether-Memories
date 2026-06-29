import React, { useState } from 'react';
import { UserPlus, Save, ArrowLeft, Heart, Sparkles, BookOpen, User } from 'lucide-react';
import { LovedOneProfile, VoiceConfig } from '../types';
import VoiceCalibrator from './VoiceCalibrator';

interface ProfileCreatorProps {
  onSave: (profile: LovedOneProfile) => void;
  onCancel: () => void;
  editingProfile?: LovedOneProfile | null;
}

export default function ProfileCreator({ onSave, onCancel, editingProfile }: ProfileCreatorProps) {
  const [name, setName] = useState(editingProfile?.name || '');
  const [relationship, setRelationship] = useState(editingProfile?.relationship || 'Mother');
  const [personality, setPersonality] = useState(editingProfile?.personality || '');
  const [memories, setMemories] = useState(editingProfile?.memories || '');
  
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(
    editingProfile?.voiceConfig || {
      pitch: 1.0,
      rate: 1.0,
      voiceName: '',
      reverbIntensity: 40,
      calibrated: false
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const profileData: LovedOneProfile = {
      id: editingProfile?.id || Math.random().toString(36).substring(2, 11),
      name: name.trim(),
      relationship,
      personality: personality.trim() || 'A deeply gentle, loving and peaceful soul.',
      memories: memories.trim(),
      voiceConfig,
      createdAt: editingProfile?.createdAt || new Date().toISOString()
    };

    onSave(profileData);
  };

  const relationships = [
    'Mother', 'Father', 'Grandmother', 'Grandfather', 
    'Spouse / Partner', 'Sibling', 'Child', 'Dear Friend', 'Other'
  ];

  return (
    <div id="profile-creator-container" className="max-w-3xl mx-auto bg-white/[0.02] border border-white/10 rounded-[32px] backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="bg-white/[0.01] border-b border-white/5 px-8 py-5 flex items-center gap-3">
        <button
          type="button"
          id="back-to-profiles-btn"
          onClick={onCancel}
          className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl italic text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            {editingProfile ? 'Refine Memorial Profile' : 'Create Memorial Profile'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure their conversational style and voice to craft a gentle, comforting simulation.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Name Input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400/60" />
              Their Name
            </label>
            <input
              type="text"
              id="loved-one-name"
              required
              placeholder="e.g. Grandma Helen, Dad, Sarah"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
            />
          </div>

          {/* Relationship Select */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-indigo-400/60" />
              Relationship to You
            </label>
            <select
              id="loved-one-relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer [&>option]:bg-[#08080A] [&>option]:text-slate-200"
            >
              {relationships.map((rel) => (
                <option key={rel} value={rel}>{rel}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Personality Traits */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400/60" />
            Personality, Phrases, or Tone
          </label>
          <textarea
            id="loved-one-personality"
            rows={2}
            placeholder="e.g. Calm and thoughtful, laughs a lot, calls you 'pumpkin' or 'sweetie', has a warm southern accent, gently reminds you to take care of yourself."
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all resize-none placeholder:text-slate-600"
          />
          <p className="text-[11px] text-slate-500 italic">
            This guides Gemini to speak exactly in their voice, using their favorite endearments and temperament.
          </p>
        </div>

        {/* Shared Memories / Stories */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-indigo-400/60" />
            Special Shared Memories or Life Context
          </label>
          <textarea
            id="loved-one-memories"
            rows={3}
            placeholder="e.g. He built grandfather clocks. He loved camping in Yosemite. He taught me how to bake apple pies. He used to say, 'Never let the sun go down on your anger.'"
            value={memories}
            onChange={(e) => setMemories(e.target.value)}
            className="w-full text-sm bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all resize-none placeholder:text-slate-600"
          />
          <p className="text-[11px] text-slate-500 italic">
            Providing specific memories allows the AI to respond accurately when you bring up stories from their life.
          </p>
        </div>

        {/* Integrated Voice Calibrator */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Vocal Modeling & Synthesis
          </label>
          <VoiceCalibrator
            onCalibrateComplete={(config) => setVoiceConfig(config)}
            initialConfig={voiceConfig}
            relationship={relationship}
          />
        </div>

        {/* Submit Controls */}
        <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
          <button
            type="button"
            id="cancel-profile-btn"
            onClick={onCancel}
            className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-semibold tracking-wider uppercase px-6 py-3 rounded-full transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            id="save-profile-btn"
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold tracking-wider uppercase px-6 py-3 rounded-full transition-all border border-indigo-400/20 shadow-lg"
          >
            <Save className="w-4 h-4" />
            Save Profile
          </button>
        </div>
      </form>
    </div>
  );
}
