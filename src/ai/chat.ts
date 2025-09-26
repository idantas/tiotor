// Util: chamada segura ao Chat Completions (JSON)
const OAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

// Extend ImportMeta to include 'env' for Vite
interface ImportMetaEnv {
  VITE_OPENAI_API_KEY?: string;
}

// Extend the global ImportMeta interface for Vite
declare global {
  interface ImportMeta {
    env: ImportMetaEnv;
  }
}

// Função para obter a API key de forma robusta
const getKey = () => {


  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_API_KEY) {
    return import.meta.env.VITE_OPENAI_API_KEY;
  }
  if (typeof window !== 'undefined' && (window as any).OPENAI_API_KEY) {
    return (window as any).OPENAI_API_KEY;
  } 
  throw new Error("No OpenAI API key found");
};

const clean = (o: any) => {
  if (o && typeof o === "object") {
    for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
  }
  return o;
};

export async function chatJSON({
  system,
  user,
  maxTokens = 600,
  temperature = 0.3,
  apiKey
}: {
  system: string;
  user: any;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
}) {
  const body = clean({
    model: MODEL,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user).slice(0, 8000) }
    ]
  });

  const r = await fetch(OAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey || getKey()}`
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const errorText = await r.text().catch(() => "");
    throw new Error(`Chat:${r.status} ${errorText}`);
  }

  const data = await r.json();
  const txt = data?.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error("Failed to parse JSON response");
  }
}

// Simple text call for non-JSON responses
export async function chatText({
  system,
  user,
  maxTokens = 300,
  temperature = 0.3,
  apiKey
}: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
}) {
  const body = clean({
    model: MODEL,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user.slice(0, 4000) }
    ]
  });

  const r = await fetch(OAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey || getKey()}`
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const errorText = await r.text().catch(() => "");
    throw new Error(`Chat:${r.status} ${errorText}`);
  }

  const data = await r.json();
  return data?.choices?.[0]?.message?.content || "";
}

// Batch 0: Sanitizar contexto da empresa/cargo
export async function sanitizeContext({
  company,
  role,
  apiKey
}: {
  company: string;
  role: string;
  apiKey?: string;
}) {
  const system = "IMPORTANTE: Responda EXCLUSIVAMENTE em português do Brasil (pt-BR). Evite anglicismos desnecessários. Resuma esta empresa+cargo em um texto neutro ≤280 caracteres. Sem links, sem listas. Retorne apenas a frase resumida.";
  const user = `${company} | ${role}`;
  
  return chatText({
    system,
    user,
    maxTokens: 100,
    temperature: 0.3,
    apiKey
  });
}

// Batch 1: Gerar pergunta curta e simples - FOCUSED ON SPECIFIC TOPIC
export async function generateShortQuestion({
  topic,
  asked_csv,
  company_280,
  apiKey
}: {
  topic: string;
  asked_csv: string;
  company_280: string;
  apiKey?: string;
}) {
  const system = `IMPORTANTE: Responda EXCLUSIVAMENTE em português do Brasil (pt-BR). Evite anglicismos desnecessários.
Papel: Entrevistador para um tópico específico de entrevista.
Input: UM tópico específico, perguntas já feitas, contexto da empresa.

CRÍTICO: Gere **APENAS** perguntas de entrevista sobre o tópico "${topic}". NÃO pergunte sobre outros tópicos.

Output: **1 pergunta de entrevista em português brasileiro**, **≤14 palavras**, clara, direta. 
**Retorne apenas a pergunta.**`;
  
    const user = `TÓPICO ESPECÍFICO: "${topic}"
   Perguntas já feitas: ${asked_csv.slice(0, 200)}
   Pontos relevantes da vaga: ${company_280}

Gere uma pergunta APENAS sobre "${topic}". Não pergunte sobre outros tópicos.`;

  return chatText({
    system,
    user,
    maxTokens: 50,
    temperature: 0.3,
    apiKey
  });
}

// Batch 2: Avaliar resposta com feedback imediato
export async function evaluateAnswer({
  question,
  answer,
  apiKey
}: {
  question: string;
  answer: string;
  apiKey?: string;
}) {
  const system = `IMPORTANTE: Responda EXCLUSIVAMENTE em português do Brasil (pt-BR). Evite anglicismos desnecessários.
Papel: Coach de Entrevistas Profissionais. Input: pergunta, resposta.
Avalie **clareza, relevância, estrutura, confiança**.
Retorne **JSON** apenas:
{"score":0-100,"strengths":["..."],"fixes":["..."],"tts":"<=120 chars dica do coach"}

* tts fala **1 força + 1 melhoria** em tom empático mas direto, em português brasileiro.
* Máx 2 itens em cada lista.
* Seja específico (ex.: "use método STAR", "dê números/resultados").`;

  return chatJSON({
    system,
    user: {
      question: question.slice(0, 200),
      answer: answer.slice(0, 1000)
    },
    maxTokens: 250,
    temperature: 0.3,
    apiKey
  });
}

