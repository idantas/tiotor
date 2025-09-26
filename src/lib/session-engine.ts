// Robust Session Engine - Persistent session without VAD for stability
import { genQuestion, genFeedback, generateFinalSummary, sanitizeContext, validateAndGenerateQuestion, validateAndEvaluateAnswer } from "../ai/chat";
import { ENGINE, SESSION_CONFIG } from "./session-config";
import { LOCALE_CONFIG } from "./locale-config";

// Updated: No VAD + persistent voice session + TTS gate
let isSpeaking = false;
let voiceSession: VoiceSessionManager | null = null;

// Voice Session Manager - persistent session for entire interview (no VAD)
class VoiceSessionManager {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private isWarmedUp: boolean = false;
  private currentRecorder: MediaRecorder | null = null;
  public sessionReady: boolean = false; // Made public for external checks

  async initialize(): Promise<void> {
    console.log("🎤 Initializing voice session without VAD:", ENGINE);
    
    try {
      // Pre-warm audio context with extended timeout
      const contextTimeout = setTimeout(() => {
        throw new Error("Audio context initialization timeout");
      }, 15000); // Increased from 10000
      
      await this.ensureAudioContext();
      clearTimeout(contextTimeout);
      
      // Pre-warm microphone access with extended timeout
      const micTimeout = setTimeout(() => {
        throw new Error("Microphone access timeout");
      }, 25000); // Increased from 15000
      
      await this.warmupMicrophone();
      clearTimeout(micTimeout);
      
      // Reduced warmup period for faster startup
      console.log(`🎤 Session warmup period: ${ENGINE.SESSION_WARMUP_MS}ms`);
      await new Promise(resolve => setTimeout(resolve, ENGINE.SESSION_WARMUP_MS));
      
      this.sessionReady = true;
      console.log("🎤 Voice session ready - manual recording mode");
    } catch (error) {
      console.error("🎤 Failed to initialize voice session:", error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to initialize voice session";
      if (error.message.includes("microphone") || error.message.includes("Microphone")) {
        errorMessage = "Please allow microphone access in your browser and try again.";
      } else if (error.message.includes("audio context")) {
        errorMessage = "Audio system initialization failed. Please refresh the page.";
      } else if (error.message.includes("timeout")) {
        errorMessage = "Initialization is taking longer than expected. Please refresh and try again.";
      }
      
      throw new Error(errorMessage);
    }
  }

  async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  async warmupMicrophone(): Promise<MediaStream> {
    if (this.mediaStream && this.isWarmedUp) {
      return this.mediaStream;
    }

    try {
      console.log("🎤 Requesting microphone access...");
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          sampleRate: 44100,
        }
      });
      
      this.isWarmedUp = true;
      console.log("🎤 Microphone pre-warmed successfully");
      return this.mediaStream;
    } catch (error) {
      console.error("🎤 Failed to warm up microphone:", error);
      
      // Provide specific error messages
      if (error.name === 'NotAllowedError') {
        throw new Error("Microphone access denied. Please allow microphone permissions and try again.");
      } else if (error.name === 'NotFoundError') {
        throw new Error("No microphone found. Please connect a microphone and try again.");
      } else if (error.name === 'NotReadableError') {
        throw new Error("Microphone is already in use by another application.");
      } else {
        throw new Error(`Microphone error: ${error.message}`);
      }
    }
  }

  async startRecording(): Promise<Blob> {
    if (!this.sessionReady || !this.mediaStream) {
      throw new Error("Voice session not ready - call initialize() first");
    }

    return new Promise((resolve, reject) => {
      const chunks: BlobPart[] = [];
      
      try {
        this.currentRecorder = new MediaRecorder(this.mediaStream!, { 
          mimeType: "audio/webm;codecs=opus" 
        });
        
        this.currentRecorder.ondataavailable = (event) => {
          if (event.data?.size > 0) {
            chunks.push(event.data);
          }
        };
        
        this.currentRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          console.log("🎤 Recording completed, blob size:", blob.size);
          resolve(blob);
        };
        
        this.currentRecorder.onerror = (event) => {
          console.error("🎤 Recording error:", event);
          reject(new Error("Recording failed"));
        };

        // Start recording with chunking for better processing
        this.currentRecorder.start(250);
        console.log("🎤 Recording started - manual mode (no VAD)");
        
      } catch (error) {
        console.error("🎤 Failed to start recording:", error);
        reject(error);
      }
    });
  }

  stopRecording(): void {
    if (this.currentRecorder && this.currentRecorder.state === 'recording') {
      console.log("🎤 Stopping recording in persistent session");
      this.currentRecorder.stop();
      this.currentRecorder = null;
    }
  }

  isRecording(): boolean {
    return this.currentRecorder?.state === 'recording';
  }

  destroy(): void {
    console.log("🎤 Destroying voice session");
    
    if (this.currentRecorder && this.currentRecorder.state === 'recording') {
      this.currentRecorder.stop();
    }
    this.currentRecorder = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isWarmedUp = false;
    this.sessionReady = false;
  }
}

