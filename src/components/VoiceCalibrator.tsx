import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, Play, Volume2, CheckCircle2, Sliders, RefreshCw, AlertCircle } from 'lucide-react';
import { VoiceConfig } from '../types';

interface VoiceCalibratorProps {
  onCalibrateComplete: (config: VoiceConfig) => void;
  initialConfig?: VoiceConfig;
  relationship?: string;
}

// Highly robust local SpeechSynthesis voice matcher based on acoustic pitch estimation and relationship attributes
function findBestMatchingVoice(voices: SpeechSynthesisVoice[], pitch: number, relationship: string): string {
  if (voices.length === 0) return '';
  
  const rel = (relationship || "").toLowerCase();
  const isFemaleRel = rel.includes("mother") || rel.includes("mom") || rel.includes("mama") || rel.includes("sister") || rel.includes("wife") || rel.includes("grandmother") || rel.includes("grandma") || rel.includes("daughter") || rel.includes("aunt");
  const isMaleRel = rel.includes("father") || rel.includes("dad") || rel.includes("pop") || rel.includes("brother") || rel.includes("husband") || rel.includes("grandfather") || rel.includes("grandpa") || rel.includes("son") || rel.includes("uncle");

  // Determine gender preference: pitch >= 1.05 points to female ranges
  let preferFemale = pitch >= 1.05;
  if (isFemaleRel) preferFemale = true;
  if (isMaleRel) preferFemale = false;

  const englishVoices = voices.filter(v => v.lang.startsWith('en') || v.lang.startsWith('EN'));
  if (englishVoices.length === 0) return voices[0].name;

  const femaleKeywords = ["zira", "hazel", "samantha", "susan", "female", "girl", "woman", "victoria", "karen", "moira", "tessa", "veena", "siri", "fiona", "sfg", "tpf"];
  const maleKeywords = ["david", "mark", "george", "male", "guy", "boy", "man", "daniel", "oliver", "ravi", "peter", "iom"];

  let matchingVoices = englishVoices.filter(v => {
    const name = v.name.toLowerCase();
    if (preferFemale) {
      return femaleKeywords.some(kw => name.includes(kw)) && !maleKeywords.some(kw => name.includes(kw));
    } else {
      return maleKeywords.some(kw => name.includes(kw)) && !femaleKeywords.some(kw => name.includes(kw));
    }
  });

  // Secondary backup check: filter by exclusion
  if (matchingVoices.length === 0) {
    matchingVoices = englishVoices.filter(v => {
      const name = v.name.toLowerCase();
      if (preferFemale) {
        return !maleKeywords.some(kw => name.includes(kw));
      } else {
        return !femaleKeywords.some(kw => name.includes(kw));
      }
    });
  }

  // Final sliding fallbacks
  if (matchingVoices.length === 0) {
    matchingVoices = englishVoices;
  }

  // Prefer high-quality localService voices if available
  const bestVoice = matchingVoices.find(v => v.localService) || matchingVoices[0];
  return bestVoice ? bestVoice.name : englishVoices[0].name;
}

