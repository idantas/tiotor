// Global Portuguese BR (pt-BR) configuration for all AI and audio systems
export const LOCALE_CONFIG = {
  // Primary locale
  LOCALE: 'pt-BR',
  LANGUAGE_CODE: 'pt',
  COUNTRY_CODE: 'BR',
  
  // OpenAI TTS Configuration
  TTS: {
    voice: 'ash', // Official Tio Tor voice for BR version
    speed: 0.9,   // Natural pace for interview speech
    language: 'pt-BR'
  },
  
  // OpenAI Whisper STT Configuration
  STT: {
    language: 'pt',      // Portuguese for Whisper
    model: 'whisper-1'
  },
  
  // LLM Configuration
  LLM: {
    locale: 'pt-BR',
    system_prompt_prefix: 'IMPORTANTE: Responda EXCLUSIVAMENTE em português do Brasil (pt-BR). Evite anglicismos desnecessários.',
    fallback_responses: {
      error: 'Desculpe, houve um erro. Pode tentar novamente?',
      timeout: 'O tempo limite foi atingido. Vamos continuar.',
      no_input: 'Não consegui ouvir sua resposta. Pode repetir?'
    }
  },
  
  // Web Speech API Configuration (if used directly)
  WEB_SPEECH: {
    lang: 'pt-BR',
    continuous: true,
    interimResults: false,
    maxAlternatives: 1
  },
  
  // Validation patterns for PT-BR content
  VALIDATION: {
    portuguese_indicators: [
      'como', 'por que', 'qual', 'fale', 'sobre', 'descreva', 'conte', 
      'você', 'sua', 'seu', 'empresa', 'trabalho', 'experiência', 
      'projeto', 'equipe', 'resultado', 'desafio', 'responsabilidade',
      'habilidade', 'competência', 'liderança', 'comunicação',
      'ção', 'mente', 'ncia', 'dade', 'ssão', 'tivo', 'tiva'
    ],
    english_indicators: [
      'what', 'how', 'why', 'tell me', 'describe', 'explain', 
      'your experience', 'challenge', 'responsibility', 'leadership',
      'communication', 'project', 'team', 'result', 'company', 'work'
    ]
  }
} as const;

// Validation function to ensure response is in PT-BR
export function isPortugueseBR(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  
  const textLower = text.toLowerCase();
  
  // Check for English indicators (should not be present)
  const hasEnglish = LOCALE_CONFIG.VALIDATION.english_indicators.some(word => 
    textLower.includes(word)
  );
  if (hasEnglish) return false;
  
  // Check for Portuguese indicators (should be present)
  const hasPortuguese = LOCALE_CONFIG.VALIDATION.portuguese_indicators.some(word => 
    textLower.includes(word)
  );
  
  return hasPortuguese;
}

// Configure Web Speech API for PT-BR (if used directly in components)
export function configureWebSpeechForPTBR(): SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  
  const recognition = new SpeechRecognition();
  recognition.lang = LOCALE_CONFIG.WEB_SPEECH.lang;
  recognition.continuous = LOCALE_CONFIG.WEB_SPEECH.continuous;
  recognition.interimResults = LOCALE_CONFIG.WEB_SPEECH.interimResults;
  recognition.maxAlternatives = LOCALE_CONFIG.WEB_SPEECH.maxAlternatives;
  
  return recognition;
}

// Get PT-BR fallback responses
export function getFallbackResponse(type: 'error' | 'timeout' | 'no_input'): string {
  return LOCALE_CONFIG.LLM.fallback_responses[type];
}

// Export individual configurations for easy access
export const { TTS, STT, LLM, WEB_SPEECH, VALIDATION } = LOCALE_CONFIG;