// Global state - single source of truth
const st = {
  topics: [] as string[],
  ctx: "",
  company_280: "", // Sanitized company context
  idx: 0,
  maxPerTopic: SESSION_CONFIG.MAX_QUESTIONS_PER_TOPIC, // Now uses config (2 questions)
  asked: [] as string[][],
  phase: "idle" as "idle" | "run" | "end",
  ver: 0,
  currentCallbacks: {
    onUpdate: null as ((data: any) => void) | null
  },
  sessionHistory: [] as any[], // Store Q&A history for final summary
  waitingForUserDone: false, // Flag to track if we're waiting for user to click "I'm done"
  isSpeakingFeedback: false, // Gate para TTS do feedback
};

// Updated: Ask question and wait for TTS to finish before starting recording (no VAD)
async function askAndListen(question: string, onUpdate: (data: any) => void, questionNumber: number, topic: string, topicProgress: string): Promise<Blob> {
  console.log(`🎙️ askAndListen: Starting question ${questionNumber}`);
  
  // Update UI with new question
  onUpdate({
    type: 'new_question',
    question,
    questionNumber,
    topic,
    topicProgress
  });

  // Speak question and wait for TTS to complete
  console.log("🔊 Speaking question, waiting for TTS to finish...");
  await speakExclusive(question);
  
  // Wait for TTS to completely finish before starting to listen
  await waitForTTSToFinish();
  
  console.log("🔊 TTS finished, now starting manual recording mode");
  
  // Only now start listening - no race condition
  onUpdate({ type: 'listening' });
  console.log(`🎤 Listening for question ${questionNumber} - Manual mode (no VAD)`);

  // Block recording while TTS is speaking
  if (isTTSSpeaking()) {
    console.log("🚫 Blocking recording - TTS still speaking");
    return new Blob();
  }

  // Start recording with persistent session
  if (!voiceSession) {
    throw new Error("Voice session not initialized");
  }

  // Always use manual recording mode (no VAD)
  console.log("🎤 Starting manual recording - waiting for user done");
  st.waitingForUserDone = true;
  try {
    return await voiceSession.startRecording();
  } catch (error) {
    console.error("🎤 Manual recording failed:", error);
    st.waitingForUserDone = false;
    onUpdate({ type: 'error', message: `Recording failed: ${error.message}` });
    return new Blob();
  }
}

// Speak feedback and ensure it completes before next action
async function speakFeedbackAndWait(text: string): Promise<void> {
  console.log("🔊 Speaking feedback, waiting for TTS to finish...");
  await speakExclusive(text);
  
  // Wait for TTS to completely finish
  await waitForTTSToFinish();
  
  console.log("🔊 Feedback TTS finished");
}

// Utility functions
const norm = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

// Audio: sem sobreposição + início rápido + gate para gravação
let audioQ = Promise.resolve();

export async function ensureAudio() {
  if (!voiceSession) {
    throw new Error("Voice session not initialized");
  }
  return await voiceSession.ensureAudioContext();
}