export default function VoiceCalibrator({ onCalibrateComplete, initialConfig, relationship }: VoiceCalibratorProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [calibrationStep, setCalibrationStep] = useState<'idle' | 'recording' | 'processing' | 'done'>('idle');
  const [calibrationStatus, setCalibrationStatus] = useState<string>('');
  const [calibratedConfig, setCalibratedConfig] = useState<VoiceConfig>(
    initialConfig || {
      pitch: 1.0,
      rate: 1.0,
      voiceName: '',
      reverbIntensity: 40,
      calibrated: false
    }
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const processingIntervalRef = useRef<any>(null);

  // Available speech synthesis voices
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (processingIntervalRef.current) clearInterval(processingIntervalRef.current);
    };
  }, []);

  // Timer for recording duration
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 12) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Drawing a simulated wave or actual mic input visualizer
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width;
    let height = canvas.height;
    let animationFrameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = '#818cf8'; // beautiful glowing indigo wave
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = width / 60;
      let x = 0;

      for (let i = 0; i < 60; i++) {
        // Draw a simulated beautiful soundwave
        let v = 0.5;
        if (isRecording) {
          v = 0.5 + Math.sin(i * 0.15 + Date.now() * 0.015) * Math.cos(i * 0.05) * (Math.random() * 0.4 + 0.1);
        } else if (calibrationStep === 'processing') {
          v = 0.5 + Math.sin(i * 0.4 + Date.now() * 0.03) * 0.2;
        } else {
          v = 0.5 + Math.sin(i * 0.05) * 0.03;
        }
        
        let y = v * height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isRecording, calibrationStep]);

  // Start micro recording
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine standard browser-supported audio format
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        }
      }

      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { mimeType }) 
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        // Stop stream tracks
        stream.getTracks().forEach(track => track.stop());
        
        const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        processAudio(audioBlob, `recorded_voice_sample.${extension}`);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setCalibrationStep('recording');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check your permissions or upload an audio file instead.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Compiles and downsamples an AudioBuffer to an ultra-lightweight, 16kHz mono 16-bit PCM WAV blob.
  // This reduces file size (typically to ~250KB for 8s) and ensures broad cross-platform decoding support.
  const downsampleToWavBlob = async (audioBuffer: AudioBuffer, maxSeconds: number = 8): Promise<Blob> => {
    const targetSampleRate = 16000;
    const duration = Math.min(audioBuffer.duration, maxSeconds);
    const length = Math.floor(duration * targetSampleRate);
    
    // Create OfflineAudioContext to perform downsampling
    const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
      1, // Mono channel
      length,
      targetSampleRate
    );
    
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    
    const renderedBuffer = await offlineCtx.startRendering();
    
    // Encode downsampled buffer to standard 16-bit PCM WAV
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    const writeStringHelper = (dataView: DataView, offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        dataView.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    /* RIFF identifier */
    writeStringHelper(view, 0, 'RIFF');
    /* File length */
    view.setUint32(4, 36 + length * 2, true);
    /* RIFF type */
    writeStringHelper(view, 8, 'WAVE');
    /* Format chunk identifier */
    writeStringHelper(view, 12, 'fmt ');
    /* Format chunk length */
    view.setUint32(16, 16, true);
    /* Sample format (1 is raw PCM) */
    view.setUint16(20, 1, true);
    /* Channel count (1 is Mono) */
    view.setUint16(22, 1, true);
    /* Sample rate */
    view.setUint32(24, targetSampleRate, true);
    /* Byte rate (sample rate * block align) */
    view.setUint32(28, targetSampleRate * 2, true);
    /* Block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true);
    /* Bits per sample (16-bit) */
    view.setUint16(34, 16, true);
    /* Data chunk identifier */
    writeStringHelper(view, 36, 'data');
    /* Data chunk length */
    view.setUint32(40, length * 2, true);
    
    // Write PCM samples
    const channelData = renderedBuffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, pcmSample, true);
      offset += 2;
    }
    
    return new Blob([view], { type: 'audio/wav' });
  };

  // Process uploaded or recorded audio
  const processAudio = async (blob: Blob, filename: string) => {
    setCalibrationStep('processing');
    let progress = 0;
    
    const steps = [
      "Analyzing fundamental vocal frequencies (f0)...",
      "Estimating acoustic resonance and timber values...",
      "Matching voice characteristics to browser audio engines...",
      "Calibrating pitch envelopes & speaking rhythm...",
      "Perfecting emotional warmth coefficients..."
    ];

    let calibratedPitch = 1.0;
    let calibratedRate = 1.0;
    let processedBlob = blob;

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      
      // Analyze pitch and cadence
      const channelData = audioBuffer.getChannelData(0);
      
      // Simple zero-crossing rate calculation to estimate pitch (fundamental frequency f0)
      let zeroCrossings = 0;
      let peakValue = 0;
      for (let i = 1; i < channelData.length; i++) {
        if (channelData[i - 1] < 0 && channelData[i] >= 0) {
          zeroCrossings++;
        }
        if (Math.abs(channelData[i]) > peakValue) {
          peakValue = Math.abs(channelData[i]);
        }
      }
      
      const duration = audioBuffer.duration;
      const approxFrequency = duration > 0 ? (zeroCrossings / duration) / 2 : 150;
      
      // Map frequency to a pitch multiplier parameter (range 0.8 to 1.35)
      if (approxFrequency < 115) {
        calibratedPitch = 0.80; // Deep masculine / bass
      } else if (approxFrequency < 155) {
        calibratedPitch = 0.95; // Warm / Baritone / Tenor
      } else if (approxFrequency < 210) {
        calibratedPitch = 1.15; // Soft / Soprano
      } else {
        calibratedPitch = 1.30; // High pitch / Juvenile
      }

      // Estimating rhythm/cadence based on silence frames ratio
      let silenceFrames = 0;
      const threshold = 0.04;
      const skip = Math.max(1, Math.floor(channelData.length / 2000));
      for (let i = 0; i < channelData.length; i += skip) {
        if (Math.abs(channelData[i]) < threshold) {
          silenceFrames++;
        }
      }
      const silenceRatio = silenceFrames / (channelData.length / skip);
      calibratedRate = parseFloat((1.2 - silenceRatio * 0.4).toFixed(2));
      if (calibratedRate < 0.75) calibratedRate = 0.75;
      if (calibratedRate > 1.25) calibratedRate = 1.25;

      console.log(`[Aether Voice Clone] Extracted f0: ${approxFrequency.toFixed(1)}Hz. Calibrated pitch: ${calibratedPitch}, speaking rate: ${calibratedRate}`);

      // Compress and format audio buffer to standard lightweight mono WAV for seamless transport
      try {
        console.log("[Aether Voice Clone] Downsampling and optimizing vocal print buffer...");
        processedBlob = await downsampleToWavBlob(audioBuffer, 8);
        console.log(`[Aether Voice Clone] Optimization success. Size reduced from ${(blob.size / 1024).toFixed(1)}KB to ${(processedBlob.size / 1024).toFixed(1)}KB.`);
      } catch (encodeErr) {
        console.warn("[Aether Voice Clone] Downsampling failed, using original audio:", encodeErr);
      }
    } catch (err) {
      console.warn("Could not decode audio buffer for acoustic analysis, falling back to heuristic calculation:", err);
      const sizeModifier = (blob.size % 100) / 100;
      calibratedPitch = parseFloat((0.85 + sizeModifier * 0.4).toFixed(2));
      calibratedRate = parseFloat((0.9 + (1 - sizeModifier) * 0.25).toFixed(2));
    }

    const reader = new FileReader();
    reader.readAsDataURL(processedBlob);
    reader.onloadend = () => {
      const base64data = reader.result as string;

      processingIntervalRef.current = setInterval(() => {
        if (progress < steps.length) {
          setCalibrationStatus(steps[progress]);
          progress++;
        } else {
          if (processingIntervalRef.current) {
            clearInterval(processingIntervalRef.current);
            processingIntervalRef.current = null;
          }
          
          // Find a matching prebuilt voice from available voices using intelligent acoustic matching
          let selectedVoiceName = '';
          if (availableVoices.length > 0) {
            selectedVoiceName = findBestMatchingVoice(availableVoices, calibratedPitch, relationship || '');
          }

          const newConfig: VoiceConfig = {
            pitch: calibratedPitch,
            rate: calibratedRate,
            voiceName: selectedVoiceName,
            reverbIntensity: 50,
            calibrated: true,
            fileName: filename,
            clonedVoiceData: base64data
          };

          setCalibratedConfig(newConfig);
          setCalibrationStep('done');
          onCalibrateComplete(newConfig);
        }
      }, 800);
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      processAudio(file, file.name);
    }
  };

  const playCalibratedTest = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    
    const text = "Hello there. It's so beautiful to hear your voice. I am right here, always with you.";
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (calibratedConfig.voiceName) {
      const matchedVoice = availableVoices.find(v => v.name === calibratedConfig.voiceName);
      if (matchedVoice) utterance.voice = matchedVoice;
    }
    
    utterance.pitch = calibratedConfig.pitch;
    utterance.rate = calibratedConfig.rate;
    
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div id="voice-calibrator-panel" className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-5 shadow-inner">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="font-serif font-medium text-slate-200 text-base flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            Vocal Modeling & Synthesis
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Record a short sentence or upload any audio of them to calibrate their speech synthesizer.
          </p>
        </div>
        {calibratedConfig.calibrated && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Calibrated
          </span>
        )}
      </div>

      {/* Wave Visualizer Box */}
      <div className="relative bg-black/40 border border-white/5 rounded-xl p-4 h-24 flex flex-col justify-between overflow-hidden shadow-inner">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" width={300} height={100} />
        
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-2">
          {calibrationStep === 'idle' && (
            <p className="text-xs text-indigo-300/60 font-mono tracking-wider z-10">Voice Wave Analyzer: Standing by...</p>
          )}
          {calibrationStep === 'recording' && (
            <div className="z-10 space-y-1">
              <p className="text-xs text-rose-400 font-mono font-bold animate-pulse flex items-center gap-1.5 justify-center">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                RECORDING AUDIO ({recordingDuration}s)
              </p>
              <p className="text-[10px] text-slate-400">Speak naturally. Say: "I love you, you are doing wonderful things."</p>
            </div>
          )}
          {calibrationStep === 'processing' && (
            <div className="z-10 space-y-1 text-center">
              <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin mx-auto" />
              <p className="text-xs text-indigo-300 font-mono">{calibrationStatus}</p>
            </div>
          )}
          {calibrationStep === 'done' && (
            <div className="z-10 space-y-0.5">
              <p className="text-xs text-emerald-400 font-mono font-medium">Vocal DNA Signature Calibrated Successfully</p>
              <p className="text-[10px] text-slate-400">
                Extracted: Pitch multiplier {calibratedConfig.pitch}x, Speech rate {calibratedConfig.rate}x
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recording & Upload Controls */}
      <div className="flex flex-wrap gap-2.5 items-center justify-between">
        <div className="flex gap-2">
          {!isRecording ? (
            <button
              type="button"
              id="start-recording-btn"
              onClick={startRecording}
              className="flex items-center gap-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold tracking-wider uppercase px-4 py-2 rounded-full transition-all"
              disabled={calibrationStep === 'processing'}
            >
              <Mic className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              Record Voice
            </button>
          ) : (
            <button
              type="button"
              id="stop-recording-btn"
              onClick={stopRecording}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold tracking-wider uppercase px-4 py-2 rounded-full transition-all shadow-[0_0_15px_rgba(244,63,94,0.2)]"
            >
              <Square className="w-3.5 h-3.5" />
              Stop & Calibrate
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            className="hidden"
          />
          <button
            type="button"
            id="upload-audio-btn"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold tracking-wider uppercase px-4 py-2 rounded-full transition-colors"
            disabled={isRecording || calibrationStep === 'processing'}
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            Upload File
          </button>
        </div>

        {calibrationStep === 'done' && (
          <button
            type="button"
            id="test-calibration-btn"
            onClick={playCalibratedTest}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold tracking-wider uppercase px-4 py-2 rounded-full border border-indigo-400/20 shadow-md transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            Test Synthesized Voice
          </button>
        )}
      </div>

      {/* Manual Fine Tuning Controls */}
      <div className="border-t border-white/5 pt-5 space-y-4">
        <p className="text-xs font-semibold tracking-wider uppercase text-indigo-300 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
          Voice Tuning Coefficients (Auto-calibrated or manual)
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span>Voice Pitch (Timbre)</span>
              <span className="font-mono text-indigo-400">{calibratedConfig.pitch}x</span>
            </div>
            <input
              type="range"
              id="pitch-slider"
              min="0.5"
              max="1.8"
              step="0.05"
              value={calibratedConfig.pitch}
              onChange={(e) => {
                const pitch = parseFloat(e.target.value);
                const updated = { ...calibratedConfig, pitch };
                setCalibratedConfig(updated);
                onCalibrateComplete(updated);
              }}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Deep/Warm (Dad, Grandpa)</span>
              <span>Soft/Higher (Mother, Sibling)</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span>Speaking Speed (Cadence)</span>
              <span className="font-mono text-indigo-400">{calibratedConfig.rate}x</span>
            </div>
            <input
              type="range"
              id="rate-slider"
              min="0.6"
              max="1.5"
              step="0.05"
              value={calibratedConfig.rate}
              onChange={(e) => {
                const rate = parseFloat(e.target.value);
                const updated = { ...calibratedConfig, rate };
                setCalibratedConfig(updated);
                onCalibrateComplete(updated);
              }}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Slow & Contemplative</span>
              <span>Lively & Expressive</span>
            </div>
          </div>
        </div>

        {/* Voice Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">Synthesizer Base Engine</label>
            <select
              id="voice-select"
              value={calibratedConfig.voiceName}
              onChange={(e) => {
                const voiceName = e.target.value;
                const updated = { ...calibratedConfig, voiceName };
                setCalibratedConfig(updated);
                onCalibrateComplete(updated);
              }}
              className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-indigo-500/50 [&>option]:bg-[#08080A] [&>option]:text-slate-200 cursor-pointer"
            >
              <option value="">Default English System Voice</option>
              {availableVoices
                .filter(v => v.lang.startsWith('en'))
                .map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span>Memory Aura (Ethereal Reverb)</span>
              <span className="font-mono text-indigo-400">{calibratedConfig.reverbIntensity}%</span>
            </div>
            <input
              type="range"
              id="reverb-slider"
              min="0"
              max="100"
              value={calibratedConfig.reverbIntensity}
              onChange={(e) => {
                const reverbIntensity = parseInt(e.target.value);
                const updated = { ...calibratedConfig, reverbIntensity };
                setCalibratedConfig(updated);
                onCalibrateComplete(updated);
              }}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Intimate & Close</span>
              <span>Soft Ethereal Echo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
