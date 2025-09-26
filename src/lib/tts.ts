// src/lib/tts.ts

// Configuração global de voz padrão
export const defaultTtsVoice = "Echo";
// Helper para TTS centralizado, sempre via backend

export async function speakPTBR(text: string): Promise<void> {
  // Chama rota backend (proxy), nunca OpenAI direto
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: 'pt-BR', voice: defaultTtsVoice })
    });
    if (!response.ok) throw new Error('Erro ao gerar áudio TTS');
    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);
    return await playAudio(audioUrl);
  } catch (err) {
    // Fallback Web Speech API
    return await speakWebSpeech(text);
  }
}

function playAudio(audioUrl: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(audioUrl);
    audio.onended = () => resolve();
    audio.play();
  });
}

async function speakWebSpeech(text: string): Promise<void> {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (!voices.length) {
    // Chrome: voices may not be loaded yet
    await new Promise(res => {
      window.speechSynthesis.onvoiceschanged = res;
    });
    voices = synth.getVoices();
  }
  let voice = voices.find(v => v.name.includes('Echo'));
  if (!voice) {
    // fallback: pt-BR, pt, qualquer voz
    voice = voices.find(v => v.lang === 'pt-BR') || voices.find(v => v.lang.startsWith('pt')) || voices[0];
  }
  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice || null;
    utter.lang = 'pt-BR';
    utter.onend = () => resolve();
    synth.speak(utter);
  });
}
