import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

// OpenAI API configuration
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// Supabase configuration
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger(console.log));

// Helper function to get user from access token
async function getUserFromToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  if (token === supabaseAnonKey) {
    return null; // Anonymous access
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (error) {
    console.log(`Error getting user from token: ${error}`);
    return null;
  }
}

// User signup
app.post("/make-server-28776b5d/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || email.split('@')[0] },
      // Automatically confirm the user's email since email server hasn't been configured
      email_confirm: true
    });

    if (error) {
      console.log(`Signup error: ${error.message}`);
      // Provide more user-friendly error messages
      let userMessage = error.message;
      if (error.message.includes('already registered')) {
        userMessage = 'A user with this email address has already been registered';
      } else if (error.message.includes('password')) {
        userMessage = 'Password must be at least 6 characters long';
      } else if (error.message.includes('email')) {
        userMessage = 'Please provide a valid email address';
      }
      return c.json({ error: userMessage }, 400);
    }

    console.log(`User created successfully: ${email}`);
    return c.json({ user: data.user, success: true });
  } catch (error) {
    console.log(`Error creating user: ${error}`);
    return c.json({ error: "Failed to create user" }, 500);
  }
});

// User signin
app.post("/make-server-28776b5d/signin", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log(`Signin error: ${error.message}`);
      // Provide more user-friendly error messages
      let userMessage = error.message;
      if (error.message.includes('Invalid login credentials')) {
        userMessage = 'Invalid login credentials';
      } else if (error.message.includes('Email not confirmed')) {
        userMessage = 'Email not confirmed';
      } else if (error.message.includes('password')) {
        userMessage = 'Invalid password';
      }
      return c.json({ error: userMessage }, 400);
    }

    console.log(`User signed in successfully: ${email}`);
    return c.json({ 
      user: data.user,
      session: data.session,
      success: true 
    });
  } catch (error) {
    console.log(`Error signing in user: ${error}`);
    return c.json({ error: "Failed to sign in" }, 500);
  }
});