// Speak with gate - só permite gravação depois do TTS terminar
async function speak(text: string): Promise<void> {
  if (st.phase !== "run") return;
  
  console.log("🔊 TTS starting - setting isSpeaking = true");
  isSpeaking = true;
  
  try {
    const ctx = await ensureAudio();
    const audioBuffer = await openaiTTS(text);
    if (st.phase !== "run") {
      isSpeaking = false;
      return;
    }
    
    await playBuffer(audioBuffer, ctx); // aguarda onended
    console.log("🔊 TTS finished - setting isSpeaking = false");
  } catch (error) {
    console.warn("TTS error:", error);
  } finally {
    isSpeaking = false;
    console.log("🔊 TTS gate released - isSpeaking = false");
  }
}

export async function speakExclusive(text: string) {
  if (st.phase !== "run") return;
  
  audioQ = audioQ.then(async () => {
    if (st.phase !== "run") return;
    await speak(text);
  });
  return audioQ;
}

// Check if TTS is currently playing
export function isTTSSpeaking(): boolean {
  return isSpeaking;
}

// Wait for any active TTS to finish
export async function waitForTTSToFinish(): Promise<void> {
  while (isTTSSpeaking()) {
    console.log("🔊 Waiting for TTS gate to clear...");
    await new Promise(resolve => setTimeout(resolve, 50)); // Faster polling
  }
  console.log("🔊 TTS gate clear - ready to proceed");
}

// OpenAI TTS with timeout
async function openaiTTS(text: string): Promise<ArrayBuffer> {
  const timeout = new AbortController();
  const timeoutId = setTimeout(() => timeout.abort(), 10000);
  
  try {
    const { projectId, publicAnonKey } = await import("../utils/supabase/info");
    const configResponse = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-28776b5d/config`,
      { 
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        signal: timeout.signal
      }
    );

    if (!configResponse.ok) {
      throw new Error("Failed to get API config");
    }

    const config = await configResponse.json();
    const apiKey = config.openaiApiKey;

    if (!apiKey) {
      throw new Error("No API key");
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "ash",
        input: text,
        response_format: "mp3",
        speed: 0.9,
      }),
      signal: timeout.signal,
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    clearTimeout(timeoutId);
    return buffer;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Play audio buffer
async function playBuffer(buffer: ArrayBuffer, audioContext: AudioContext): Promise<void> {
  return new Promise((resolve, reject) => {
    if (st.phase !== "run") {
      resolve();
      return;
    }

    const audioBuffer = audioContext.decodeAudioData(buffer.slice(0));
    audioBuffer.then((decodedBuffer) => {
      if (st.phase !== "run") {
        resolve();
        return;
      }

      const source = audioContext.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(audioContext.destination);
      
      source.onended = () => resolve();
      
      source.start();
    }).catch(reject);
  });
}

// Start recording and wait for user to click "I'm done" - LEGACY - NOT USED WITH PERSISTENT SESSION
export async function startListeningForDone() {
  console.warn("⚠️ startListeningForDone() is legacy - using persistent session instead");
  return new Blob();
}

// User clicked "I'm done" button - Enhanced for persistent session
export function userDone(): void {
  if (!voiceSession || !voiceSession.isRecording()) {
    console.warn("🎤 userDone() called but no active recording session");
    return;
  }
  
  console.log("🎤 User clicked 'I'm Done' - stopping recording immediately");
  st.waitingForUserDone = false;
  voiceSession.stopRecording();
}

// Check if we're waiting for user done
export function isWaitingForUserDone(): boolean {
  return st.waitingForUserDone;
}

// Check if currently recording
export function isRecording(): boolean {
  return voiceSession?.isRecording() || false;
}

// Check if we have a valid voice session
export function hasVoiceSession(): boolean {
  return voiceSession !== null && voiceSession.sessionReady;
}

// Transcribe with OpenAI Whisper - optimized for persistent session
async function transcribeBlob(blob: Blob, opts?: { signal?: AbortSignal, onUpdate?: (data: any) => void }): Promise<string> {
  const abortController = opts?.signal ? undefined : new AbortController();
  const signal = opts?.signal || abortController?.signal;
  let timeoutId: NodeJS.Timeout | null = null;
  if (!opts?.signal && abortController) {
    timeoutId = setTimeout(() => abortController.abort(), 15000);
  }
  try {
    const { projectId, publicAnonKey } = await import("../utils/supabase/info");
    const configResponse = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-28776b5d/config`,
      { 
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        signal
      }
    );
    if (!configResponse.ok) {
      throw new Error("Failed to get API config");
    }
    const config = await configResponse.json();
    const apiKey = config.openaiApiKey;
    if (!apiKey) {
      throw new Error("No API key");
    }
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal,
    });
    if (!response.ok) {
      throw new Error(`Transcription API error: ${response.status}`);
    }
    const data = await response.json();
    if (timeoutId) clearTimeout(timeoutId);
    // Se texto vazio ou baixa confiança, dispara retry_needed
    if (!data.text || (data.confidence !== undefined && data.confidence < 0.5)) {
      opts?.onUpdate?.({ type: 'retry_needed', message: "Não consegui entender claramente. Vamos tentar de novo?" });
    }
    return data.text || "";
  } catch (error: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      opts?.onUpdate?.({ type: 'retry_needed', message: "Não consegui entender claramente. Vamos tentar de novo?" });
      return "";
    }
    console.error("Transcription error:", error);
    return "";
  }
}

