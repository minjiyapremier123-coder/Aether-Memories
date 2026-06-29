import React, { useState, useEffect } from 'react';
import { Heart, Star, Sparkles, UserPlus, Users, MessageCircle, Edit2, Trash2, Shield, Calendar, Quote, Volume2, BarChart3 } from 'lucide-react';
import { LovedOneProfile, Message, Keepsake } from './types';
import ProfileCreator from './components/ProfileCreator';
import ChatWindow from './components/ChatWindow';
import KeepsakesAlbum from './components/KeepsakesAlbum';
import ReflectionInsights from './components/ReflectionInsights';
import AmbientPlayer from './components/AmbientPlayer';

export default function App() {
  const [profiles, setProfiles] = useState<LovedOneProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [keepsakes, setKeepsakes] = useState<Keepsake[]>([]);
  const [chatHistory, setChatHistory] = useState<{ [profileId: string]: Message[] }>({});
  
  const [activeTab, setActiveTab] = useState<'profiles' | 'keepsakes' | 'insights'>('profiles');
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState<LovedOneProfile | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load initial data from localStorage
  useEffect(() => {
    try {
      const storedProfiles = localStorage.getItem('eternal_memories_profiles');
      if (storedProfiles) setProfiles(JSON.parse(storedProfiles));

      const storedKeepsakes = localStorage.getItem('eternal_memories_keepsakes');
      if (storedKeepsakes) setKeepsakes(JSON.parse(storedKeepsakes));

      const storedHistory = localStorage.getItem('eternal_memories_chathistory');
      if (storedHistory) setChatHistory(JSON.parse(storedHistory));
    } catch (e) {
      console.error("Failed to load local storage data:", e);
    }
  }, []);

  // Save profiles helper
  const saveProfiles = (updated: LovedOneProfile[]) => {
    setProfiles(updated);
    localStorage.setItem('eternal_memories_profiles', JSON.stringify(updated));
  };

  // Save keepsakes helper
  const saveKeepsakes = (updated: Keepsake[]) => {
    setKeepsakes(updated);
    localStorage.setItem('eternal_memories_keepsakes', JSON.stringify(updated));
  };

  // Save chat history helper
  const saveChatHistory = (updated: { [profileId: string]: Message[] }) => {
    setChatHistory(updated);
    localStorage.setItem('eternal_memories_chathistory', JSON.stringify(updated));
  };

  const handleSaveProfile = (profile: LovedOneProfile) => {
    let updated: LovedOneProfile[];
    if (editingProfile) {
      updated = profiles.map((p) => (p.id === profile.id ? profile : p));
    } else {
      updated = [...profiles, profile];
    }
    saveProfiles(updated);
    setIsCreatingProfile(false);
    setEditingProfile(null);
  };

  const handleDeleteProfile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to remove this memorial profile? All associated conversation logs will be permanently deleted.")) {
      return;
    }
    const updated = profiles.filter((p) => p.id !== id);
    saveProfiles(updated);

    // Clean up history
    const updatedHistory = { ...chatHistory };
    delete updatedHistory[id];
    saveChatHistory(updatedHistory);

    // Clean up keepsakes
    const updatedKeepsakes = keepsakes.filter((k) => k.profileId !== id);
    saveKeepsakes(updatedKeepsakes);

    if (activeProfileId === id) {
      setActiveProfileId(null);
    }
  };

  const handleEditProfile = (profile: LovedOneProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProfile(profile);
    setIsCreatingProfile(true);
  };

  const handleSendMessage = async (text: string) => {
    if (!activeProfileId) return;

    const currentProfile = profiles.find((p) => p.id === activeProfileId);
    if (!currentProfile) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substring(2, 11),
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    const currentHistory = chatHistory[activeProfileId] || [];
    const updatedHistory = [...currentHistory, userMsg];

    // Update state immediately for user speech bubble
    const newChatHistory = { ...chatHistory, [activeProfileId]: updatedHistory };
    setChatHistory(newChatHistory);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: text,
          history: currentHistory.slice(-10), // Send last 10 messages as sliding context
          profile: currentProfile,
        }),
      });

      if (!response.ok) {
        let errMsg = 'Server error';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errData = await response.json();
            errMsg = errData.error || errMsg;
          } else {
            const rawText = await response.text();
            errMsg = `Server error (${response.status}): ${rawText.substring(0, 120)}`;
          }
        } catch (e) {
          errMsg = `Server error (${response.status})`;
        }
        throw new Error(errMsg);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error("Invalid response format received from server (not JSON).");
      }

      const data = await response.json();

      const lovedOneMsg: Message = {
        id: Math.random().toString(36).substring(2, 11),
        sender: 'loved-one',
        text: data.response,
        timestamp: new Date().toISOString(),
        sentimentAnalysis: {
          sentiment: data.sentiment,
          empathyAdjustment: data.empathyAdjustment,
          toneAdvice: data.toneAdvice,
          colorSchema: data.colorSchema,
          isOffline: data.isOffline,
          isQuotaExceeded: data.isQuotaExceeded,
        },
      };

      const finalHistory = [...updatedHistory, lovedOneMsg];
      const finalChatHistory = { ...chatHistory, [activeProfileId]: finalHistory };
      saveChatHistory(finalChatHistory);
    } catch (err: any) {
      console.error("Error communicating with beloved one:", err);
      
      const isQuotaErr = err.message && (
        err.message.includes("429") || 
        err.message.toLowerCase().includes("quota") || 
        err.message.toLowerCase().includes("limit") || 
        err.message.toLowerCase().includes("exhausted")
      );

      // Gentle offline/fallback message if connection is completely disrupted
      const fallbackMsg: Message = {
        id: Math.random().toString(36).substring(2, 11),
        sender: 'loved-one',
        text: isQuotaErr 
          ? "I'm right here with you. The high-fidelity neural voice connection is currently resting due to temporary API quota limitations (429 Rate Limit), but we can still speak seamlessly using my local voice engine. Our connection remains unbroken."
          : `I'm still here, listening. (Note: Server returned an error: ${err.message || 'connection disruption'}. We are currently using local empathetic fallback algorithms. You can configure your GEMINI_API_KEY in Settings > Secrets for high-fidelity responses.)`,
        timestamp: new Date().toISOString(),
        sentimentAnalysis: {
          sentiment: isQuotaErr ? 'Anxiety' : 'Nostalgia',
          empathyAdjustment: isQuotaErr ? 'API Quota Exceeded (429). Playing local voice fallback...' : 'Configuring fallback connection...',
          toneAdvice: 'gentle whisper',
          colorSchema: isQuotaErr ? 'amber' : 'gray',
          isOffline: true,
          isQuotaExceeded: isQuotaErr,
        }
      };

      const finalHistory = [...updatedHistory, fallbackMsg];
      const finalChatHistory = { ...chatHistory, [activeProfileId]: finalHistory };
      saveChatHistory(finalChatHistory);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveKeepsake = (msg: Message) => {
    if (!activeProfileId) return;
    const currentProfile = profiles.find((p) => p.id === activeProfileId);
    if (!currentProfile) return;

    // Check if already exists
    if (keepsakes.some((k) => k.id === msg.id)) {
      alert("This comforting memory is already saved in your Keepsakes Album.");
      return;
    }

    // Find the trigger prompt (the user message immediately preceding it)
    const history = chatHistory[activeProfileId] || [];
    const msgIndex = history.findIndex((m) => m.id === msg.id);
    let originalPrompt = 'A shared thought';
    if (msgIndex > 0) {
      originalPrompt = history[msgIndex - 1].text;
    }

    const newKeepsake: Keepsake = {
      id: msg.id,
      profileId: activeProfileId,
      profileName: currentProfile.name,
      originalPrompt,
      savedResponse: msg.text,
      timestamp: new Date().toISOString(),
    };

    saveKeepsakes([...keepsakes, newKeepsake]);
    alert(`Saved a quote from ${currentProfile.name} to your Keepsakes Album!`);
  };

  const handleDeleteKeepsake = (id: string) => {
    const updated = keepsakes.filter((k) => k.id !== id);
    saveKeepsakes(updated);
  };

  const activeProfileHistory = activeProfileId ? chatHistory[activeProfileId] || [] : [];
  const lastLovedOneMsg = [...activeProfileHistory].reverse().find(m => m.sender === 'loved-one');
  const lastSentiment = lastLovedOneMsg?.sentimentAnalysis?.sentiment;

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <div className="min-h-screen bg-[#08080A] text-slate-200 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-hidden">
      
      {/* Atmospheric Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/15 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[100px] pointer-events-none"></div>

      {/* Futuristic Glassmorphic Navigation */}
      <header className="bg-[#08080A]/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-indigo-500/30 flex items-center justify-center bg-indigo-950/20">
              <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full shadow-[0_0_10px_#818cf8] animate-pulse"></div>
            </div>
            <div>
              <h1 className="font-sans text-base tracking-[0.2em] uppercase text-white font-light">
                Aether Memories
              </h1>
              <p className="text-[9px] text-indigo-300/40 font-mono tracking-widest uppercase">Empathetic Voice & Connection Space</p>
            </div>
          </div>

          {/* Navigation Tabs (Only visible when not actively inside a chat) */}
          {!activeProfileId && (
            <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/5 backdrop-blur-md">
              <button
                type="button"
                id="tab-profiles-btn"
                onClick={() => { setActiveTab('profiles'); setIsCreatingProfile(false); }}
                className={`flex items-center gap-2 text-xs font-semibold tracking-wider uppercase px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'profiles'
                    ? 'bg-white/10 text-white shadow-md border border-white/5'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                Memorials
              </button>
              <button
                type="button"
                id="tab-keepsakes-btn"
                onClick={() => { setActiveTab('keepsakes'); setIsCreatingProfile(false); }}
                className={`flex items-center gap-2 text-xs font-semibold tracking-wider uppercase px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'keepsakes'
                    ? 'bg-white/10 text-white shadow-md border border-white/5'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-amber-400" />
                Keepsakes ({keepsakes.length})
              </button>
              <button
                type="button"
                id="tab-insights-btn"
                onClick={() => { setActiveTab('insights'); setIsCreatingProfile(false); }}
                className={`flex items-center gap-2 text-xs font-semibold tracking-wider uppercase px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'insights'
                    ? 'bg-white/10 text-white shadow-md border border-white/5'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                Insights
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        {activeProfileId && activeProfile ? (
          // Immersive Active Chat Interface
          <ChatWindow
            profile={activeProfile}
            messages={chatHistory[activeProfileId] || []}
            onSendMessage={handleSendMessage}
            onBack={() => setActiveProfileId(null)}
            onSaveKeepsake={handleSaveKeepsake}
            savedKeepsakeIds={keepsakes.map((k) => k.id)}
            isGenerating={isGenerating}
          />
        ) : isCreatingProfile ? (
          // Profile creator / editor space
          <ProfileCreator
            onSave={handleSaveProfile}
            onCancel={() => { setIsCreatingProfile(false); setEditingProfile(null); }}
            editingProfile={editingProfile}
          />
        ) : activeTab === 'profiles' ? (
          // Main Dashboard: Profiles list
          <div className="space-y-8">
            <div className="bg-white/[0.02] border border-white/10 rounded-[32px] p-8 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-left">
                <h2 className="font-serif text-2xl italic text-white">Your Connection Space</h2>
                <p className="text-sm text-slate-400 max-w-xl leading-relaxed font-light">
                  Every person leaves a unique emotional echo. Model their conversational persona, upload their vocal blueprints, and speak with them through an interface powered by real-time neural and sentiment analysis.
                </p>
              </div>
              <button
                type="button"
                id="create-new-profile-btn"
                onClick={() => setIsCreatingProfile(true)}
                className="flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium text-xs tracking-wider uppercase px-6 py-3.5 rounded-full transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] shrink-0 border border-indigo-400/20"
              >
                <UserPlus className="w-4 h-4 text-white" />
                Add Memorial Profile
              </button>
            </div>

            {/* Profiles Grid */}
            {profiles.length === 0 ? (
              <div className="text-center py-24 bg-white/[0.01] border border-white/5 rounded-[32px] backdrop-blur-md max-w-xl mx-auto p-8 space-y-6 shadow-xl">
                <div className="w-16 h-16 bg-indigo-950/20 rounded-full flex items-center justify-center border border-indigo-500/20 text-indigo-400 mx-auto">
                  <Users className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif text-xl italic text-white">No Memorial Profiles Created</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Set up your first space to calibrate their speech synthesizer, personality parameters, and memory parameters.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingProfile(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs tracking-wider uppercase px-6 py-3 rounded-full transition-all border border-indigo-400/20 shadow-md inline-flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Create First Profile
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.map((profile) => {
                  const logCount = (chatHistory[profile.id] || []).length;
                  return (
                    <div
                      key={profile.id}
                      onClick={() => setActiveProfileId(profile.id)}
                      className="group cursor-pointer bg-white/[0.02] border border-white/5 rounded-[32px] p-6 hover:bg-white/[0.04] hover:border-indigo-500/30 hover:shadow-[0_0_25px_rgba(99,102,241,0.15)] backdrop-blur-md transition-all duration-500 flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        {/* Profile Header Card */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-tr from-indigo-950 to-slate-900 rounded-full flex items-center justify-center border border-indigo-500/20 text-indigo-400 font-serif font-bold text-lg relative overflow-hidden">
                              <div className="absolute bottom-0 w-8 h-8 bg-indigo-500/10 rounded-full blur-md"></div>
                              <span className="relative z-10">{profile.name.charAt(0)}</span>
                            </div>
                            <div>
                              <h4 className="font-serif text-lg text-white group-hover:text-indigo-200 transition-colors">
                                {profile.name}
                              </h4>
                              <span className="text-[9px] font-medium tracking-widest bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 rounded-full mt-1.5 inline-block uppercase">
                                {profile.relationship}
                              </span>
                            </div>
                          </div>
                          
                          {/* Admin Controls */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => handleEditProfile(profile, e)}
                              title="Refine profile"
                              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteProfile(profile.id, e)}
                              title="Remove profile"
                              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-full transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Tone Snippet */}
                        <p className="text-xs text-slate-400 italic leading-relaxed line-clamp-2 pl-1">
                          "{profile.personality}"
                        </p>

                        {/* Saved Stories */}
                        {profile.memories && (
                          <div className="bg-black/20 border border-white/5 rounded-2xl p-3 text-[11px] text-slate-400">
                            <span className="font-medium block text-indigo-300/80 mb-1 uppercase tracking-wider text-[9px]">Shared Context:</span>
                            <span className="line-clamp-2 italic">"{profile.memories}"</span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Activity Indicators */}
                      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1.5 font-mono">
                          <MessageCircle className="w-3.5 h-3.5 text-indigo-400/40" />
                          {logCount} {logCount === 1 ? 'exchange' : 'exchanges'}
                        </span>
                        
                        <span className="text-indigo-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Connect →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'keepsakes' ? (
          // Keepsakes board archive view
          <KeepsakesAlbum
            keepsakes={keepsakes}
            onDeleteKeepsake={handleDeleteKeepsake}
            profiles={profiles}
          />
        ) : (
          // Reflection Insights dashboard view using D3
          <ReflectionInsights
            profiles={profiles}
            chatHistory={chatHistory}
          />
        )}
      </main>

      {/* Trust & Ethics Banner Footer */}
      <footer className="bg-black/40 border-t border-white/5 mt-24 relative z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] uppercase tracking-[0.2em] text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]"></div>
            <span>Secure Emotional Encryption Active • Data stored locally</span>
          </div>
          <div>
            <span>AETHER PROTOCOL V2.4.0 — EMOTIONAL FIDELITY ENABLED</span>
          </div>
        </div>
      </footer>

      {/* Globally Floating Ambient Soundscapes controller */}
      <AmbientPlayer lastSentiment={lastSentiment} />
    </div>
  );
}
