export interface VoiceConfig {
  pitch: number;           // 0.5 to 2.0 (TTS pitch multiplier)
  rate: number;            // 0.5 to 2.0 (TTS speech rate)
  voiceName: string;       // Chosen SpeechSynthesisVoice name
  reverbIntensity: number; // 0 to 100 (simulated warmth filter)
  calibrated: boolean;     // Whether calibrated using an audio sample
  fileName?: string;       // Uploaded/recorded filename
  clonedVoiceData?: string; // Base64 audio content for high-fidelity voice cloning synthesis
}

export interface LovedOneProfile {
  id: string;
  name: string;
  relationship: string;    // e.g. Mother, Father, Partner, Friend
  personality: string;     // e.g. "gentle, wise, tells jokes"
  memories: string;        // e.g. Shared stories, context to ground the chatbot
  voiceConfig: VoiceConfig;
  createdAt: string;
}

export interface SentimentAnalysis {
  sentiment: string;          // e.g., "Grief", "Nostalgia", "Peace", "Gratitude", "Anxiety"
  empathyAdjustment: string;  // e.g., "Whisper softly and validate their feelings"
  toneAdvice: string;         // e.g., "warm", "reassuring", "deeply gentle"
  colorSchema: string;        // Tailwind color class for ambient glowing pulse (amber, blue, green, etc)
  isOffline?: boolean;        // Indicates if generated via empathetic local simulation
  isQuotaExceeded?: boolean;  // Indicates if the Gemini API has exceeded daily quota
}

export interface Message {
  id: string;
  sender: 'user' | 'loved-one';
  text: string;
  timestamp: string;
  sentimentAnalysis?: SentimentAnalysis;
}

export interface Keepsake {
  id: string;
  profileId: string;
  profileName: string;
  originalPrompt: string;
  savedResponse: string;
  timestamp: string;
}