// Batch 3: Resumo final em markdown
export async function generateFinalSummary({
  history_json,
  apiKey
}: {
  history_json: any[];
  apiKey?: string;
}) {
  const system = `IMPORTANTE: Responda EXCLUSIVAMENTE em português do Brasil (pt-BR). Evite anglicismos desnecessários.
Papel: Coach de Entrevistas. Input: array de QA (cada item tem pergunta, resposta, pontuação, pontos fortes, melhorias).
Output Markdown **≤600 caracteres**:

* Pontuação Geral: X/100 (média)
* **3 pontos fortes** (bullets)
* **3 melhorias** (bullets)
* **1 dica prática** (1 linha)
Retorne apenas o markdown em português brasileiro.`;

  return chatText({
    system,
    user: JSON.stringify(history_json).slice(0, 3000),
    maxTokens: 200,
    temperature: 0.3,
    apiKey
  });
}

// Legacy functions for backward compatibility
export async function genQuestion({
  active_topic,
  asked_questions,
  company_context,
  max_per_topic,
  apiKey
}: {
  active_topic: string;
  asked_questions: string[];
  company_context: string;
  max_per_topic: number;
  apiKey?: string;
}) {
  // Use new batch system but return compatible format
  const asked_csv = asked_questions.join(", ");
  const company_280 = company_context.slice(0, 280);
  
  try {
    // Limita contexto da vaga a 180 caracteres, remove jargão excessivo
    const vaga_180 = (company_context || "").replace(/\b(empresa|corporativo|stakeholder|sinergia|pipeline|mindset|disruptivo|core business|benchmark|KPI|OKR|framework|roadmap|deliverable|scalabilidade|ownership|empowerment|lean|agile|squad|tribo|vertical|horizontal|cross-functional|end-to-end|touchpoint|pain point|value proposition|business case|blueprint|canvas|pivot|sprint|retrospectiva|standup|workflow|backlog|product owner|scrum master|PO|SM|PM|UX|UI|CX|B2B|B2C|B2E|B2G|B2B2C|B2B2B|B2C2B|B2C2C|B2G2B|B2G2C|B2E2B|B2E2C|B2E2G|B2E2E|B2B2E|B2B2G|B2B2B2C|B2B2C2B|B2B2C2C|B2B2G2B|B2B2G2C|B2B2E2B|B2B2E2C|B2B2E2G|B2B2E2E|B2C2B2B|B2C2B2C|B2C2G2B|B2C2G2C|B2C2E2B|B2C2E2C|B2C2E2G|B2C2E2E|B2G2B2B|B2G2B2C|B2G2C2B|B2G2C2C|B2G2E2B|B2G2E2C|B2G2E2G|B2G2E2E|B2E2B2B|B2E2B2C|B2E2G2B|B2E2G2C|B2E2G2E|B2E2E2B|B2E2E2C|B2E2E2G|B2E2E2E|B2B2B2B|B2B2B2E|B2B2B2G|B2B2B2C|B2B2B2B2C|B2B2B2C2B|B2B2B2C2C|B2B2B2G2B|B2B2B2G2C|B2B2B2E2B|B2B2B2E2C|B2B2B2E2G|B2B2B2E2E|B2B2C2B2B|B2B2C2B2C|B2B2C2G2B|B2B2C2G2C|B2B2C2E2B|B2B2C2E2C|B2B2C2E2G|B2B2C2E2E|B2B2G2B2B|B2B2G2B2C|B2B2G2C2B|B2B2G2C2C|B2B2G2E2B|B2B2G2E2C|B2B2G2E2G|B2B2G2E2E|B2B2E2B2B|B2B2E2B2C|B2B2E2G2B|B2B2E2G2C|B2B2E2G2E|B2B2E2E2B|B2B2E2E2C|B2B2E2E2G|B2B2E2E2E)\b/gi, "").slice(0, 180);
    const question = await generateShortQuestion({
      topic: active_topic,
      asked_csv,
      company_280: vaga_180,
      apiKey
    });
    if (!question || question.trim().length === 0) {
      return { done: true };
    }
    return { question: question.trim() };
  } catch (error) {
    console.error("Question generation error:", error);
    return { done: true };
  }
}

