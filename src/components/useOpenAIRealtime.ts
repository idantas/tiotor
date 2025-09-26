import { useState, useEffect, useRef, useCallback } from 'react';

export interface RealtimeConfig {
  apiKey: string;
  model?: string;
  voice?: string;
  instructions?: string;
  onSpeechStart?: () => void;
  onSpeechEnd?: (transcript: string) => void;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface RealtimeState {
  isConnected: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  transcript: string;
  error: string | null;
  isMuted: boolean;
  isAutoMuted: boolean;
}

export function useOpenAIRealtime(config: RealtimeConfig) {
  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    isRecording: false,
    isSpeaking: false,
    audioLevel: 0,
    transcript: '',
    error: null,
    isMuted: false,
    isAutoMuted: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isConnecting = useRef(false);
  const transcriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldDetectSpeech = useRef(true); // Control whether to detect user speech
  const assistantSpeaking = useRef(false); // Track if assistant is currently speaking
  const audioPlaybackRef = useRef<AudioContext | null>(null);
  const lastRequestTime = useRef(0);
  const requestQueue = useRef<Array<() => void>>([]);
  const isProcessingQueue = useRef(false);
  const isMutedRef = useRef(false);
  
  // Audio queue for sequential playback
  const audioQueue = useRef<Float32Array[]>([]);
  const isPlayingAudio = useRef<boolean>(false);
  const audioScheduleTime = useRef<number>(0);
  const autoMutedRef = useRef(false); // Track if user is auto-muted due to assistant speaking

  // Function to play audio chunks sequentially
  const playAudioSequentially = useCallback((audioData: Float32Array) => {
    if (!audioPlaybackRef.current) return;
    
    // Add to queue
    audioQueue.current.push(audioData);
    
    // Start playing if not already playing
    if (!isPlayingAudio.current) {
      processAudioQueue();
    }
  }, []);

  const processAudioQueue = useCallback(() => {
    if (!audioPlaybackRef.current || audioQueue.current.length === 0) {
      isPlayingAudio.current = false;
      return;
    }
    
    isPlayingAudio.current = true;
    const audioData = audioQueue.current.shift()!;
    
    try {
      // Create audio buffer
      const audioBuffer = audioPlaybackRef.current.createBuffer(1, audioData.length, 24000);
      audioBuffer.getChannelData(0).set(audioData);
      
      const source = audioPlaybackRef.current.createBufferSource();
      source.buffer = audioBuffer;
      
      // Add gain control for better volume management
      const gainNode = audioPlaybackRef.current.createGain();
      gainNode.gain.setValueAtTime(1.5, audioPlaybackRef.current.currentTime);
      
      source.connect(gainNode);
      gainNode.connect(audioPlaybackRef.current.destination);
      
      // Calculate when to start the next chunk
      const currentTime = audioPlaybackRef.current.currentTime;
      const startTime = Math.max(currentTime, audioScheduleTime.current);
      const duration = audioBuffer.duration;
      
      // Schedule this chunk
      source.start(startTime);
      
      // Update schedule time for next chunk
      audioScheduleTime.current = startTime + duration;
      
      console.log(`🔊 Playing audio chunk: ${audioData.length} samples, duration: ${duration.toFixed(3)}s, scheduled at: ${startTime.toFixed(3)}s`);
      
      // When this chunk ends, process the next one
      source.onended = () => {
        // Small delay to avoid clicking sounds
        setTimeout(() => {
          processAudioQueue();
        }, 10);
      };
      
    } catch (error) {
      console.error('Error playing audio chunk:', error);
      isPlayingAudio.current = false;
    }
  }, []);

  const clearAudioQueue = useCallback(() => {
    audioQueue.current = [];
    isPlayingAudio.current = false;
    audioScheduleTime.current = 0;
    console.log('🔇 Audio queue cleared');
  }, []);

  const initializeAudioContexts = useCallback(async () => {
    try {
      // Create audio context for input - this will be in suspended state initially
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        console.log(`Input AudioContext created with state: ${audioContextRef.current.state}`);
      }
      
      // Create separate audio context for output playback - this will be in suspended state initially
      if (!audioPlaybackRef.current) {
        audioPlaybackRef.current = new AudioContext({ sampleRate: 24000 });
        console.log(`Playback AudioContext created with state: ${audioPlaybackRef.current.state}`);
      }
      
      // Force resume audio contexts with user interaction
      if (audioContextRef.current.state !== 'running') {
        await audioContextRef.current.resume();
        console.log(`Input audio context resumed to: ${audioContextRef.current.state}`);
      }
      
      if (audioPlaybackRef.current.state !== 'running') {
        await audioPlaybackRef.current.resume();
        console.log(`Playback audio context resumed to: ${audioPlaybackRef.current.state}`);
      }
      
      // Set up context state change listeners to maintain running state
      audioPlaybackRef.current.onstatechange = () => {
        console.log(`Playback AudioContext state changed to: ${audioPlaybackRef.current?.state}`);
        if (audioPlaybackRef.current?.state === 'suspended') {
          console.log('Playback context suspended, attempting to resume...');
          audioPlaybackRef.current.resume().catch(error => {
            console.error('Failed to auto-resume playback context:', error);
          });
        }
      };
      
      audioContextRef.current.onstatechange = () => {
        console.log(`Input AudioContext state changed to: ${audioContextRef.current?.state}`);
      };
      
      console.log(`Audio contexts initialized - Input: ${audioContextRef.current.state}, Playback: ${audioPlaybackRef.current.state}`);
    } catch (error) {
      console.error('Error initializing audio contexts:', error);
      throw error;
    }
  }, []);

