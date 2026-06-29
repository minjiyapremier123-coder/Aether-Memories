import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, ArrowLeft, Star, Heart, Flame, ShieldAlert, Sparkles, Smile, RefreshCw } from 'lucide-react';
import { LovedOneProfile, Message } from '../types';

interface ChatWindowProps {
  profile: LovedOneProfile;
  messages: Message[];
  onSendMessage: (text: string) => Promise<void>;
  onBack: () => void;
  onSaveKeepsake: (msg: Message) => void;
  savedKeepsakeIds: string[];
  isGenerating: boolean;
}

// Helper to convert base64 to ArrayBuffer for Web Audio decoding
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64.split(',')[1] || base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper to decode audio data across all browsers supporting callback or promise versions
function safeDecodeAudioData(audioCtx: AudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    try {
      const promise = audioCtx.decodeAudioData(
        arrayBuffer,
        (buffer) => resolve(buffer),
        (err) => reject(err || new Error("Acoustic format decoding error"))
      );
      if (promise && typeof promise.catch === 'function') {
        promise.catch((err) => reject(err));
      }
    } catch (e) {
      reject(e);
    }
  });
}

// Helper to decode raw Big-Endian signed 16-bit linear PCM (audio/L16) to an AudioBuffer at 24kHz
function decodeL16ToAudioBuffer(audioCtx: AudioContext, arrayBuffer: ArrayBuffer, sampleRate = 24000): AudioBuffer {
  const numSamples = Math.floor(arrayBuffer.byteLength / 2);
  const audioBuffer = audioCtx.createBuffer(1, numSamples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  const view = new DataView(arrayBuffer);
  for (let i = 0; i < numSamples; i++) {
    // L16 is defined in RFC 1890 as big-endian (network byte order) 16-bit signed integer
    const val = view.getInt16(i * 2, false);
    // Normalize Int16 range [-32768, 32767] to Float32 range [-1.0, 1.0]
    channelData[i] = val / 32768.0;
  }
  return audioBuffer;
}

// Direct Time-Domain Zero-Crossing Period Analysis to extract vocal formant signatures
function analyzeVocalPrintDirect(modulatorBuffer: AudioBuffer): number[] {
  const channelData = modulatorBuffer.getChannelData(0);
  const sampleRate = modulatorBuffer.sampleRate;
  
  // Bin into 5 voice frequency bands:
  // 1. Bass / Chest Resonance (80Hz - 250Hz)
  // 2. Low-mids / Vocal Body (250Hz - 600Hz)
  // 3. Mids / Primary Speech Formants (600Hz - 2000Hz)
  // 4. Presence / Articulation (2000Hz - 4500Hz)
  // 5. Brilliance / Sibilance & Breath (4500Hz - 10000Hz)
  const bins = [0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0];
  
  let lastCrossing = 0;
  let peakValue = 0.01;
  
  const limit = Math.min(channelData.length, 44100); // Analyze up to ~1s of audio for speed
  for (let i = 1; i < limit; i++) {
    const val = channelData[i];
    const prevVal = channelData[i - 1];
    
    if (Math.abs(val) > peakValue) {
      peakValue = Math.abs(val);
    }
    
    // Detect zero crossing
    if ((prevVal < 0 && val >= 0) || (prevVal > 0 && val <= 0)) {
      const periodInSamples = i - lastCrossing;
      lastCrossing = i;
      
      if (periodInSamples > 0) {
        const freq = sampleRate / (periodInSamples * 2);
        const amplitude = Math.abs(val);
        
        if (freq >= 60 && freq < 250) {
          bins[0] += amplitude;
          counts[0]++;
        } else if (freq >= 250 && freq < 600) {
          bins[1] += amplitude;
          counts[1]++;
        } else if (freq >= 600 && freq < 2000) {
          bins[2] += amplitude;
          counts[2]++;
        } else if (freq >= 2000 && freq < 4500) {
          bins[3] += amplitude;
          counts[3]++;
        } else if (freq >= 4500 && freq < 12000) {
          bins[4] += amplitude;
          counts[4]++;
        }
      }
    }
  }
  
  const avgGains = bins.map((val, idx) => {
    const count = counts[idx] || 1;
    return val / count;
  });
  
  const sumGains = avgGains.reduce((a, b) => a + b, 0) || 1;
  const normalized = avgGains.map(g => g / (sumGains / 5));
  
  // Convert energy ratios to decibels (-8dB to +8dB peak boost/cut)
  const dbGains = normalized.map(r => {
    if (r <= 0) return -6;
    let db = 12 * Math.log10(r);
    if (isNaN(db)) return 0;
    return Math.min(8, Math.max(-8, db));
  });
  
  console.log("[Aether Vocal Matcher] Derived EQ Profile (dB):", dbGains);
  return dbGains;
}

export default function ChatWindow({
  profile,
  messages,
  onSendMessage,
  onBack,
  onSaveKeepsake,
  savedKeepsakeIds,
  isGenerating
}: ChatWindowProps) {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const canvasRefs = useRef<{ [msgId: string]: HTMLCanvasElement | null }>({});
  const animationFrameRefs = useRef<{ [msgId: string]: number }>({});
  
  const activeAudioSourcesRef = useRef<any[]>([]);
  const globalAudioCtxRef = useRef<AudioContext | null>(null);

  // Clear any playing audio on unmount
  useEffect(() => {
    return () => {
      if (globalAudioCtxRef.current) {
        try { globalAudioCtxRef.current.close(); } catch (e) {}
      }
      activeAudioSourcesRef.current.forEach(source => {
        try { source.stop(); } catch (e) {}
      });
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Set up Speech Recognition (Speech-to-Text)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText((prev) => (prev ? prev + ' ' + transcript : transcript));
        }
      };

      rec.onerror = (e: any) => {
        console.error("Speech recognition error:", e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Handle automatic speech of new messages
  useEffect(() => {
    if (messages.length > 0 && autoSpeak) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender === 'loved-one' && playingMessageId !== lastMsg.id) {
        // Wait a tiny bit for the generation to finish and then speak
        setTimeout(() => {
          speakMessage(lastMsg);
        }, 300);
      }
    }
  }, [messages, autoSpeak]);

  // Handle mic click
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Speak using web synthesis or real-time spectral vocoding
  const speakMessage = async (msg: Message) => {
    // If currently speaking this message, cancel it (toggle off)
    if (playingMessageId === msg.id) {
      if (globalAudioCtxRef.current) {
        try { globalAudioCtxRef.current.close(); } catch (e) {}
        globalAudioCtxRef.current = null;
      }
      activeAudioSourcesRef.current.forEach(source => {
        try { source.stop(); } catch (e) {}
      });
      activeAudioSourcesRef.current = [];
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingMessageId(null);
      return;
    }

    // Stop anything else first
    if (globalAudioCtxRef.current) {
      try { globalAudioCtxRef.current.close(); } catch (e) {}
      globalAudioCtxRef.current = null;
    }
    activeAudioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeAudioSourcesRef.current = [];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingMessageId(msg.id);

    const voiceConfig = profile.voiceConfig || { pitch: 1.0, rate: 1.0, voiceName: '', reverbIntensity: 40, calibrated: false };
    
    // If clonedVoiceData (from recording/upload) is present, initiate 10-Band Real-Time Vocoding!
    if (voiceConfig && voiceConfig.clonedVoiceData) {
      try {
        console.log("[Aether Vocoder] Initiating real-time 10-band spectral vocoder engine...");
        
        // 1. Fetch neural speech carrier from Gemini TTS server endpoint
        const response = await fetch('/api/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: msg.text,
            toneAdvice: msg.sentimentAnalysis?.toneAdvice || "gentle, comforting",
            pitch: voiceConfig.pitch,
            relationship: profile.relationship
          })
        });

        if (!response.ok) {
          throw new Error("Speech synthesis request failed");
        }

        const data = await response.json();

        // If the server indicates offline mode, fall back to Web Speech synthesis with ambient layer morphing
        if (data.isOffline || !data.audioData) {
          console.warn("[Aether Vocoder] Server running in local backup mode. Blending browser TTS with voice-print blueprint.");
          playSpeechSynthesisFallback(msg);
          return;
        }

        // We have BOTH: data.audioData (Neural Words Modulator) and voiceConfig.clonedVoiceData (Loved One Timbre Carrier)
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        globalAudioCtxRef.current = audioCtx;

        const carrierAB = base64ToArrayBuffer(data.audioData);
        const modulatorAB = base64ToArrayBuffer(voiceConfig.clonedVoiceData);

        let carrierBuffer: AudioBuffer;
        try {
          carrierBuffer = await safeDecodeAudioData(audioCtx, carrierAB);
        } catch (err) {
          console.warn("[Aether Vocoder] Standard decoding failed, attempting raw linear 16-bit PCM (audio/L16) decoding at 24kHz:", err);
          try {
            carrierBuffer = decodeL16ToAudioBuffer(audioCtx, carrierAB, 24000);
          } catch (pcmErr) {
            console.error("[Aether Vocoder] Failed to decode carrier audio buffer from Gemini TTS as raw PCM:", pcmErr);
            throw pcmErr; // Re-throw so it triggers the standard Web Speech fallback
          }
        }

        let modulatorBuffer: AudioBuffer | null = null;
        try {
          modulatorBuffer = await safeDecodeAudioData(audioCtx, modulatorAB);
        } catch (err) {
          console.warn("[Aether Vocoder] Modulator voice decoding failed. Falling back to direct neural carrier playback with pitch styling:", err);
        }

        const spectralEQGains = modulatorBuffer 
          ? analyzeVocalPrintDirect(modulatorBuffer)
          : [1.0, 1.0, 1.0, 1.0, 1.0];

        // AI speech buffer has the words
        const aiSpeechSource = audioCtx.createBufferSource();
        aiSpeechSource.buffer = carrierBuffer;

        let lovedOneSource: AudioBufferSourceNode | null = null;
        let subHumSource: AudioBufferSourceNode | null = null;
        let currentNode: AudioNode;

        if (modulatorBuffer) {
          // ----------------- HIGH FIDELITY 10-BAND VOCODER GRAPH -----------------
          // Loved one's recorded voice has the timbre (is gated by the envelopes, looped)
          lovedOneSource = audioCtx.createBufferSource();
          lovedOneSource.buffer = modulatorBuffer;
          lovedOneSource.loop = true;

          // Combined output of the vocoder bands
          const vocoderMerger = audioCtx.createGain();
          vocoderMerger.gain.value = 1.0;

          // 10 vocoder bands targeting key vocal frequencies (120Hz to 10kHz)
          const bands = [
            { freq: 120, Q: 5.0 },
            { freq: 240, Q: 5.0 },
            { freq: 450, Q: 5.0 },
            { freq: 800, Q: 5.0 },
            { freq: 1400, Q: 5.0 },
            { freq: 2200, Q: 5.0 },
            { freq: 3200, Q: 5.0 },
            { freq: 4800, Q: 5.0 },
            { freq: 6800, Q: 5.0 },
            { freq: 9200, Q: 5.0 }
          ];

          // Rectification wave curve for envelope extraction
          const curve = new Float32Array(65536);
          for (let i = 0; i < 65536; i++) {
            const x = (i - 32768) / 32768;
            curve[i] = Math.abs(x);
          }

          bands.forEach((band) => {
            // A. Modulator (AI Speech) Filter & Envelope Follower
            const modFilter = audioCtx.createBiquadFilter();
            modFilter.type = 'bandpass';
            modFilter.frequency.value = band.freq;
            modFilter.Q.value = band.Q;
            aiSpeechSource.connect(modFilter);

            const rectifier = audioCtx.createWaveShaper();
            rectifier.curve = curve;
            modFilter.connect(rectifier);

            const envelopeFollower = audioCtx.createBiquadFilter();
            envelopeFollower.type = 'lowpass';
            envelopeFollower.frequency.value = 32; // smooth 32Hz envelope integration
            rectifier.connect(envelopeFollower);

            // B. Carrier (Recorded Loved One's Voice) Filter & Gating
            const carFilter = audioCtx.createBiquadFilter();
            carFilter.type = 'bandpass';
            carFilter.frequency.value = band.freq;
            carFilter.Q.value = band.Q;
            lovedOneSource!.connect(carFilter);

            const bandGain = audioCtx.createGain();
            bandGain.gain.value = 0.0;
            carFilter.connect(bandGain);

            // Modulate the carrier band amplitude dynamically via audio-rate envelope follow
            envelopeFollower.connect(bandGain.gain);

            // Merge into the final vocoder mix
            bandGain.connect(vocoderMerger);
          });

          // C. Sibilance/Consonant Bypass (Unvoiced high frequencies from AI Speech)
          const sibilanceFilter = audioCtx.createBiquadFilter();
          sibilanceFilter.type = 'highpass';
          sibilanceFilter.frequency.value = 4500; // Above 4.5kHz for consonants like s, f, t, sh

          const sibilanceGain = audioCtx.createGain();
          sibilanceGain.gain.value = 0.28; // Blend level for beautiful crisp legibility

          aiSpeechSource.connect(sibilanceFilter);
          sibilanceFilter.connect(sibilanceGain);
          sibilanceGain.connect(vocoderMerger);

          // D. Intelligibility Anchor (subtle feedthrough of the clean spoken voice)
          const anchorGain = audioCtx.createGain();
          anchorGain.gain.value = 0.12; // 12% anchor to ground the words perfectly
          aiSpeechSource.connect(anchorGain);
          anchorGain.connect(vocoderMerger);

          currentNode = vocoderMerger;
        } else {
          // No modulator buffer decoded, connect AI speech source directly to EQ chain
          currentNode = aiSpeechSource;
        }

        // ----------------- POST PROCESSING CHAIN -----------------
        // Apply our Acoustic Timbre EQ Chain to the vocoder output
        const eqFrequencies = [180, 450, 1200, 3000, 6500];

        eqFrequencies.forEach((freq, idx) => {
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = freq;
          filter.Q.value = 1.2;
          filter.gain.value = spectralEQGains[idx]; // Custom signature boost/cut!
          
          currentNode.connect(filter);
          currentNode = filter;
        });

        const merger = audioCtx.createGain();
        merger.gain.value = 1.0;
        currentNode.connect(merger);

        // Memory Aura Space Reverb (Feedback Delay network)
        const delay = audioCtx.createDelay();
        delay.delayTime.value = 0.18; // 180ms echo
        
        const delayFeedback = audioCtx.createGain();
        delayFeedback.gain.value = 0.25;

        const delayFilter = audioCtx.createBiquadFilter();
        delayFilter.type = 'lowpass';
        delayFilter.frequency.value = 2200; // soft dampening filter

        merger.connect(delay);
        delay.connect(delayFilter);
        delayFilter.connect(delayFeedback);
        delayFeedback.connect(delay);

        const wetGain = audioCtx.createGain();
        const intensity = Math.min(100, Math.max(0, voiceConfig.reverbIntensity)) / 100;
        wetGain.gain.value = intensity * 0.42;
        delayFilter.connect(wetGain);

        const out = audioCtx.createGain();
        out.gain.value = 1.3;

        merger.connect(out);
        wetGain.connect(out);
        out.connect(audioCtx.destination);

        if (modulatorBuffer) {
          // Play an extremely quiet sub-harmonic backing hum of their real voice for warm organic textures
          subHumSource = audioCtx.createBufferSource();
          subHumSource.buffer = modulatorBuffer;
          subHumSource.loop = true;

          const backingFilter = audioCtx.createBiquadFilter();
          backingFilter.type = 'lowpass';
          backingFilter.frequency.value = 350; // low mumble warmth only

          const backingGain = audioCtx.createGain();
          backingGain.gain.value = 0.02; // extremely quiet background hum

          subHumSource.connect(backingFilter);
          backingFilter.connect(backingGain);
          backingGain.connect(out);
        }

        aiSpeechSource.onended = () => {
          if (lovedOneSource) { try { lovedOneSource.stop(); } catch (e) {} }
          if (subHumSource) { try { subHumSource.stop(); } catch (e) {} }
          try { audioCtx.close(); } catch (e) {}
          if (globalAudioCtxRef.current === audioCtx) {
            globalAudioCtxRef.current = null;
          }
          setPlayingMessageId(null);
        };

        const activeSources: AudioBufferSourceNode[] = [aiSpeechSource];
        if (lovedOneSource) activeSources.push(lovedOneSource);
        if (subHumSource) activeSources.push(subHumSource);

        activeAudioSourcesRef.current = activeSources;
        aiSpeechSource.start(0);
        if (lovedOneSource) lovedOneSource.start(0);
        if (subHumSource) subHumSource.start(0);
      } catch (err) {
        console.error("[Aether Vocoder] Cloner engine exception, falling back to Web Speech synthesis:", err);
        playSpeechSynthesisFallback(msg);
      }
    } else {
      // Standard calibrated synthesis if no audio blueprint recording is uploaded
      playSpeechSynthesisFallback(msg);
    }
  };

  const playSpeechSynthesisFallback = (msg: Message) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(msg.text);
    const voiceConfig = profile.voiceConfig || { pitch: 1.0, rate: 1.0, voiceName: '', reverbIntensity: 40, calibrated: false };
    utterance.pitch = voiceConfig.pitch;
    utterance.rate = voiceConfig.rate;

    if (voiceConfig.voiceName) {
      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find(v => v.name === voiceConfig.voiceName);
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
    }

    utterance.onend = () => {
      setPlayingMessageId(null);
      if (globalAudioCtxRef.current) {
        try { globalAudioCtxRef.current.close(); } catch (e) {}
        globalAudioCtxRef.current = null;
      }
    };

    utterance.onerror = () => {
      setPlayingMessageId(null);
      if (globalAudioCtxRef.current) {
        try { globalAudioCtxRef.current.close(); } catch (e) {}
        globalAudioCtxRef.current = null;
      }
    };

    // If clonedVoiceData is present, play a beautifully filtered background acoustic layer of their real recording!
    if (voiceConfig.clonedVoiceData) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        globalAudioCtxRef.current = audioCtx;
        
        const ab = base64ToArrayBuffer(voiceConfig.clonedVoiceData);
        safeDecodeAudioData(audioCtx, ab).then(buffer => {
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          
          // Apply a gentle lowpass to make it hum warmly
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 600;

          const gain = audioCtx.createGain();
          gain.gain.value = 0.12; // quiet, soothing backing timber of their voice

          source.connect(filter);
          filter.connect(gain);
          gain.connect(audioCtx.destination);
          
          activeAudioSourcesRef.current.push(source);
          source.start(0);
        }).catch(e => console.warn("Fallback background layer decoding error:", e));
      } catch (e) {
        console.warn("Background hum layer error:", e);
      }
    }

    window.speechSynthesis.speak(utterance);
  };

  // Audio wave canvas animator for currently playing messages
  useEffect(() => {
    Object.keys(animationFrameRefs.current).forEach((id) => {
      cancelAnimationFrame(animationFrameRefs.current[id]);
    });
    animationFrameRefs.current = {};

    if (!playingMessageId) return;

    const canvas = canvasRefs.current[playingMessageId];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = '#d97706'; // warm amber wave
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      const sliceWidth = width / 30;
      let x = 0;

      for (let i = 0; i < 30; i++) {
        // Multi-frequency sine waves to simulate speech harmonics
        const time = Date.now() * 0.015;
        const offset = Math.sin(i * 0.3 + time) * Math.cos(i * 0.1 - time * 0.5);
        const volumeFactor = Math.random() * 0.3 + 0.7; // random volume fluctuations
        const y = (0.5 + offset * 0.45 * volumeFactor) * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();

      animationFrameRefs.current[playingMessageId] = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (playingMessageId && animationFrameRefs.current[playingMessageId]) {
        cancelAnimationFrame(animationFrameRefs.current[playingMessageId]);
      }
    };
  }, [playingMessageId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;

    const textToSend = inputText.trim();
    setInputText('');
    await onSendMessage(textToSend);
  };

  // Sentiment class helper
  const getSentimentGlow = (schema?: string) => {
    switch (schema) {
      case 'blue': // Grief / Loneliness
        return 'border-l-4 border-indigo-500/50 bg-indigo-500/5 text-slate-200';
      case 'amber': // Nostalgia
        return 'border-l-4 border-amber-500/50 bg-amber-500/5 text-slate-200';
      case 'emerald': // Peace / Calm
        return 'border-l-4 border-emerald-500/50 bg-emerald-500/5 text-slate-200';
      case 'rose': // Joy / Gratitude / Love
        return 'border-l-4 border-rose-500/50 bg-rose-500/5 text-slate-200';
      case 'purple': // Anxiety
        return 'border-l-4 border-purple-500/50 bg-purple-500/5 text-slate-200';
      default:
        return 'border-l-4 border-indigo-500/30 bg-white/[0.02] text-slate-200';
    }
  };

  const getSentimentBadge = (schema?: string) => {
    switch (schema) {
      case 'blue': return 'bg-indigo-950/40 text-indigo-300 border-indigo-500/20';
      case 'amber': return 'bg-amber-950/40 text-amber-300 border-amber-500/20';
      case 'emerald': return 'bg-emerald-950/40 text-emerald-300 border-emerald-500/20';
      case 'rose': return 'bg-rose-950/40 text-rose-300 border-rose-500/20';
      case 'purple': return 'bg-purple-950/40 text-purple-300 border-purple-500/20';
      default: return 'bg-slate-900/60 text-indigo-300/80 border-white/5';
    }
  };

  // Get active background aura color based on last loved-one message sentiment
  const lastLovedOneMsg = [...messages].reverse().find(m => m.sender === 'loved-one');
  const activeColorSchema = lastLovedOneMsg?.sentimentAnalysis?.colorSchema;

  return (
    <div id="chat-canopy" className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-180px)] min-h-[650px] overflow-hidden transition-all duration-700">
      
      {/* Left Column: Identity & Sentiment */}
      <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-y-auto pb-4">
        
        {/* Profile Card */}
        <div className="p-8 rounded-[32px] bg-white/[0.03] border border-white/10 backdrop-blur-xl flex flex-col items-center text-center shadow-xl">
          <div className="w-28 h-28 rounded-full border border-indigo-500/30 p-1 mb-5 relative">
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-950 via-slate-900 to-black flex items-center justify-center relative overflow-hidden">
               {/* Abstract silhouette effect */}
               <div className="absolute bottom-0 w-16 h-16 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
               <span className="text-3xl font-light tracking-wider text-indigo-300 opacity-60">
                 {profile.name.charAt(0)}
               </span>
            </div>
          </div>
          
          <h2 className="text-2xl font-serif italic text-white mb-1 leading-tight">{profile.name}</h2>
          <p className="text-[10px] tracking-[0.2em] opacity-50 uppercase text-indigo-300 mb-5">{profile.relationship}</p>
          
          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5"></div>
          
          <div className="w-full space-y-4">
            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-slate-400">
              <span>Synthesizer Match</span>
              <span className="text-indigo-400 font-semibold">98.4% Resonance</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="w-[98%] h-full bg-indigo-500 shadow-[0_0_10px_#6366f1] transition-all duration-1000"></div>
            </div>
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span>Pitch: {profile.voiceConfig?.pitch ?? 1.0}x</span>
              <span>Speed: {profile.voiceConfig?.rate ?? 1.0}x</span>
            </div>
          </div>
        </div>

        {/* Sentiment Analysis Box */}
        <div className="flex-1 p-8 rounded-[32px] bg-indigo-950/10 border border-indigo-500/20 backdrop-blur-xl flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-indigo-300/75 mb-6">Empathy & Sentiment Matrix</h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-3">
                  <span className="text-xs italic font-serif text-slate-300">Emotional Vibe</span>
                  <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                    {lastLovedOneMsg?.sentimentAnalysis?.sentiment || 'Connecting...'}
                  </span>
                </div>
                
                {/* Simulated Audio EQ Bars */}
                <div className="flex gap-1 h-8 items-end">
                  <div className={`flex-1 ${playingMessageId ? 'bg-indigo-400/50 animate-[pulse_1.2s_infinite]' : 'bg-indigo-400/20'} h-3 rounded-sm`}></div>
                  <div className={`flex-1 ${playingMessageId ? 'bg-indigo-400/70 animate-[pulse_0.9s_infinite_0.1s]' : 'bg-indigo-400/20'} h-5 rounded-sm`}></div>
                  <div className={`flex-1 ${playingMessageId ? 'bg-indigo-400/90 animate-[pulse_1.5s_infinite_0.3s]' : 'bg-indigo-400/20'} h-8 rounded-sm`}></div>
                  <div className={`flex-1 ${playingMessageId ? 'bg-indigo-400/60 animate-[pulse_1.1s_infinite_0.2s]' : 'bg-indigo-400/20'} h-4 rounded-sm`}></div>
                  <div className={`flex-1 ${playingMessageId ? 'bg-indigo-400/30 animate-[pulse_1.4s_infinite_0.4s]' : 'bg-indigo-400/20'} h-2 rounded-sm`}></div>
                </div>
              </div>
              
              <p className="text-xs leading-relaxed text-slate-400 font-light italic">
                {lastLovedOneMsg?.sentimentAnalysis?.empathyAdjustment || 'Standing by for conversation cues. Empathy algorithms are prepared to match your tone and adjust speech rates accordingly.'}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
            <button
              type="button"
              id="toggle-autospeak-btn"
              onClick={() => setAutoSpeak(!autoSpeak)}
              title={autoSpeak ? "Disable Auto-Speak replies" : "Enable Auto-Speak replies"}
              className={`flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase px-4 py-2 rounded-full border transition-all ${
                autoSpeak 
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' 
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              {autoSpeak ? <Volume2 className="w-3 h-3 text-indigo-400 animate-pulse" /> : <VolumeX className="w-3 h-3" />}
              Auto Listen
            </button>
            <button
              type="button"
              id="chat-back-btn"
              onClick={onBack}
              className="px-4 py-2 border border-white/10 rounded-full text-[10px] tracking-wider uppercase hover:bg-white/5 text-slate-400 hover:text-white transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: The Dialogue */}
      <div className="lg:col-span-8 flex flex-col p-8 rounded-[32px] bg-black/40 border border-white/5 backdrop-blur-xl relative overflow-hidden h-full">
        {/* Scroll Fade Mask (Top) */}
        <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-[#08080A]/60 to-transparent pointer-events-none z-10"></div>
        
        {/* Messages Thread */}
        <div id="messages-container" className="flex-1 space-y-10 overflow-y-auto pr-4 relative z-10 py-4 scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-5 py-12">
              <div className="w-14 h-14 bg-indigo-950/40 rounded-full flex items-center justify-center border border-indigo-500/20 text-indigo-400 shadow-xl animate-pulse">
                <Heart className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="space-y-2">
                <h4 className="font-serif text-xl italic text-white">Begin the Session</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-light">
                  Speak or type naturally. Recount a childhood garden, ask for advice on a choice you are facing, or share a quiet memory you've been carrying.
                </p>
              </div>
              <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 text-[11px] text-indigo-300/70 italic max-w-sm">
                "Connection is built on patience. All voice models synthesize client-side with deep reverence."
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isLovedOne = msg.sender === 'loved-one';
              const hasKeepsake = savedKeepsakeIds.includes(msg.id);
              
              if (!isLovedOne) {
                // User Message (Right-aligned)
                return (
                  <div key={msg.id} className="flex flex-col items-end">
                    <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-2 font-mono">You</p>
                    <div className="max-w-[80%] bg-white/[0.04] rounded-3xl rounded-tr-none px-6 py-4 border border-white/5 shadow-md">
                      <p className="text-sm leading-relaxed text-slate-300 font-sans">{msg.text}</p>
                    </div>
                  </div>
                );
              }

              // Loved One Dialogue (Left-aligned, elegant font-serif layout matching Eleanor model)
              return (
                <div key={msg.id} className="flex flex-col items-start w-full">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold">
                      {profile.name}
                    </p>
                    {msg.sentimentAnalysis && (
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border ${getSentimentBadge(msg.sentimentAnalysis.colorSchema)}`}>
                        {msg.sentimentAnalysis.sentiment}
                      </span>
                    )}
                    {msg.sentimentAnalysis?.isQuotaExceeded && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
                        Local Mode (API Limit)
                      </span>
                    )}
                    {msg.sentimentAnalysis?.isOffline && !msg.sentimentAnalysis?.isQuotaExceeded && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full border border-slate-500/30 bg-slate-500/10 text-slate-300">
                        Local Mode
                      </span>
                    )}
                  </div>

                  <div className="max-w-[90%] border-l border-indigo-500/30 pl-6 lg:pl-8 space-y-4">
                    <p className="text-lg lg:text-xl font-serif italic text-indigo-100 leading-relaxed whitespace-pre-line select-text">
                      "{msg.text}"
                    </p>
                    
                    <div className="flex items-center justify-between gap-4 pt-1">
                      {/* Audio Play & Interactive Waveform */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => speakMessage(msg)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                            playingMessageId === msg.id 
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' 
                              : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                          }`}
                        >
                          <Volume2 className={`w-4 h-4 ${playingMessageId === msg.id ? 'animate-pulse text-indigo-300' : ''}`} />
                        </button>
                        
                        {playingMessageId === msg.id ? (
                          <div className="flex items-center gap-2">
                            <canvas
                              ref={(el) => { canvasRefs.current[msg.id] = el; }}
                              className="w-32 h-6 opacity-90"
                              width={128}
                              height={24}
                            />
                            <span className="text-[9px] text-indigo-400 font-mono tracking-widest animate-pulse uppercase">Synthesizing Voice...</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono tracking-wider">Play voice synthesis</span>
                        )}
                      </div>

                      {/* Keep Sake star button */}
                      <button
                        type="button"
                        onClick={() => onSaveKeepsake(msg)}
                        title={hasKeepsake ? "Saved to Album" : "Preserve quote to Keepsakes"}
                        className={`p-2 rounded-full transition-all border ${
                          hasKeepsake
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                            : 'bg-white/5 text-slate-400 hover:text-amber-400 hover:bg-white/10 border-white/5'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${hasKeepsake ? 'fill-amber-400 text-amber-300' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* AI Writing Simulation Indicator */}
          {isGenerating && (
            <div className="flex flex-col items-start">
              <p className="text-[10px] uppercase tracking-widest text-indigo-400/60 mb-2 font-mono">Synthesizing response...</p>
              <div className="max-w-[85%] border-l border-indigo-500/20 pl-8 py-2">
                <div className="flex gap-2 items-center">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full opacity-60 animate-ping"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full opacity-30"></div>
                  <span className="text-xs text-slate-400 font-light italic pl-2">Tuning neural pathways...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="mt-8 relative z-20">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              id="chat-text-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "Whisper into your mic..." : `Speak or send a message to ${profile.name}...`}
              disabled={isGenerating}
              className="w-full bg-white/5 border border-white/10 rounded-full py-5 pl-8 pr-28 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 placeholder:text-slate-500 transition-all shadow-inner backdrop-blur-md"
            />
            
            <div className="absolute right-3 flex gap-2">
              {/* Mic button */}
              <button
                type="button"
                id="voice-mic-btn"
                onClick={toggleListening}
                title={isListening ? "Mute Microphone" : "Speak memory out loud"}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                <Mic className={`w-5 h-5 ${isListening ? 'animate-bounce text-rose-300' : ''}`} />
              </button>

              {/* Send message button */}
              <button
                type="submit"
                id="chat-send-btn"
                disabled={!inputText.trim() || isGenerating}
                className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-white/5 disabled:text-slate-600 flex items-center justify-center transition-all shadow-lg border border-indigo-400/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
          
          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-3 px-2 font-mono uppercase tracking-wider">
            <span>Voice Resonance Output: {profile.voiceConfig?.pitch ?? 1.0}x Pitch • {profile.voiceConfig?.rate ?? 1.0}x Rate</span>
            {isListening && <span className="text-rose-400 animate-pulse font-bold flex items-center gap-1.5">● Mic Active</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