export async function genFeedback({
  question,
  answer,
  topic,
  company_context,
  apiKey
}: {
  question: string;
  answer: string;
  topic: string;
  company_context: string;
  apiKey?: string;
}) {
  try {
    const result = await evaluateAnswer({
      question,
      answer,
      apiKey
    });
    
    return {
      feedback_voice: result.tts || "Boa resposta! Continue praticando.",
      feedback_text: result.fixes?.join(". ") || "Continue praticando para melhorar.",
      scores: {
        fluency: Math.max(0, Math.min(100, result.score - 5 + Math.random() * 10)),
        clarity: Math.max(0, Math.min(100, result.score - 3 + Math.random() * 8)),
        grammar: Math.max(0, Math.min(100, result.score + 2 + Math.random() * 6)),
        relevance: Math.max(0, Math.min(100, result.score - 2 + Math.random() * 8)),
        overall: Math.max(0, Math.min(100, result.score))
      }
    };
  } catch (error) {
    console.error("Feedback generation error:", error);
    return {
      feedback_voice: "Boa resposta! Continue praticando para ganhar mais confiança.",
      feedback_text: "Continue praticando para aprimorar suas habilidades de entrevista.",
      scores: { overall: 75, fluency: 75, clarity: 75, grammar: 75, relevance: 75 }
    };
  }
}

// Validation function to ensure response is in PT-BR
function isPortugueseBR(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  
  // Common Portuguese words and patterns
  const ptBRIndicators = [
    // Common Portuguese words
    'como', 'por que', 'qual', 'fale', 'sobre', 'descreva', 'conte', 'você', 'sua', 'seu',
    'empresa', 'trabalho', 'experiência', 'projeto', 'equipe', 'resultado', 'desafio',
    'responsabilidade', 'habilidade', 'competência', 'liderança', 'comunicação',
    // Portuguese verb endings
    'ção', 'mente', 'ncia', 'dade', 'ssão', 'tivo', 'tiva'
  ];
  
  // English indicators that should NOT be present
  const englishIndicators = [
    'what', 'how', 'why', 'tell me', 'describe', 'explain', 'your experience',
    'challenge', 'responsibility', 'leadership', 'communication', 'project',
    'team', 'result', 'company', 'work'
  ];
  
  const textLower = text.toLowerCase();
  
  // Check for English indicators (should not be present)
  const hasEnglish = englishIndicators.some(word => textLower.includes(word));
  if (hasEnglish) return false;
  
  // Check for Portuguese indicators (should be present)
  const hasPortuguese = ptBRIndicators.some(word => textLower.includes(word));
  
  return hasPortuguese;
}

// Wrapper functions with language validation
export async function validateAndGenerateQuestion({
  topic,
  asked_csv,
  company_280,
  apiKey,
  maxRetries = 2
}: {
  topic: string;
  asked_csv: string;
  company_280: string;
  apiKey?: string;
  maxRetries?: number;
}): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const question = await generateShortQuestion({
        topic,
        asked_csv,
        company_280,
        apiKey
      });
      
      if (isPortugueseBR(question)) {
        return question;
      }
      
      console.warn(`Attempt ${attempt + 1}: Question not in PT-BR, retrying...`);
      if (attempt === maxRetries) {
        // Fallback question in PT-BR
        const fallbackQuestions = [
          "Como você lidaria com esse desafio?",
          "Qual foi sua maior conquista profissional?",
          "Conte sobre sua experiência com liderança.",
          "Por que você se interessa por esta vaga?"
        ];
        return fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
      }
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.warn(`Attempt ${attempt + 1} failed, retrying...`, error);
    }
  }
  
  return "Como você descreveria sua experiência profissional?";
}

export async function validateAndEvaluateAnswer({
  question,
  answer,
  apiKey,
  maxRetries = 2
}: {
  question: string;
  answer: string;
  apiKey?: string;
  maxRetries?: number;
}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await evaluateAnswer({
        question,
        answer,
        apiKey
      });
      
      // Check if feedback is in Portuguese
      const feedbackText = result.tts || result.fixes?.join(" ") || "";
      if (isPortugueseBR(feedbackText)) {
        return result;
      }
      
      console.warn(`Attempt ${attempt + 1}: Feedback not in PT-BR, retrying...`);
      if (attempt === maxRetries) {
        // Fallback feedback in PT-BR
        return {
          score: 75,
          strengths: ["Resposta estruturada"],
          fixes: ["Adicione mais detalhes específicos"],
          tts: "Boa resposta! Tente ser mais específico com exemplos."
        };
      }
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.warn(`Attempt ${attempt + 1} failed, retrying...`, error);
    }
  }
  
  return {
    score: 75,
    strengths: ["Participação ativa"],
    fixes: ["Continue praticando"],
    tts: "Continue assim! Pratique mais para ganhar confiança."
  };
}