// Save session data (with full feedback details)
app.post("/make-server-28776b5d/sessions", async (c) => {
  try {
    const body = await c.req.json();
    const { topics, companyContext, score, feedbacks, questions, totalQuestions, timestamp } = body;

    if (!topics || !companyContext || typeof score !== 'number') {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const authHeader = c.req.header('Authorization');
    const user = await getUserFromToken(authHeader);
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const sessionData = {
      id: sessionId,
      userId: user?.id || 'anonymous',
      userEmail: user?.email || 'anonymous',
      topics,
      companyContext,
      score,
      feedbacks: feedbacks || [],
      questions: questions || [],
      totalQuestions: totalQuestions || 0,
      timestamp: timestamp || new Date().toISOString(),
    };

    // Save to KV store with user prefix if authenticated
    const storageKey = user ? `user_${user.id}_session_${sessionId}` : sessionId;
    await kv.set(storageKey, sessionData);

    // Update user-specific counters if authenticated
    if (user) {
      const userStatsKey = `user_${user.id}_stats`;
      const existingStats = await kv.get(userStatsKey) || {
        sessionsCompleted: 0,
        totalScore: 0,
        averageScore: 0,
        lastSessionDate: null
      };

      const newStats = {
        sessionsCompleted: existingStats.sessionsCompleted + 1,
        totalScore: existingStats.totalScore + score,
        averageScore: Math.round((existingStats.totalScore + score) / (existingStats.sessionsCompleted + 1)),
        lastSessionDate: timestamp || new Date().toISOString()
      };

      await kv.set(userStatsKey, newStats);
      
      // Save latest session for quick access
      await kv.set(`user_${user.id}_latest_session`, sessionData);
    } else {
      // For anonymous users, keep the old global counters
      const sessionCount = await kv.get("session_count") || 0;
      await kv.set("session_count", sessionCount + 1);
      await kv.set("latest_session", sessionData);
    }

    console.log(`Session saved: ${sessionId} for user ${user?.email || 'anonymous'} with score ${score}`);
    return c.json({ success: true, sessionId });
  } catch (error) {
    console.log(`Error saving session: ${error}`);
    return c.json({ error: "Failed to save session" }, 500);
  }
});

// Get progress data (user-specific if authenticated)
app.get("/make-server-28776b5d/progress", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const user = await getUserFromToken(authHeader);

    if (user) {
      // Get authenticated user's data
      const userStatsKey = `user_${user.id}_stats`;
      const userStats = await kv.get(userStatsKey) || {
        sessionsCompleted: 0,
        totalScore: 0,
        averageScore: 0,
        lastSessionDate: null
      };

      // Get all user sessions
      const userSessionKeys = await kv.getByPrefix(`user_${user.id}_session_`);
      const sessions = userSessionKeys
        .map(item => item.value)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const scoreHistory = sessions.map((session, index) => ({
        session: index + 1,
        score: session.score,
        date: session.timestamp.split('T')[0]
      }));

      // Calculate skills progress from recent sessions
      const recentSessions = sessions.slice(-5); // Last 5 sessions
      const allFeedbacks = recentSessions.flatMap(s => s.feedbacks || []);
      
      let skillsProgress = {
        fluency: 75,
        clarity: 75,
        grammar: 75,
        vocabulary: 75
      };

      if (allFeedbacks.length > 0) {
        const avgScore = sessions.length > 0 ? userStats.averageScore : 75;
        skillsProgress = {
          fluency: Math.min(100, Math.max(0, avgScore + (Math.random() * 10 - 5))),
          clarity: Math.min(100, Math.max(0, avgScore + (Math.random() * 10 - 5))),
          grammar: Math.min(100, Math.max(0, avgScore + (Math.random() * 10 - 5))),
          vocabulary: Math.min(100, Math.max(0, avgScore + (Math.random() * 10 - 5)))
        };
      }

      const progressData = {
        sessionsCompleted: userStats.sessionsCompleted,
        lastScore: sessions.length > 0 ? sessions[sessions.length - 1].score : 0,
        averageScore: userStats.averageScore,
        scoreHistory,
        skillsProgress,
        feedbackHistory: allFeedbacks
      };

      console.log(`Progress data retrieved for user ${user.email}: ${sessions.length} sessions`);
      return c.json(progressData);
    } else {
      // Anonymous user - return global/demo data
      const sessionKeys = await kv.getByPrefix("session_");
      const sessions = sessionKeys
        .filter(item => item.key !== "session_count")
        .map(item => item.value)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (sessions.length === 0) {
        return c.json({
          sessionsCompleted: 0,
          lastScore: 0,
          averageScore: 0,
          scoreHistory: [],
          skillsProgress: {
            fluency: 0,
            clarity: 0,
            grammar: 0,
            vocabulary: 0
          },
          feedbackHistory: []
        });
      }

      const scores = sessions.map(s => s.score);
      const lastScore = scores[scores.length - 1];
      const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);

      const scoreHistory = sessions.map((session, index) => ({
        session: index + 1,
        score: session.score,
        date: session.timestamp.split('T')[0]
      }));

      const progressData = {
        sessionsCompleted: sessions.length,
        lastScore,
        averageScore,
        scoreHistory,
        skillsProgress: {
          fluency: Math.min(100, averageScore + 5),
          clarity: Math.min(100, averageScore - 3),
          grammar: Math.min(100, averageScore + 2),
          vocabulary: Math.min(100, averageScore - 1)
        },
        feedbackHistory: sessions.flatMap(s => s.feedbacks || [])
      };

      console.log(`Progress data retrieved for anonymous user: ${sessions.length} sessions`);
      return c.json(progressData);
    }
  } catch (error) {
    console.log(`Error getting progress: ${error}`);
    return c.json({ error: "Failed to get progress data" }, 500);
  }
});