// Get API key for chat functions
async function getApiKey(): Promise<string> {
  const { projectId, publicAnonKey } = await import("../utils/supabase/info");
  const configResponse = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-28776b5d/config`,
    { 
      headers: { Authorization: `Bearer ${publicAnonKey}` }
    }
  );

  if (!configResponse.ok) {
    throw new Error("Failed to get API config");
  }

  const config = await configResponse.json();
  if (!config.openaiApiKey) {
    throw new Error("No API key available");
  }

  return config.openaiApiKey;
}

// Main session function with robust voice flow and persistent session (no VAD)
export async function startSession(topics: string[], company_ctx: string, onUpdate: (data: any) => void) {
  console.log("🚀 Starting session without VAD:", ENGINE);
  console.log("📋 Topics received:", topics);
  console.log("🏢 Company context:", company_ctx.slice(0, 100) + "...");
  
  // Validate input
  if (!topics || topics.length === 0) {
    console.error("❌ No topics provided to session");
    onUpdate({ type: 'error', message: 'No topics provided for the session' });
    return;
  }
  
  if (!company_ctx || company_ctx.trim().length === 0) {
    console.error("❌ No company context provided to session");
    onUpdate({ type: 'error', message: 'No company context provided for the session' });
    return;
  }
  
  st.ver++;
  const v = st.ver;
  st.phase = "run";
  st.topics = topics;
  st.ctx = company_ctx;
  st.idx = 0;
  st.asked = topics.map(() => []);
  st.currentCallbacks.onUpdate = onUpdate;
  st.sessionHistory = [];
  
  console.log("📋 Session initialized with:", {
    topics: st.topics,
    topicsCount: st.topics.length,
    maxPerTopic: st.maxPerTopic, // Now shows 2 questions per topic
    sessionVersion: v,
    engineConfig: {
      vadEnabled: ENGINE.VAD_ENABLED, // false
      startTimeout: `${ENGINE.START_TIMEOUT_MS}ms`, // 45s
      sessionWarmup: `${ENGINE.SESSION_WARMUP_MS}ms`, // 2s
      questionsPerTopic: SESSION_CONFIG.MAX_QUESTIONS_PER_TOPIC
    }
  });
  
  let sessionTimeout: NodeJS.Timeout | null = null;
  try {
    // Step 1: Initialize and pre-warm voice session with extended timeout
    console.log("🎤 Step 1: Pre-warming voice session...");
    onUpdate({ type: 'session_warming', message: 'Initializing microphone access...' });
    
    sessionTimeout = setTimeout(() => {
      throw new Error("Session initialization took too long. Please allow microphone access and try again.");
    }, ENGINE.START_TIMEOUT_MS);
    
    voiceSession = new VoiceSessionManager();
    await voiceSession.initialize();
    
    clearTimeout(sessionTimeout);
    sessionTimeout = null;
    onUpdate({ type: 'session_warming', message: 'Voice session ready' });
    
    // Step 2: Get API key
    let apiKey: string;
    try {
      apiKey = await getApiKey();
    } catch (error) {
      console.error("Failed to get API key:", error);
      onUpdate({ type: 'error', message: 'Failed to initialize API connection' });
      return;
    }

    // Step 3: Sanitize company context
    console.log("📝 Step 2: Sanitizing company context...");
    try {
      st.company_280 = await sanitizeContext({
        company: company_ctx,
        role: "", // If you have role info, pass it here
        apiKey
      });
      console.log("📝 Context sanitized:", st.company_280.slice(0, 50) + "...");
    } catch (error) {
      console.warn("Context sanitization failed:", error);
      st.company_280 = company_ctx.slice(0, 280);
    }
    
    // Step 4: Update UI and start intro
    onUpdate({ type: 'session_started' });
    
    // Step 5: Speak intro and wait for it to finish before starting questions (pt-BR)
    console.log("🔊 Step 3: Speaking intro, waiting for TTS to finish...");
    await speakExclusive("Olá! Eu sou o Tio Tor, seu coach de entrevistas. Vamos começar a praticar!");
    
    // Wait for intro TTS to completely finish
    await waitForTTSToFinish();
    
    console.log("🔊 Intro TTS finished, starting question loop");

    let questionNumber = 0;
    
    // Step 6: Question loop com 2ª pergunta opcional
  const SCORE_THRESHOLD = 70;
  while (st.phase === "run" && st.ver === v && st.idx < st.topics.length) {
      const i = st.idx;
      const asked = st.asked[i];
      console.log(`🔄 TOPIC LOOP: Current topic index ${i}, topic: "${st.topics[i]}", asked questions: ${asked.length}/${st.maxPerTopic}`);

      // Skip topic if já atingiu o máximo
      if (asked.length >= st.maxPerTopic) {
        console.log(`⏭️ Topic "${st.topics[i]}" reached max questions (${st.maxPerTopic}), moving to next`);
        st.idx++;
        continue;
      }

      // Gera a primeira pergunta
      let q1: string;
       try {
         console.log(`🤔 Generating question for topic: "${st.topics[i]}" (${i+1}/${st.topics.length})`);
         // Contexto rico da vaga
         const jobContext = st.company_280 || ""; // já sanitizado
         let result;
         let attempts = 0;
         do {
           attempts++;
           result = await genQuestion({
             active_topic: st.topics[i],
             asked_questions: asked,
             company_context: jobContext,
             max_per_topic: st.maxPerTopic,
             apiKey
           });
           // Guard de idioma: se vier inglês, regerar
           if (result?.question && /\b(the|you|your|what|how|when|why|describe|tell|give|example|please)\b/i.test(result.question)) {
             console.log("Regenerating question: detected English");
             result.question = "";
           }
         } while ((!result?.question || asked.includes(norm(result.question))) && attempts < 3);
         if (result?.done) {
           console.log(`✅ Topic "${st.topics[i]}" completed, moving to next`);
           st.idx++;
           continue;
         }
         q1 = result?.question;
         if (!q1 || asked.includes(norm(q1))) {
           console.log(`⚠️ Question generation failed or duplicate for topic "${st.topics[i]}"`);
           st.idx++;
           continue;
         }
         console.log(`✅ Generated Q1 for "${st.topics[i]}": "${q1}"`);
       } catch (error) {
         console.error("Question generation error:", error);
         st.idx++;
         continue;
       }

      // Commit Q1
      asked.push(norm(q1));
      questionNumber++;
      console.log(`📝 Added Q1 (${questionNumber}) to topic "${st.topics[i]}": "${q1}"`);

      // Pergunta Q1
      const audioBlob1 = await askAndListen(q1, onUpdate, questionNumber, st.topics[i], `${asked.length}/${st.maxPerTopic}`);
      if (st.phase !== "run" || st.ver !== v) break;
      if (!audioBlob1 || audioBlob1.size === 0) {
        console.warn("🎤 No audio captured, skipping to next question");
        asked.pop();
        questionNumber--;
        onUpdate({ type: 'retry_needed', message: "Nenhum áudio foi capturado. Por favor, verifique seu microfone e tente novamente." });
        continue;
      }
      console.log(`🎤 Audio Q1 captured: ${audioBlob1.size} bytes, type: ${audioBlob1.type}`);
      onUpdate({ type: 'processing' });
      console.log("🧠 Processing answer Q1...");
      const answer1 = await transcribeBlob(audioBlob1);
      console.log("📝 Transcribed Q1:", answer1.slice(0, 100) + (answer1.length > 100 ? "..." : ""));
      if (answer1.toLowerCase().includes("thanks for watching") || answer1.toLowerCase().includes("thank you for watching") || answer1.length < 5) {
        console.warn("🎤 Detected false transcription, asking user to retry");
        asked.pop();
        questionNumber--;
        onUpdate({ type: 'retry_needed', message: "Não consegui entender claramente. Por favor, fale mais próximo ao microfone e tente novamente." });
        continue;
      }
      if (st.phase !== "run" || st.ver !== v) break;
      let fb1: any;
      try {
        fb1 = await genFeedback({
          question: q1,
          answer: answer1,
          topic: st.topics[i],
          company_context: st.company_280,
          apiKey
        });
      } catch (error) {
        console.error("Feedback generation error:", error);
        fb1 = { feedback_voice: "Boa resposta! Continue praticando para ganhar mais confiança.", scores: { overall: 75 } };
      }
      if (st.phase !== "run" || st.ver !== v) break;
      st.sessionHistory.push({ question: q1, answer: answer1, score: fb1.scores?.overall || 75, strengths: fb1.strengths || ["Clear communication"], fixes: fb1.fixes || ["Practice more examples"] });
      onUpdate({ type: 'answer_evaluated', question: q1, answer: answer1, feedback: fb1.feedback_voice || "Boa resposta!", score: fb1.scores?.overall || 75, questionNumber });
      st.isSpeakingFeedback = true;
      await speakFeedbackAndWait(fb1.feedback_voice || "Good response!");
      st.isSpeakingFeedback = false;

      // Decisão para Q2
      let shouldAskQ2 = false;
      // a) Score baixo
      if ((fb1.scores?.overall ?? 100) < SCORE_THRESHOLD) {
        shouldAskQ2 = true;
        console.log(`Proceeding Q2: score low (${fb1.scores?.overall})`);
      }
      // b) Transcrição curta/dúbia
      const wordCount = answer1.trim().split(/\s+/).length;
      if (wordCount < 12) {
        shouldAskQ2 = true;
        console.log(`Proceeding Q2: answer too short (${wordCount} words)`);
      }
      // c) Heurística LLM (simples)
      // Se quiser usar heurística LLM, pode usar um prompt simples e analisar o texto do feedback
      // Exemplo: se o feedback sugerir "aprofundar" ou "explique melhor", considerar follow-up
      if (typeof fb1.feedback_voice === "string" && /aprofund|explique|detalhe|mais exemplos/i.test(fb1.feedback_voice)) {
        shouldAskQ2 = true;
        console.log("Proceeding Q2: LLM feedback suggests follow-up");
      }
      if (!shouldAskQ2) {
        console.log("Skipping Q2: score/transcription OK");
        st.idx++;
        continue;
      }
      // Gera Q2, evitando duplicidade
      let q2: string;
      let attempts = 0;
      do {
        attempts++;
        try {
          const result2 = await genQuestion({
            active_topic: st.topics[i],
            asked_questions: asked,
            company_context: st.company_280,
            max_per_topic: st.maxPerTopic,
            apiKey
          });
          q2 = result2?.question;
        } catch (err) {
          console.error("Q2 generation error", err);
          q2 = "";
        }
      } while ((attempts < 3) && (q2 && (norm(q2) === norm(q1) || asked.includes(norm(q2)))));
      if (!q2 || norm(q2) === norm(q1) || asked.includes(norm(q2))) {
        console.log("Skipping Q2: could not generate distinct question");
        st.idx++;
        continue;
      }
      asked.push(norm(q2));
      questionNumber++;
      console.log(`📝 Added Q2 (${questionNumber}) to topic "${st.topics[i]}": "${q2}"`);
      const audioBlob2 = await askAndListen(q2, onUpdate, questionNumber, st.topics[i], `${asked.length}/${st.maxPerTopic}`);
      if (st.phase !== "run" || st.ver !== v) break;
      if (!audioBlob2 || audioBlob2.size === 0) {
        console.warn("🎤 No audio captured for Q2, skipping");
        asked.pop();
        questionNumber--;
        onUpdate({ type: 'retry_needed', message: "Nenhum áudio foi capturado. Por favor, verifique seu microfone e tente novamente." });
        st.idx++;
        continue;
      }
      console.log(`🎤 Audio Q2 captured: ${audioBlob2.size} bytes, type: ${audioBlob2.type}`);
      onUpdate({ type: 'processing' });
      console.log("🧠 Processing answer Q2...");
      const answer2 = await transcribeBlob(audioBlob2);
      console.log("� Transcribed Q2:", answer2.slice(0, 100) + (answer2.length > 100 ? "..." : ""));
      let fb2: any;
      try {
        fb2 = await genFeedback({
          question: q2,
          answer: answer2,
          topic: st.topics[i],
          company_context: st.company_280,
          apiKey
        });
      } catch (error) {
        console.error("Feedback generation error Q2:", error);
        fb2 = { feedback_voice: "Boa resposta! Continue praticando para ganhar mais confiança.", scores: { overall: 75 } };
      }
      if (st.phase !== "run" || st.ver !== v) break;
      st.sessionHistory.push({ question: q2, answer: answer2, score: fb2.scores?.overall || 75, strengths: fb2.strengths || ["Clear communication"], fixes: fb2.fixes || ["Practice more examples"] });
      onUpdate({ type: 'answer_evaluated', question: q2, answer: answer2, feedback: fb2.feedback_voice || "Boa resposta!", score: fb2.scores?.overall || 75, questionNumber });
      st.isSpeakingFeedback = true;
      await speakFeedbackAndWait(fb2.feedback_voice || "Good response!");
      st.isSpeakingFeedback = false;
      st.idx++;
    }
    
    console.log(`🏁 Question loop finished. Total questions: ${questionNumber}, Topics processed: ${st.idx}/${st.topics.length}`);

    // Step 7: Generate final summary
    if (st.phase === "run" && st.sessionHistory.length > 0) {
      try {
        const finalSummary = await generateFinalSummary({
          history_json: st.sessionHistory,
          apiKey
        });
        onUpdate({ type: 'session_end', totalQuestions: questionNumber, finalSummary: finalSummary.trim() });
      } catch (error) {
        console.error("Final summary generation error:", error);
        onUpdate({ type: 'session_end', totalQuestions: questionNumber });
      }
    } else {
      onUpdate({ type: 'session_end', totalQuestions: questionNumber });
    }
  } catch (error) {
    console.error("Session error:", error);
    if (sessionTimeout) {
      clearTimeout(sessionTimeout);
      sessionTimeout = null;
    }
    let errorMessage = 'Session failed: ' + error.message;
    if (error.message.includes('timeout')) {
      errorMessage = 'Session initialization took too long. Please allow microphone access and refresh the page.';
    } else if (error.message.includes('microphone')) {
      errorMessage = 'Microphone access failed. Please allow microphone permissions and try again.';
    } else if (error.message.includes('audio')) {
      errorMessage = 'Audio system error. Please refresh the page and try again.';
    }
    onUpdate({ type: 'error', message: errorMessage });
  } finally {
    endSession();
  }
}

// End session - hard gate
export function endSession(): void {
  if (st.phase === "end") return;
  
  console.log("🏁 Ending session - no VAD mode:", ENGINE);
  st.phase = "end";
  st.ver++;
  st.waitingForUserDone = false;
  
  // Clear TTS gate on session end
  isSpeaking = false;
  console.log("🔊 TTS gate cleared on session end");
  
  // Destroy persistent voice session
  if (voiceSession) {
    voiceSession.destroy();
    voiceSession = null;
    console.log("🎤 Voice session destroyed");
  }
  
  // Clear callbacks
  st.currentCallbacks.onUpdate = null;
  
  console.log("🏁 Session ended - manual recording mode");
}

// Utility functions for external use
export function getSessionState() {
  return { ...st };
}

export function isSessionActive(): boolean {
  return st.phase === "run";
}

export function stopRecording(): void {
  userDone(); // Trigger user done when stop recording is called
}

// Legacy compatibility - now uses persistent session
export async function listenOnce(options: any = {}) {
  if (!voiceSession) {
    throw new Error("Voice session not initialized");
  }
  
  const blob = await voiceSession.startRecording();
  return await transcribeBlob(blob);
}