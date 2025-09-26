// Session configuration and constants - Optimized for robust audio flow
// Updated: Removed VAD + increased timeouts for stability
export const ENGINE = {
  VAD_ENABLED: false,                   // Disabled VAD as requested
  AUTO_STOP_ON_SILENCE: false,         // Disabled auto-stop with VAD
  START_TIMEOUT_MS: 45000,             // Increased timeout for session start (was 25000)
  NO_SPEECH_GRACE_MS: 4500,            // Balanced grace period (was 5000)
  AUDIO_PROCESSING_TIMEOUT_MS: 25000,  // Increased timeout for audio processing (was 18000)
  SESSION_WARMUP_MS: 2000,             // Reduced warmup time (was 4000)
} as const;

export const SESSION_CONFIG = {
  MAX_QUESTIONS_PER_TOPIC: 2,          // Changed back to 2 questions per topic
  TTS_TIMEOUT_MS: 15000,               // Increased from 10000
  STT_TIMEOUT_MS: 20000,               // Increased from 15000
  LLM_TIMEOUT_MS: 12000,               // Increased from 8000
  // Removed MIC_START_TIMEOUT_MS - now we wait for user button
  MAX_RECORDING_MS: 300000, // 5 minutes max per answer
  QUESTION_MAX_WORDS: 14, // NEW: Short questions ≤14 words
  FEEDBACK_TTS_MAX_LENGTH: 120, // NEW: Immediate TTS feedback ≤120 chars
  CONTEXT_MAX_LENGTH: 280, // NEW: Sanitized company context
  ASKED_CSV_MAX_LENGTH: 200, // NEW: Asked questions as CSV
  FINAL_SUMMARY_MAX_LENGTH: 600, // NEW: Final markdown summary
} as const;

// Status messages - Updated for USER_DONE flow
export const STATUS_MESSAGES = {
  INITIALIZING: "Inicializando...",
  STARTING: "Iniciando simulação...",
  SPEAKING: "Falando...",
  LISTENING: "Ouvindo...", // Now shows "I'm Done" button
  PROCESSING: "Pensando...",
  COMPLETE: "Simulação concluída!",
  READY: "Pronto",
  WAITING_FOR_USER: "Clique 'Terminei' quando finalizar sua resposta",
} as const;

// NEW: Batch prompts configuration - ALL OUTPUTS MUST BE IN PT-BR
export const BATCH_PROMPTS = {
  SANITIZE_CONTEXT: "IMPORTANTE: Responda EXCLUSIVAMENTE em português do Brasil (pt-BR). Evite anglicismos desnecessários. Resuma esta descrição de vaga em pontos-chave: empresa, cargo, principais responsabilidades, requisitos ≤280 caracteres. Sem links, sem listas. Retorne apenas o resumo.",
  
  SHORT_QUESTION: `IMPORTANTE: Responda EXCLUSIVAMENTE em português do Brasil (pt-BR). Evite anglicismos desnecessários.
Papel: Recrutador Profissional (mercado BR/Global). Input: tópico, perguntas já feitas, descrição da vaga.
Output: **1 pergunta profissional de entrevista em português brasileiro**, **≤14 palavras**, clara, direta. Comece com **Como/Por que/Qual/Fale sobre/Descreva/Conte**. Adapte o tópico ao cargo específico. **Sem duplicatas** (evite qualquer pergunta já feita). Soe como um recrutador real brasileiro. **Retorne apenas a pergunta.**`,
  
  EVALUATE_ANSWER: `IMPORTANTE: Responda EXCLUSIVAMENTE em português do Brasil (pt-BR). Evite anglicismos desnecessários.
Papel: Coach de Entrevistas (abordagem Smart Brevity). Input: pergunta, resposta.
Avalie **relevância, estrutura, confiança, profissionalismo**.
Retorne **JSON** apenas:
{"score":0-100,"strengths":["..."],"fixes":["..."],"tts":"<=120 chars dica do coach"}

* tts fala **1 força + 1 melhoria** em tom empático mas direto, em português brasileiro.
* Máx 2 itens em cada lista.
* Seja específico (ex.: "use método STAR", "dê números/resultados").`,
  
  FINAL_SUMMARY: `IMPORTANTE: Responda EXCLUSIVAMENTE em português do Brasil (pt-BR). Evite anglicismos desnecessários.
Papel: Coach Profissional de Entrevistas. Input: array de QA (cada item tem pergunta, resposta, pontuação, pontos fortes, melhorias).
Output Markdown **≤600 caracteres**:

* Pontuação Geral: X/100 (média)
* **3 pontos fortes** (bullets)
* **3 melhorias** (bullets)
* **1 dica prática** (1 linha para próximas entrevistas)
Retorne apenas o markdown em português brasileiro.`,
} as const;

// Default fallback responses - ALL IN PT-BR
export const FALLBACK_RESPONSES = {
  TTS_ERROR: "Áudio indisponível no momento",
  STT_ERROR: "Não consegui entender claramente. Pode repetir?",
  LLM_ERROR: "Boa resposta! Continue praticando para ganhar mais confiança.",
  NO_QUESTIONS: "Vamos para o próximo tópico da entrevista",
  CONTEXT_SANITIZE_ERROR: "Não foi possível processar a descrição da vaga fornecida",
  FINAL_SUMMARY_ERROR: "Excelente simulação! Continue praticando para aprimorar suas habilidades de entrevista.",
} as const;

// NEW: Event types for USER_DONE flow
export const SESSION_EVENTS = {
  SESSION_STARTED: 'session_started',
  NEW_QUESTION: 'new_question',
  LISTENING: 'listening', // Shows "I'm Done" button
  USER_DONE: 'user_done', // User clicked button
  PROCESSING: 'processing',
  ANSWER_EVALUATED: 'answer_evaluated', // Immediate TTS feedback
  SESSION_END: 'session_end', // Includes final summary
} as const;