  const connect = useCallback(async () => {
    if (isConnecting.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isConnecting.current = true;

    try {
      // Initialize audio contexts first
      await initializeAudioContexts();
      
      // Get media stream with advanced noise cancellation
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          // Standard Web Audio API constraints
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Advanced Chrome-specific constraints for better noise cancellation
          googEchoCancellation: true,
          googEchoCancellation2: true,
          googAutoGainControl: true,
          googAutoGainControl2: true,
          googNoiseSuppression: true,
          googNoiseSuppression2: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googBeamforming: true,
          googArrayGeometry: true,
          googAudioMirroring: false,
          googDAEchoCancellation: true,
          googNoiseReduction: true,
          // Advanced noise suppression settings
          advanced: [
            { googEchoCancellation: { exact: true } },
            { googNoiseSuppression: { exact: true } },
            { googAutoGainControl: { exact: true } },
            { googHighpassFilter: { exact: true } },
            { googTypingNoiseDetection: { exact: true } },
            { googAudioProcessing: { exact: true } }
          ]
        }
      });
      
      mediaStreamRef.current = stream;
      
      // Connect to OpenAI Realtime API
      const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', [
        'realtime',
        `openai-insecure-api-key.${config.apiKey}`,
        'openai-beta.realtime-v1',
      ]);

      ws.onopen = () => {
        console.log('Connected to OpenAI Realtime API');
        
        // Configure session - MINIMAL configuration for testing
        console.log('🔧 Configuring session...');
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: config.instructions || 'You are a helpful assistant.',
            voice: config.voice || 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: null,
            tools: [],
            tool_choice: 'none',
            temperature: 0.8
          }
        }));
        
        console.log('✅ Session configuration sent');

        setState(prev => ({ ...prev, isConnected: true, error: null }));
        setupAudioProcessing(stream, ws);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleRealtimeMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({ ...prev, error: 'Connection error', isConnected: false }));
        config.onError?.(new Error('WebSocket connection failed'));
      };

      ws.onclose = () => {
        console.log('Disconnected from OpenAI Realtime API');
        setState(prev => ({ ...prev, isConnected: false }));
        cleanup();
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect to Realtime API:', error);
      setState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Connection failed' }));
      config.onError?.(error instanceof Error ? error : new Error('Connection failed'));
    } finally {
      isConnecting.current = false;
    }
  }, [config.apiKey, config.instructions, config.voice, config.onError]);

  const setupAudioProcessing = (stream: MediaStream, ws: WebSocket) => {
    if (!audioContextRef.current) return;

    const source = audioContextRef.current.createMediaStreamSource(stream);
    
    // Create advanced noise reduction filters
    const highpassFilter = audioContextRef.current.createBiquadFilter();
    highpassFilter.type = 'highpass';
    highpassFilter.frequency.setValueAtTime(100, audioContextRef.current.currentTime); // Remove low-frequency noise
    highpassFilter.Q.setValueAtTime(0.7, audioContextRef.current.currentTime);
    
    const lowpassFilter = audioContextRef.current.createBiquadFilter();
    lowpassFilter.type = 'lowpass';
    lowpassFilter.frequency.setValueAtTime(8000, audioContextRef.current.currentTime); // Remove high-frequency noise
    lowpassFilter.Q.setValueAtTime(0.7, audioContextRef.current.currentTime);
    
    // Notch filter to remove specific frequency noise (like AC hum at 60Hz)
    const notchFilter = audioContextRef.current.createBiquadFilter();
    notchFilter.type = 'notch';
    notchFilter.frequency.setValueAtTime(60, audioContextRef.current.currentTime); // Remove 60Hz hum
    notchFilter.Q.setValueAtTime(30, audioContextRef.current.currentTime); // High Q for narrow notch
    
    // Compressor for dynamic range control and noise gating
    const compressor = audioContextRef.current.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, audioContextRef.current.currentTime);
    compressor.knee.setValueAtTime(30, audioContextRef.current.currentTime);
    compressor.ratio.setValueAtTime(12, audioContextRef.current.currentTime);
    compressor.attack.setValueAtTime(0.003, audioContextRef.current.currentTime);
    compressor.release.setValueAtTime(0.25, audioContextRef.current.currentTime);
    
    // Gain node for fine-tuning volume
    const gainNode = audioContextRef.current.createGain();
    gainNode.gain.setValueAtTime(1.2, audioContextRef.current.currentTime); // Slight boost
    
    const processor = audioContextRef.current.createScriptProcessor(8192, 1, 1);
    
    // Connect the audio processing chain
    source
      .connect(highpassFilter)
      .connect(notchFilter)
      .connect(lowpassFilter)
      .connect(compressor)
      .connect(gainNode)
      .connect(processor);
    
    let audioBufferSize = 0;
    let speechDetectionBuffer = [];
    let consecutiveSilentFrames = 0;
    let consecutiveSpeechFrames = 0;
    let isSpeechDetected = false;
    let speechEndTimer = null;
    let noiseFloor = 0.001; // Dynamic noise floor
    let noiseFloorHistory = []; // Track noise floor over time
    let signalHistory = []; // Track signal levels for adaptive threshold
    
    const minBufferSizeMs = 500;
    const sampleRate = 24000;
    const minBufferSamples = (minBufferSizeMs / 1000) * sampleRate;
    let speechThreshold = 0.015; // Base threshold, will be adaptive
    let silenceThreshold = 0.005; // Base silence threshold, will be adaptive
    const speechStartFrames = 6;
    const speechEndFrames = 25;
    const noiseFloorUpdateRate = 0.95; // Smoothing factor for noise floor updates
    
    processor.onaudioprocess = (event) => {
      if (ws.readyState === WebSocket.OPEN) {
        const inputBuffer = event.inputBuffer.getChannelData(0);
        
        // Advanced audio analysis for noise reduction
        const inputArray = Array.from(inputBuffer);
        
        // Calculate RMS (Root Mean Square) for better amplitude measurement
        const rms = Math.sqrt(inputArray.reduce((acc, val) => acc + val * val, 0) / inputArray.length);
        
        // Calculate spectral centroid (frequency distribution) to distinguish speech from noise
        let spectralCentroid = 0;
        const fftSize = Math.min(1024, inputBuffer.length);
        const windowedSignal = inputArray.slice(0, fftSize);
        
        // Simple spectral analysis
        let totalMagnitude = 0;
        let weightedSum = 0;
        for (let i = 0; i < windowedSignal.length / 2; i++) {
          const magnitude = Math.abs(windowedSignal[i]);
          totalMagnitude += magnitude;
          weightedSum += magnitude * i;
        }
        if (totalMagnitude > 0) {
          spectralCentroid = weightedSum / totalMagnitude;
        }
        
        // Update noise floor estimate when no speech is detected
        if (!isSpeechDetected && rms > 0) {
          noiseFloorHistory.push(rms);
          if (noiseFloorHistory.length > 100) {
            noiseFloorHistory.shift();
          }
          
          // Calculate adaptive noise floor (use median to avoid outliers)
          const sortedNoiseFloor = [...noiseFloorHistory].sort((a, b) => a - b);
          const medianNoiseFloor = sortedNoiseFloor[Math.floor(sortedNoiseFloor.length / 2)] || 0.001;
          noiseFloor = noiseFloor * noiseFloorUpdateRate + medianNoiseFloor * (1 - noiseFloorUpdateRate);
        }
        
        // Adaptive thresholds based on noise floor and spectral characteristics
        const adaptiveSpeechThreshold = Math.max(0.008, noiseFloor * 3.5);
        const adaptiveSilenceThreshold = Math.max(0.003, noiseFloor * 1.8);
        
        // Enhanced speech detection using both amplitude and spectral features
        const amplitudeIndicator = rms > adaptiveSpeechThreshold;
        const spectralIndicator = spectralCentroid > 10 && spectralCentroid < 200; // Typical speech range
        const signalToNoiseRatio = rms / (noiseFloor + 0.001);
        const snrIndicator = signalToNoiseRatio > 2.5;
        
        // Combine indicators for robust speech detection
        const speechLikelihood = (amplitudeIndicator ? 0.4 : 0) + 
                                (spectralIndicator ? 0.3 : 0) + 
                                (snrIndicator ? 0.3 : 0);
        
        // Visual feedback using processed amplitude
        const visualLevel = Math.min(1, Math.max(0, (rms - noiseFloor) * 15));
        setState(prev => ({ ...prev, audioLevel: visualLevel }));
        
        // Only process if we should detect speech (not while assistant is speaking or muted)
        if (!shouldDetectSpeech.current || assistantSpeaking.current || isMutedRef.current || autoMutedRef.current) {
          return;
        }
        
        // Advanced speech detection using multiple indicators
        const isSpeechFrame = speechLikelihood > 0.6; // Require high confidence
        const isSilenceFrame = rms < adaptiveSilenceThreshold && speechLikelihood < 0.2;
        
        if (isSpeechFrame) {
          consecutiveSpeechFrames++;
          consecutiveSilentFrames = 0;
          
          // Speech started detection
          if (!isSpeechDetected && consecutiveSpeechFrames >= speechStartFrames) {
            isSpeechDetected = true;
            audioBufferSize = 0;
            console.log(`Adaptive speech started detected (SNR: ${signalToNoiseRatio.toFixed(2)}, Likelihood: ${speechLikelihood.toFixed(2)})`);
            setState(prev => ({ ...prev, isRecording: true }));
            config.onSpeechStart?.();
            
            if (speechEndTimer) {
              clearTimeout(speechEndTimer);
              speechEndTimer = null;
            }
          }
        } else if (isSilenceFrame) {
          consecutiveSilentFrames++;
          consecutiveSpeechFrames = Math.max(0, consecutiveSpeechFrames - 1); // Gradual decay
        } else {
          // Ambiguous signal - don't count as speech or silence
          consecutiveSpeechFrames = Math.max(0, consecutiveSpeechFrames - 0.5);
        }
        
        // Only process audio when speech is detected, above noise floor, and not muted (including auto-mute)
        if (isSpeechDetected && rms > (noiseFloor * 1.5) && !isMutedRef.current && !autoMutedRef.current) {
          audioBufferSize += inputBuffer.length;
          
          // Advanced audio preprocessing before sending
          const processedBuffer = new Float32Array(inputBuffer.length);
          
          // Apply noise gate and normalization
          for (let i = 0; i < inputBuffer.length; i++) {
            let sample = inputBuffer[i];
            
            // Noise gate: suppress signals below threshold
            if (Math.abs(sample) < noiseFloor * 2) {
              sample *= 0.1; // Heavily attenuate noise
            }
            
            // Soft compression to prevent clipping while preserving dynamics
            const absSignal = Math.abs(sample);
            if (absSignal > 0.7) {
              const compressedSignal = 0.7 + (absSignal - 0.7) * 0.3;
              sample = Math.sign(sample) * compressedSignal;
            }
            
            processedBuffer[i] = sample;
          }
          
          // Convert processed audio to Int16Array for OpenAI
          const int16Buffer = new Int16Array(processedBuffer.length);
          for (let i = 0; i < processedBuffer.length; i++) {
            int16Buffer[i] = Math.max(-32768, Math.min(32767, processedBuffer[i] * 32768));
          }
          
          // Send audio to OpenAI
          try {
            ws.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: btoa(String.fromCharCode(...new Uint8Array(int16Buffer.buffer)))
            }));
          } catch (error) {
            console.error('Error sending audio buffer:', error);
          }
        }
        
        // Speech ended detection
        if (isSpeechDetected && consecutiveSilentFrames >= speechEndFrames) {
          if (!speechEndTimer) {
            speechEndTimer = setTimeout(() => {
              if (isSpeechDetected) {
                console.log('Manual speech ended detected');
                isSpeechDetected = false;
                consecutiveSpeechFrames = 0;
                consecutiveSilentFrames = 0;
                setState(prev => ({ ...prev, isRecording: false }));
                
                // Commit audio buffer if sufficient
                if (audioBufferSize >= minBufferSamples) {
                  console.log(`Committing audio buffer: ${audioBufferSize} samples`);
                  ws.send(JSON.stringify({
                    type: 'input_audio_buffer.commit'
                  }));
                  
                  // Set timeout for transcription
                  transcriptionTimeoutRef.current = setTimeout(() => {
                    console.log('Transcription timeout - proceeding without transcript');
                    config.onSpeechEnd?.('');
                  }, 8000); // Increased to 8 seconds
                } else {
                  console.log('Buffer too small, clearing');
                  ws.send(JSON.stringify({
                    type: 'input_audio_buffer.clear'
                  }));
                }
                
                audioBufferSize = 0;
                speechEndTimer = null;
              }
            }, 300); // 300ms delay after silence detection
          }
        }
      }
    };

    // Store references for cleanup
    processor.cleanup = () => {
      if (speechEndTimer) {
        clearTimeout(speechEndTimer);
        speechEndTimer = null;
      }
      audioBufferSize = 0;
      isSpeechDetected = false;
      consecutiveSilentFrames = 0;
      consecutiveSpeechFrames = 0;
      noiseFloor = 0.001;
      noiseFloorHistory = [];
      signalHistory = [];
    };

    // Complete the audio processing chain
    processor.connect(audioContextRef.current.destination);
    processorRef.current = processor;
    
    // Store all filter references for cleanup
    processor.audioFilters = {
      highpass: highpassFilter,
      lowpass: lowpassFilter,
      notch: notchFilter,
      compressor,
      gain: gainNode
    };
  };

  const handleRealtimeMessage = (message: any) => {
    // Log key messages for debugging
    const keyMessageTypes = [
      'session.created',
      'session.updated', 
      'response.created',
      'response.audio.delta',
      'response.audio.done',
      'response.done',
      'error'
    ];
    
    if (keyMessageTypes.includes(message.type)) {
      console.log(`🔊 [${message.type}]`, message);
    }
    
    switch (message.type) {
      case 'session.created':
        console.log('✅ Session created successfully');
        break;
        
      case 'session.updated':
        console.log('✅ Session updated successfully', message.session);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        const transcript = message.transcript || '';
        console.log('Transcription completed:', transcript);
        setState(prev => ({ ...prev, transcript }));
        
        // Clear transcription timeout
        if (transcriptionTimeoutRef.current) {
          clearTimeout(transcriptionTimeoutRef.current);
          transcriptionTimeoutRef.current = null;
        }
        
        // Always call onSpeechEnd with the transcript (even if empty)
        config.onSpeechEnd?.(transcript);
        break;

      case 'conversation.item.input_audio_transcription.failed':
        console.log('Transcription failed:', message.error);
        
        // Handle rate limiting specifically
        if (message.error?.message?.includes('429') || message.error?.message?.includes('Too Many Requests')) {
          console.warn('Rate limit hit - implementing longer backoff');
          // Increase minimum interval between requests more aggressively
          lastRequestTime.current = Date.now() + 20000; // Add 20 second penalty
          
          // Clear any pending audio buffer to avoid accumulation
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'input_audio_buffer.clear'
            }));
          }
          
          // Clear the request queue to prevent piling up requests
          requestQueue.current = [];
        }
        
        // Clear the transcript state and continue
        setState(prev => ({ ...prev, transcript: '', isRecording: false }));
        
        // Clear transcription timeout and proceed
        if (transcriptionTimeoutRef.current) {
          clearTimeout(transcriptionTimeoutRef.current);
          transcriptionTimeoutRef.current = null;
        }
        
        // Call onSpeechEnd with empty transcript to continue flow after a delay
        setTimeout(() => {
          config.onSpeechEnd?.('');
        }, 1000);
        break;

      case 'response.done':
        console.log('Response completely finished');
        
        // Check for failed responses with specific error handling
        if (message.response.status === 'failed' && message.response.status_details?.error) {
          const error = message.response.status_details.error;
          
          if (error.type === 'insufficient_quota') {
            console.error('💳 OpenAI API quota exceeded!');
            setState(prev => ({ 
              ...prev, 
              error: 'OpenAI API quota exceeded. Please check your billing details and add credits to your OpenAI account.' 
            }));
            config.onError?.(new Error('OpenAI API quota exceeded'));
            return;
          } else {
            console.error('❌ Response failed:', error);
            setState(prev => ({ 
              ...prev, 
              error: `OpenAI API error: ${error.message || 'Unknown error'}` 
            }));
            config.onError?.(new Error(error.message || 'OpenAI API error'));
            return;
          }
        }
        
        // Check if we received any audio during this response
        let hasAudioContent = false;
        let textContent = '';
        if (message.response && message.response.output) {
          message.response.output.forEach((item: any) => {
            if (item.type === 'audio') {
              hasAudioContent = true;
            }
            if (item.type === 'message') {
              if (item.content) {
                item.content.forEach((c: any) => {
                  if (c.type === 'audio') {
                    hasAudioContent = true;
                  }
                  if (c.type === 'text') {
                    textContent += c.text || '';
                  }
                });
              }
            }
          });
        }
        
        console.log(`✅ Response finished with audio content: ${hasAudioContent}`);
        if (textContent) console.log(`📝 Text content: "${textContent}"`);
        
        // Ensure speech detection is re-enabled and user is unmuted if auto-muted
        setTimeout(() => {
          assistantSpeaking.current = false;
          shouldDetectSpeech.current = true;
          
          // Final safety check to unmute user if auto-muted
          if (autoMutedRef.current) {
            autoMutedRef.current = false;
            setState(prev => ({ ...prev, isMuted: isMutedRef.current, isAutoMuted: false }));
            console.log('Final auto-unmute safety check completed');
          }
          
          console.log('Response done - re-enabled user speech detection');
        }, 800); // Longer delay for complete response
        break;

      case 'response.audio.delta':
        console.log('Received audio delta chunk');
        if (message.delta && audioPlaybackRef.current) {
          try {
            const playAudio = async () => {
              // Force ensure audio context is ready and resumed
              if (audioPlaybackRef.current!.state !== 'running') {
                console.log(`Audio context state: ${audioPlaybackRef.current!.state}, resuming...`);
                try {
                  await audioPlaybackRef.current!.resume();
                  console.log(`Audio context resumed to state: ${audioPlaybackRef.current!.state}`);
                } catch (resumeError) {
                  console.error('Failed to resume audio context:', resumeError);
                  return;
                }
              }
              
              // Double check state after resume attempt
              if (audioPlaybackRef.current!.state !== 'running') {
                console.error(`Audio context still not running after resume attempt: ${audioPlaybackRef.current!.state}`);
                return;
              }
              
              // Decode base64 audio data
              const audioData = atob(message.delta);
              const uint8Array = new Uint8Array(audioData.length);
              for (let i = 0; i < audioData.length; i++) {
                uint8Array[i] = audioData.charCodeAt(i);
              }
              
              // Convert to Float32Array for Web Audio API
              const int16Array = new Int16Array(uint8Array.buffer);
              const float32Array = new Float32Array(int16Array.length);
              for (let i = 0; i < int16Array.length; i++) {
                float32Array[i] = int16Array[i] / 32768.0;
              }
              
              // Only play if we have actual audio data
              if (float32Array.length > 0) {
                // Add to sequential audio queue instead of playing immediately
                playAudioSequentially(float32Array);
              } else {
                console.warn('Received empty audio data');
              }
            };

            playAudio().catch(error => {
              console.error('Error in playAudio function:', error);
            });
          } catch (error) {
            console.error('Error playing audio delta:', error);
          }
        } else if (!message.delta) {
          console.warn('Received response.audio.delta with no delta data');
        } else if (!audioPlaybackRef.current) {
          console.error('No audio playback context available');
        }
        break;

      case 'response.audio.done':
        console.log('🔇 Audio response completed - unmuting user');
        console.log(`Remaining audio chunks in queue: ${audioQueue.current.length}`);
        
        // Mark assistant as no longer speaking immediately
        assistantSpeaking.current = false;
        
        // Auto-unmute user when assistant finishes speaking (but only if they were auto-muted)
        if (autoMutedRef.current) {
          autoMutedRef.current = false;
          setState(prev => ({ ...prev, isSpeaking: false, isMuted: isMutedRef.current, isAutoMuted: false }));
          console.log('User auto-unmuted after Uncle Tor finished speaking');
        } else {
          setState(prev => ({ ...prev, isSpeaking: false, isAutoMuted: false }));
        }
        
        config.onAudioEnd?.();
        
        // Add delay before re-enabling speech detection to avoid echo
        setTimeout(() => {
          shouldDetectSpeech.current = true;
          console.log('Re-enabled user speech detection');
        }, 800); // Slightly longer delay to ensure proper audio cleanup
        break;

      case 'response.created':
        console.log('🎤 Response started - auto-muting user and preparing audio');
        console.log('Response details:', JSON.stringify(message, null, 2));
        
        // Clear any previous audio queue and reset scheduling
        clearAudioQueue();
        
        assistantSpeaking.current = true;
        shouldDetectSpeech.current = false; // Stop detecting user speech
        
        // Auto-mute user when assistant starts speaking
        if (!isMutedRef.current) {
          autoMutedRef.current = true;
          setState(prev => ({ ...prev, isSpeaking: true, isMuted: true, isAutoMuted: true }));
          console.log('User auto-muted while Uncle Tor is speaking');
        } else {
          setState(prev => ({ ...prev, isSpeaking: true, isAutoMuted: false }));
        }
        
        // Ensure audio playback context is ready and force resume
        if (audioPlaybackRef.current) {
          const currentState = audioPlaybackRef.current.state;
          console.log(`Audio context state before response: ${currentState}`);
          
          if (currentState !== 'running') {
            console.log('Force resuming audio context for response...');
            audioPlaybackRef.current.resume().then(() => {
              console.log(`Audio playback context resumed for response - new state: ${audioPlaybackRef.current?.state}`);
            }).catch(error => {
              console.error('Error resuming audio context for response:', error);
            });
          }
          
          // Additional safety: try to resume again after a small delay
          setTimeout(() => {
            if (audioPlaybackRef.current && audioPlaybackRef.current.state !== 'running') {
              console.log('Secondary audio context resume attempt...');
              audioPlaybackRef.current.resume().catch(error => {
                console.error('Secondary audio context resume failed:', error);
              });
            }
          }, 100);
        } else {
          console.error('No audio playback context available for response!');
        }
        
        config.onAudioStart?.();
        break;

      case 'error':
        console.error('🚨 Realtime API error:', message.error);
        const errorMessage = message.error.message || 'Unknown error';
        
        // Handle specific error types
        if (errorMessage.includes('buffer too small')) {
          console.log('Buffer too small error - adjusting detection sensitivity');
          return; // Don't show this error to user
        }
        
        if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
          console.warn('⚠️ Rate limit error - implementing backoff');
          // Implement exponential backoff
          lastRequestTime.current = Date.now() + 10000; // 10 second penalty
          return; // Don't show rate limit errors to user
        }
        
        // Log ALL errors to help debug audio issues
        console.error('🚨 Full error details:', JSON.stringify(message, null, 2));
        
        // Only show serious errors to user
        if (!errorMessage.includes('transcription') && !errorMessage.includes('audio_buffer')) {
          setState(prev => ({ ...prev, error: errorMessage }));
          config.onError?.(new Error(errorMessage));
        }
        break;

      default:
        // Handle other message types as needed
        break;
    }
  };

  const processQueue = useCallback(() => {
    if (isProcessingQueue.current || requestQueue.current.length === 0) {
      return;
    }
    
    isProcessingQueue.current = true;
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime.current;
    const minInterval = 5000; // Increased to minimum 5 seconds between requests
    
    if (timeSinceLastRequest < minInterval) {
      // Wait before processing next request
      setTimeout(() => {
        isProcessingQueue.current = false;
        processQueue();
      }, minInterval - timeSinceLastRequest);
      return;
    }
    
    // Process next request
    const nextRequest = requestQueue.current.shift();
    if (nextRequest) {
      lastRequestTime.current = now;
      nextRequest();
    }
    
    isProcessingQueue.current = false;
    
    // Process remaining queue after delay
    if (requestQueue.current.length > 0) {
      setTimeout(() => {
        processQueue();
      }, minInterval);
    }
  }, []);

  const startConversation = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Add request to queue to prevent rate limiting
      requestQueue.current.push(() => {
        // Pause speech detection while requesting response
        shouldDetectSpeech.current = false;
        
        wsRef.current?.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['text', 'audio'],
            instructions: 'Please respond to the user.',
          }
        }));
      });
      
      processQueue();
    }
  }, [processQueue]);

  const pauseSpeechDetection = useCallback(() => {
    shouldDetectSpeech.current = false;
    console.log('Speech detection paused');
  }, []);

  const resumeSpeechDetection = useCallback(() => {
    if (!assistantSpeaking.current) {
      shouldDetectSpeech.current = true;
      console.log('Speech detection resumed');
    }
  }, []);

  const toggleMute = useCallback(() => {
    // Don't allow manual unmute while assistant is speaking (auto-muted)
    if (assistantSpeaking.current && !isMutedRef.current) {
      console.log('Cannot manually unmute while Uncle Tor is speaking');
      return;
    }
    
    isMutedRef.current = !isMutedRef.current;
    setState(prev => ({ ...prev, isMuted: isMutedRef.current || autoMutedRef.current, isAutoMuted: autoMutedRef.current }));
    console.log(`Microphone manually ${isMutedRef.current ? 'muted' : 'unmuted'}`);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    // Don't allow manual unmute while assistant is speaking (auto-muted)
    if (assistantSpeaking.current && !muted) {
      console.log('Cannot manually unmute while Uncle Tor is speaking');
      return;
    }
    
    isMutedRef.current = muted;
    setState(prev => ({ ...prev, isMuted: muted || autoMutedRef.current, isAutoMuted: autoMutedRef.current }));
    console.log(`Microphone manually ${muted ? 'muted' : 'unmuted'}`);
  }, []);

  const testAudioPlayback = useCallback(async () => {
    if (!audioPlaybackRef.current) {
      console.error('No audio playback context available');
      return false;
    }

    try {
      // Resume audio context if needed
      if (audioPlaybackRef.current.state === 'suspended') {
        await audioPlaybackRef.current.resume();
      }

      // Create a simple test tone
      const duration = 0.5; // 0.5 seconds
      const frequency = 440; // A4 note
      const audioBuffer = audioPlaybackRef.current.createBuffer(1, audioPlaybackRef.current.sampleRate * duration, audioPlaybackRef.current.sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      // Generate a simple sine wave
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * frequency * i / audioPlaybackRef.current.sampleRate) * 0.1;
      }

      // Play the test tone
      const source = audioPlaybackRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioPlaybackRef.current.destination);
      source.start();

      console.log('Audio test tone played successfully');
      return true;
    } catch (error) {
      console.error('Audio test failed:', error);
      return false;
    }
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log(`Sending message to Uncle Tor: "${message}"`);
      
      // Ensure audio context is ready before sending
      if (audioPlaybackRef.current && audioPlaybackRef.current.state !== 'running') {
        console.log('Ensuring audio context is ready before sending message...');
        audioPlaybackRef.current.resume().catch(error => {
          console.error('Failed to resume audio context before message:', error);
        });
      }
      
      // Add message to queue to prevent rate limiting
      requestQueue.current.push(() => {
        console.log('Sending conversation item to API');
        wsRef.current?.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: message
              }
            ]
          }
        }));
      });
      
      // Trigger response after message
      requestQueue.current.push(() => {
        console.log('Triggering response.create with audio requirement');
        shouldDetectSpeech.current = false;
        wsRef.current?.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['text', 'audio'],
            instructions: 'Please respond to the user.',
          }
        }));
      });
      
      processQueue();
    } else {
      console.error('WebSocket not open, cannot send message');
    }
  }, [processQueue]);

  const cleanup = useCallback(() => {
    // Clear any pending timeouts
    if (transcriptionTimeoutRef.current) {
      clearTimeout(transcriptionTimeoutRef.current);
      transcriptionTimeoutRef.current = null;
    }
    
    // Reset speech detection state
    shouldDetectSpeech.current = true;
    assistantSpeaking.current = false;
    autoMutedRef.current = false;
    
    if (processorRef.current) {
      // Clean up speech detection state
      if (typeof (processorRef.current as any).cleanup === 'function') {
        (processorRef.current as any).cleanup();
      }
      
      // Disconnect all audio filters
      const filters = (processorRef.current as any).audioFilters;
      if (filters) {
        try {
          filters.highpass?.disconnect();
          filters.lowpass?.disconnect();
          filters.notch?.disconnect();
          filters.compressor?.disconnect();
          filters.gain?.disconnect();
        } catch (error) {
          console.warn('Error disconnecting audio filters:', error);
        }
      }
      
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.close();
      audioPlaybackRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Clear audio queue
    clearAudioQueue();
    
    setState({
      isConnected: false,
      isRecording: false,
      isSpeaking: false,
      audioLevel: 0,
      transcript: '',
      error: null,
      isMuted: false,
      isAutoMuted: false,
    });
  }, [clearAudioQueue]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    connect,
    disconnect,
    sendMessage,
    startConversation,
    pauseSpeechDetection,
    resumeSpeechDetection,
    toggleMute,
    setMuted,
    initializeAudioContexts,
    testAudioPlayback,
  };
}