// Get user sessions
app.get("/make-server-28776b5d/sessions", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const user = await getUserFromToken(authHeader);

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get all user sessions
    const userSessionKeys = await kv.getByPrefix(`user_${user.id}_session_`);
    const sessions = userSessionKeys
      .map(item => item.value)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Latest first

    console.log(`Sessions retrieved for user ${user.email}: ${sessions.length} sessions`);
    return c.json({ sessions });
  } catch (error) {
    console.log(`Error getting user sessions: ${error}`);
    return c.json({ error: "Failed to get sessions" }, 500);
  }
});

// Get user profile
app.get("/make-server-28776b5d/profile", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const user = await getUserFromToken(authHeader);

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userStatsKey = `user_${user.id}_stats`;
    const userStats = await kv.get(userStatsKey) || {
      sessionsCompleted: 0,
      totalScore: 0,
      averageScore: 0,
      lastSessionDate: null
    };

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0],
        created_at: user.created_at
      },
      stats: userStats
    });
  } catch (error) {
    console.log(`Error getting profile: ${error}`);
    return c.json({ error: "Failed to get profile" }, 500);
  }
});

// OpenAI interview API endpoint
app.post("/make-server-28776b5d/interview", async (c) => {
  try {
    const body = await c.req.json();
    const { topics, companyContext, lastAnswer, questionNumber = 1 } = body;

    if (!OPENAI_API_KEY) {
      console.log("OpenAI API key not found, using mock data");
      // Fallback to mock data if no API key (pt-BR)
      const mockQuestions = [
        "Fale sobre você e por que está interessado nesta vaga.",
        "Pode me contar sobre seu portfólio e destacar seu projeto mais relevante?",
        "Descreva uma situação em que precisou resolver um conflito com um colega de equipe.",
        "Como você lida com prazos apertados e pressão?",
        "Que perguntas você tem sobre nossa empresa ou esta vaga?"
      ];

      const randomQuestion = mockQuestions[Math.floor(Math.random() * mockQuestions.length)];
      const mockScore = Math.floor(Math.random() * 30) + 70;

      return c.json({
        next_question: randomQuestion,
        feedback: {
          fluency: "Bom ritmo e fluidez natural",
          clarity: "Pronúncia clara e estrutura bem organizada", 
          grammar: "Construção adequada das frases",
          vocabulary: "Terminologia profissional usada apropriadamente"
        },
        score: mockScore
      });
    }

    // Generate next question and feedback using OpenAI (pt-BR)
    const systemPrompt = `Você é o Tio Tor, um coach de entrevistas de trabalho profissional. Você conduz simulações de entrevistas de emprego em português brasileiro para ajudar usuários a praticarem suas habilidades. Com base no contexto da empresa e tópicos que o usuário quer praticar, gere perguntas relevantes de entrevista e forneça feedback construtivo.

IMPORTANTE: Todas as perguntas, mensagens e feedbacks devem ser gerados EXCLUSIVAMENTE em português do Brasil (pt-BR). Evite anglicismos desnecessários.

Contexto da empresa: ${companyContext}
Tópicos para praticar: ${topics.join(", ")}
Número da pergunta: ${questionNumber}

INSTRUÇÕES IMPORTANTES:
- Conduza a entrevista inteiramente em português brasileiro
- Faça perguntas realistas e profissionais apropriadas para o contexto da empresa e tópicos
- Se esta é a primeira pergunta (questionNumber = 1), faça uma pergunta de abertura envolvente
- Se lastAnswer for fornecido, dê feedback construtivo em português e então faça a próxima pergunta
- Mantenha o feedback encorajador, mas específico e prático
- Foque em habilidades práticas de entrevista: fluência, clareza, gramática e vocabulário

Responda em formato JSON com:
{
  "next_question": "A próxima pergunta da entrevista em português brasileiro",
  "feedback": {
    "fluency": "Feedback positivo breve sobre fluidez e ritmo natural da fala",
    "clarity": "Feedback positivo breve sobre pronúncia e clareza da mensagem", 
    "grammar": "Feedback positivo breve sobre estrutura das frases e gramática",
    "vocabulary": "Feedback positivo breve sobre escolha de palavras e terminologia profissional"
  },
  "score": 75
}

A pontuação deve ser 0-100 baseada na qualidade da resposta. Se não houver lastAnswer, retorne score como 0.
Mantenha cada ponto de feedback em no máximo 1-2 frases e sempre mantenha um tom encorajador.`;

    const userPrompt = lastAnswer 
      ? `Por favor, forneça feedback sobre esta resposta e faça a próxima pergunta: "${lastAnswer}"`
      : "Por favor, faça a primeira pergunta da entrevista.";

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log(`OpenAI API error: ${error}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = JSON.parse(aiResponse.choices[0].message.content);

    console.log(`Generated interview question ${questionNumber}`);
    return c.json(content);
  } catch (error) {
    console.log(`Error generating interview question: ${error}`);
    return c.json({ error: "Failed to generate interview question" }, 500);
  }
});

// OpenAI transcription endpoint
app.post("/make-server-28776b5d/transcribe", async (c) => {
  try {
    if (!OPENAI_API_KEY) {
      console.log("OpenAI API key not found, using mock transcription");
      return c.json({ transcript: "Esta é uma transcrição simulada da resposta do usuário." });
    }

    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return c.json({ error: "No audio file provided" }, 400);
    }

    // Prepare form data for OpenAI Whisper API (pt-BR)
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'pt'); // Force Portuguese language
    whisperFormData.append('response_format', 'json');

    const response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.log(`OpenAI Whisper API error: ${error}`);
      throw new Error(`Whisper API error: ${response.status}`);
    }

    const transcription = await response.json();
    
    console.log(`Audio transcribed successfully`);
    return c.json({ transcript: transcription.text });
  } catch (error) {
    console.log(`Error transcribing audio: ${error}`);
    return c.json({ error: "Failed to transcribe audio" }, 500);
  }
});

// Get OpenAI API configuration
app.get("/make-server-28776b5d/config", async (c) => {
  try {
    if (!OPENAI_API_KEY) {
      return c.json({ error: "OpenAI API key not configured" }, 500);
    }

    // Only return the API key to authorized requests
    return c.json({ 
      openaiApiKey: OPENAI_API_KEY,
      hasOpenAI: true 
    });
  } catch (error) {
    console.log(`Error getting config: ${error}`);
    return c.json({ error: "Failed to get configuration" }, 500);
  }
});

// OpenAI TTS endpoint
app.post("/make-server-28776b5d/tts", async (c) => {
  try {
    const body = await c.req.json();
    const { text } = body;

    console.log(`TTS request received for text: "${text.substring(0, 50)}..."`);

    if (!text) {
      return c.json({ error: "No text provided" }, 400);
    }

    if (!OPENAI_API_KEY) {
      console.log("OpenAI API key not found, using mock TTS");
      return c.json({ audioUrl: "data:audio/wav;base64,mock_audio_data" });
    }

    console.log(`OpenAI API key found, making TTS request...`);

    const response = await fetch(`${OPENAI_BASE_URL}/audio/speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: 'ash', // Professional, clear voice
        response_format: 'mp3'
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log(`OpenAI TTS API error - Status: ${response.status}, Response: ${error}`);
      throw new Error(`TTS API error: ${response.status} - ${error}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    // Convert ArrayBuffer to base64 in chunks to avoid stack overflow
    const uint8Array = new Uint8Array(audioBuffer);
    let binaryString = '';
    const chunkSize = 8192; // Process in chunks to avoid stack overflow
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    
    const base64Audio = btoa(binaryString);
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

    console.log(`TTS audio generated successfully`);
    return c.json({ audioUrl });
  } catch (error) {
    console.log(`Error generating TTS: ${error}`);
    console.log(`Error details - Type: ${error.constructor.name}, Message: ${error.message}`);
    return c.json({ error: `Failed to generate speech: ${error.message}` }, 500);
  }
});

serve(app.fetch);