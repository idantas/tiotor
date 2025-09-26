  // Mensagens curtas PT-BR
  const MSG_TTS_FAIL = "Falha ao gerar áudio. Vou seguir sem voz.";
  const MSG_MIC_DENIED = "Preciso do microfone. Libere nas permissões do navegador e clique em Tentar novamente.";
  const MSG_STT_ABORT = "Transcrição interrompida. Vamos tentar de novo?";
  const MSG_TIMER = "⏱️ Tempo esgotado. Você pode tentar novamente ou seguir para a próxima pergunta.";
  const MSG_RETRY = "Fale mais perto do microfone e evite ruído.";
import Countdown from './Countdown';
import { useCountdown } from '../hooks/useCountdown';
import { speakPTBR } from '../lib/tts';
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Volume2,
  Brain,
  Mic,
  Check,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  Timer,
  Send,
} from "lucide-react";
import { TioAvatar } from "./TioAvatar";
import { 
  startSession, 
  endSession, 
  isSessionActive, 
  userDone, 
  isWaitingForUserDone,
  isRecording,
  isTTSSpeaking,
} from "../lib/session-engine";
import { ENGINE } from "../lib/session-config";
import type { SessionData } from "../App";

// Helper for env vars (Vite-style)
function getEnv(key: string, fallback?: string): string {
  // @ts-ignore
  const value = import.meta.env[`VITE_${key}`];
  return (typeof value === "string" && value !== undefined) ? value : (fallback || "");
}

interface SessionScreenProps {
  sessionData: SessionData;
  onSessionComplete: (sessionResults: SessionResults) => void;
  onQuestionAnswered?: (feedbackData: FeedbackData) => void;
  onViewProgress: () => void;
  isFirstSession?: boolean;
  userAccessToken?: string;
  showImmediateFeedback?: boolean;
}

export interface SessionResults {
  score: number;
  feedbacks: FeedbackData[];
  questions: QuestionData[];
  totalQuestions: number;
  finalSummary?: string;
}

export interface FeedbackData {
  questionNumber: number;
  question: string;
  userAnswer: string;
  feedback: {
    clarity: string;
    confidence: string;
    storytelling: string;
    overall: string;
  };
  score: number;
  timestamp: string;
}

export interface QuestionData {
  questionNumber: number;
  question: string;
  answer: string;
  score: number;
}

type SessionState =
  | "initializing"
  | "warming"
  | "introduction"
  | "recording" 
  | "processing"
  | "speaking"
  | "complete"
  | "error";

interface UserResponseState {
  audioBlobUrl?: string;
  transcript?: string;
  durationMs?: number;
  lastAnswerAt?: number;
}

const state = {
  userResponse: {} as UserResponseState,
  lastAnswerAt: 0,
};

function setUserResponse(payload: UserResponseState | string) {
  if (typeof payload === "string") {
    state.userResponse = { transcript: payload };
  } else {
    state.userResponse = payload;
  }
  state.lastAnswerAt = Date.now();
}

export function SessionScreenAdvanced({
  sessionData,
  onSessionComplete,
  onQuestionAnswered,
  onViewProgress,
  isFirstSession = false,
  userAccessToken,
  showImmediateFeedback = true,
}: SessionScreenProps) {
  const [sessionState, setSessionState] = useState<SessionState>("initializing");
  const [permissionError, setPermissionError] = useState<string>("");
  const [microphonePermission, setMicrophonePermission] = useState<"prompt" | "granted" | "denied">("prompt");
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [sessionTimeoutId, setSessionTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const FIVE_MIN = 5 * 60;
  const { label, reset } = useCountdown(FIVE_MIN, isListening && questionCount > 0, handleAutoSend);

  async function handleAutoSend() {
    setIsListening(false);
    reset();
    handleSubmitResponse();
  }

  async function handleManualSend() {
    setIsListening(false);
    reset();
    handleSubmitResponse();
  }
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [sessionResults, setSessionResults] = useState<SessionResults>({
    score: 0,
    feedbacks: [],
    questions: [],
    totalQuestions: 0,
  });
  const [error, setError] = useState<string>("");
  const [lastFeedback, setLastFeedback] = useState<FeedbackData | null>(null);
  const [currentTopic, setCurrentTopic] = useState<string>("");
  const [topicProgress, setTopicProgress] = useState<string>("");
  
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutos
  const [timerActive, setTimerActive] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const [timerBanner, setTimerBanner] = useState<{ questionId: number, elapsed: number } | null>(null);
  const [userAction, setUserAction] = useState<string>("");
  const [isQuestionAudioPlaying, setIsQuestionAudioPlaying] = useState(false);
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [canRespond, setCanRespond] = useState(false);
  const [deviceError, setDeviceError] = useState<string>("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [ttsTimeoutRef, setTtsTimeoutRef] = useState<NodeJS.Timeout | null>(null);

  const initializationRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generateSmartFeedback = (answer: string, score: number, overallFeedback: string) => {
    const answerLength = answer.length;
    const hasStructure =
      answer.toLowerCase().includes("situação") ||
      answer.toLowerCase().includes("tarefa") ||
      answer.toLowerCase().includes("ação") ||
      answer.toLowerCase().includes("resultado");
    return {
      clarity:
        score >= 80
          ? "Resposta objetiva e bem estruturada."
        : score >= 60
          ? "Boa organização, mas pode ser mais direto."
          : "Procure ser mais claro e objetivo.",
      confidence:
        score >= 80
          ? "Tom seguro e convicto durante toda a resposta."
          : score >= 60
          ? "Demonstra confiança, com alguns momentos de hesitação."
          : "Trabalhe a confiança e firmeza na fala.",
      storytelling: hasStructure
        ? "Excelente uso de estrutura narrativa (STAR)."
        : answerLength > 100
          ? "Boa profundidade, mas estruture melhor a resposta."
        : "Desenvolva mais a resposta com exemplos concretos.",
    };
  };

  const completeSession = useCallback(
    (totalQuestions: number, finalSummary?: string) => {
    console.log("🏁 Completing session with", totalQuestions, "questions");
    setSessionState("complete");
      setSessionResults((prevResults) => {
      const finalResults: SessionResults = {
        ...prevResults,
        totalQuestions: totalQuestions,
          finalSummary: finalSummary,
        score: Math.floor(
          prevResults.feedbacks.reduce((sum, f) => sum + f.score, 0) / 
          Math.max(prevResults.feedbacks.length, 1)
        ),
      };
      setTimeout(() => {
        onSessionComplete(finalResults);
      }, 2000);
      return finalResults;
    });
          },
    [onSessionComplete]
      );
      
  const handleSessionUpdate = useCallback(
    (data: any) => {
      console.log("📋 Session update:", data.type, data);

      switch (data.type) {
        case "session_warming":
          setSessionState("warming");
          break;

        case "session_started":
          setSessionState("introduction");
          break;

        case "new_question":
          setCurrentQuestion(data.question);
          setQuestionCount(data.questionNumber);
          setCurrentTopic(data.topic);
          setTopicProgress(data.topicProgress);
          setSessionState("speaking");
          setTimeRemaining(300); // 5 minutos
          setTimerActive(true);
          setUserResponse({ transcript: "", audioBlobUrl: "", durationMs: 0 });
          playQuestionAudio(data.question);
          break;

        case "listening":
          setSessionState("recording");
          setIsListening(true);
          break;
        case "processing":
          setSessionState("processing");
          setIsListening(false);
          reset();
          break;

        case "retry_needed":
          setError(data.message);
          setSessionState("recording");
          setTimeout(() => setError(""), 3000);
          break;

        case "answer_evaluated": {
          setIsListening(false);
          reset();
          const questionData: QuestionData = {
            questionNumber: data.questionNumber,
            question: data.question,
            answer: data.answer,
            score: data.score,
          };
          const smartFeedback = generateSmartFeedback(data.answer, data.score, data.feedback);
          const feedbackData: FeedbackData = {
            questionNumber: data.questionNumber,
            question: data.question,
            userAnswer: data.answer,
            feedback: {
              clarity: smartFeedback.clarity,
              confidence: smartFeedback.confidence,
              storytelling: smartFeedback.storytelling,
              overall: data.feedback,
            },
            score: data.score,
            timestamp: new Date().toISOString(),
          };
          setSessionResults((prev) => ({
            ...prev,
            questions: [...prev.questions, questionData],
            feedbacks: [...prev.feedbacks, feedbackData],
          }));
          setLastFeedback(feedbackData);
          setError(""); // Limpa erro genérico se houver feedback
          if (showImmediateFeedback && onQuestionAnswered) {
            onQuestionAnswered(feedbackData);
          } else {
            setSessionState("speaking");
          }
          break;
        }
        case "session_end":
          if (!sessionEndedRef.current) {
            sessionEndedRef.current = true;
            completeSession(data.totalQuestions, data.finalSummary);
          }
          break;

        case "error":
          setError(data.message);
          setSessionState("error");
          break;
      }
    },
    [completeSession]
    );

  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicrophonePermission("granted");
      setPermissionError("");
      setMicDenied(false);
      setPermissionRequested(true);
      return true;
    } catch (error: any) {
      setMicrophonePermission("denied");
      setPermissionError("Libere o microfone nas permissões do navegador.");
      setMicDenied(true);
      return false;
    }
  };

  const requestMicrophonePermission = async () => {
    const hasPermission = await checkMicrophonePermission();
    if (hasPermission) {
      setTimeout(() => {
        startFastSession();
      }, 200);
    }
  };

  const startFastSession = async () => {
    if (isSessionActive()) {
      console.warn("Session already active, skipping start");
      return;
    }
    let audioChunkReceived = false;
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      console.log("🚀 Starting robust session engine with ENGINE config:", ENGINE);
      timeoutId = setTimeout(() => {
        if (!audioChunkReceived) {
          setError("Tempo esgotado para iniciar sessão. Verifique o microfone e tente novamente.");
          setSessionState("error");
        }
      }, 15000);
      setSessionTimeoutId(timeoutId);
      await startSession(
        sessionData.topics,
        sessionData.companyContext,
        (data: any) => {
          handleSessionUpdate(data);
          if (data.type === "audiochunk") {
            audioChunkReceived = true;
            if (timeoutId) {
              clearTimeout(timeoutId);
              setSessionTimeoutId(null);
            }
          }
        }
      );
    } catch (error: any) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        setSessionTimeoutId(null);
      }
      let errorMessage = "Falha ao iniciar sessão. Tente novamente.";
      if (error.message.includes("timeout")) {
        errorMessage = "Tempo esgotado para iniciar sessão. Verifique o microfone e tente novamente.";
      } else if (error.message.includes("microphone")) {
        errorMessage = "Microfone negado. Libere o microfone nas permissões do navegador.";
      } else if (error.message.includes("audio")) {
        errorMessage = "Erro no sistema de áudio. Tente novamente.";
      } else if (error.message.includes("denied")) {
        errorMessage = "Microfone negado. Libere o microfone nas permissões do navegador.";
      }
      setError(errorMessage);
      setSessionState("error");
    }
  };

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setTimerActive(false);
          stopTimer();
          // Parar gravação ativa
          if (isRecording()) {
            userDone();
          }
          setTimerExpired(true);
          setTimerBanner({ questionId: questionCount, elapsed: FIVE_MIN });
          // Logar evento
          console.log('timer_expired', { questionId: questionCount, elapsed: FIVE_MIN, user_action: null });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isRecording, userDone, questionCount, FIVE_MIN]);
  // Handler para ações do banner
  const handleTimerRetry = () => {
    setUserAction('retry');
    setTimerExpired(false);
    setTimerBanner(null);
    setTimeRemaining(FIVE_MIN);
    setTimerActive(true);
    // Logar evento
    console.log('timer_expired', { questionId: questionCount, elapsed: FIVE_MIN, user_action: 'retry' });
    // Reinicia mesma pergunta (mantém questionCount)
    setSessionState('speaking');
    playQuestionAudio(currentQuestion);
  };

  const handleTimerNext = () => {
    setUserAction('next');
    setTimerExpired(false);
    setTimerBanner(null);
    // Logar evento
    console.log('timer_expired', { questionId: questionCount, elapsed: FIVE_MIN, user_action: 'next' });
    // Avança como "sem envio por tempo"
    setSessionState('processing');
    // Aqui pode registrar no backend/local que não houve envio
    // e chamar handleSessionUpdate para avançar
    handleSessionUpdate({
      type: 'answer_evaluated',
      questionNumber: questionCount,
      question: currentQuestion,
      answer: '',
      feedback: 'Sem resposta por tempo esgotado.',
      score: 0,
    });
  };

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerActive(false);
  }, []);

  // Helper centralizado para falar pergunta
  const playQuestionAudio = async (question: string) => {
    setIsQuestionAudioPlaying(true);
    setIsSpeaking(true);
    setCanRespond(false);
    try {
      await speakPTBR(question);
    } catch (error) {
      console.error("Erro ao falar pergunta:", error);
      setError(MSG_TTS_FAIL);
    }
    setIsQuestionAudioPlaying(false);
    setIsSpeaking(false);
    setCanRespond(true);
    setSessionState("recording");
    startTimer();
  };

  const handleTTSError = (question: string) => {
    setIsQuestionAudioPlaying(false);
    setIsSpeaking(false);
    setCanRespond(true);
    setSessionState("recording");
    startTimer();

    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
  };

  const handleSubmitResponse = () => {
    stopTimer();
    
    if (sessionState === "recording" && (isWaitingForUserDone() || isRecording())) {
      console.log("🎤 User submitted voice response - stopping recording");
      if (!state.userResponse.transcript && !state.userResponse.audioBlobUrl) {
        setUserResponse({
          transcript: "Resposta por áudio gravada",
          audioBlobUrl: "",
          durationMs: Date.now() - state.lastAnswerAt,
        });
      }
      userDone();
    }
  };

  const handleImDone = () => {
    if (!canRespond || isSpeaking) {
      console.log("🚫 Cannot respond yet, TTS still active");
      return;
    }
    if (debounceRef.current) return;
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
    }, 300);
    handleSubmitResponse();
  };
  useEffect(() => {
    const handleDeviceChange = () => {
      setDeviceError("Microfone desconectado. Reconnecte e tente novamente.");
      setSessionState("error");
    };
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, []);

  useEffect(() => {
    if (initializationRef.current) return;
    initializationRef.current = true;

    const initializeSession = async () => {
      try {
        console.log("🔊 Initializing robust session with ENGINE config:", ENGINE);

        const initTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Initialization timeout")), 5000)
        );
        
        const hasPermission = await Promise.race([
          checkMicrophonePermission(),
          initTimeout,
        ]);
        
        if (hasPermission) {
          console.log("🎤 Microphone permission granted");
        }
      } catch (error) {
        console.error("Failed to initialize session:", error);
        setError("Failed to initialize session. Please refresh the page.");
        setSessionState("error");
      }
    };

    initializeSession();

    return () => {
      try {
        if (isSessionActive()) {
          endSession();
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        if (audioRef.current) {
          audioRef.current.pause();
        }
        if (ttsTimeoutRef) {
          clearTimeout(ttsTimeoutRef);
        }
      } catch (error) {
        console.warn("Error during cleanup:", error);
      }
    };
  }, []);

  useEffect(() => {
    if (timerActive && sessionState === "recording") {
      startTimer();
    } else {
      stopTimer();
    }
    
    return () => stopTimer();
  }, [timerActive, sessionState, startTimer, stopTimer]);

  const handleRetry = () => {
    setError("");
    setSessionState("initializing");
    setPermissionRequested(false);
    setMicDenied(false);
    initializationRef.current = false;
    if (sessionTimeoutId) {
      clearTimeout(sessionTimeoutId);
      setSessionTimeoutId(null);
    }
    setTimeout(() => {
      initializationRef.current = false;
      checkMicrophonePermission();
    }, 500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusDisplay = () => {
    switch (sessionState) {
      case "initializing":
        return {
          text: "Inicializando...",
          icon: <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto"></div>,
        };
      case "speaking":
        return {
          text: isQuestionAudioPlaying
            ? "Reproduzindo pergunta..."
            : "Preparando pergunta...",
          icon: <Volume2 className="h-4 w-4 text-primary animate-pulse" />,
        };
      case "recording":
        return {
          text: "Sua vez de responder",
          icon: <Mic className="h-4 w-4 text-red-500 animate-pulse" />,
        };
      case "processing":
        return {
          text: "Analisando resposta...",
          icon: <Brain className="h-4 w-4 text-primary animate-pulse" />,
        };
      case "complete":
        return {
          text: "Simulação concluída!",
          icon: <Check className="h-4 w-4 text-green-500" />,
        };
      case "error":
        return {
          text: "Erro na simulação",
          icon: <AlertCircle className="h-4 w-4 text-destructive" />,
        };
      default:
        return {
          text: "Pronto",
          icon: <div className="h-4 w-4"></div>,
        };
    }
  };

  const getAvatarState = () => {
    if (isTTSSpeaking()) return "speaking";
    if (isRecording()) return "listening";
    switch (sessionState) {
      case "recording":
        return "listening";
      case "processing":
        return "thinking";
      case "speaking":
      case "introduction":
        return "speaking";
      default:
        return "idle";
    }
  };

  if (timerBanner) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="mx-auto flex items-center justify-center">
              <TioAvatar size="lg" state="idle" />
            </div>
            <div>
              <h1>⏱️ Tempo esgotado</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {MSG_TIMER}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleTimerRetry} className="flex-1 bg-primary text-primary-foreground">Tentar novamente</Button>
            <Button onClick={handleTimerNext} className="flex-1 bg-muted text-muted-foreground">Próxima</Button>
          </div>
        </div>
      </div>
    );
  }
  if (deviceError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="mx-auto flex items-center justify-center">
              <TioAvatar size="lg" state="idle" />
            </div>
            <div>
              <h1>Microfone desconectado</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Reconnecte o microfone e tente novamente.
              </p>
            </div>
          </div>
          <Button
            onClick={handleRetry}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }
  if (microphonePermission !== "granted") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="mx-auto flex items-center justify-center">
              <TioAvatar size="lg" state="idle" />
            </div>
            <div>
              <h1>Bem-vindo ao Tio Tor</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Preciso de acesso ao microfone para conduzir sua simulação de entrevista.
              </p>
            </div>
          </div>
          {micDenied && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">Libere o microfone nas permissões do navegador.</p>
              </div>
            </div>
          )}
          <Button
            onClick={requestMicrophonePermission}
            disabled={permissionRequested && microphonePermission === "denied"}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Mic className="h-4 w-4 mr-2" />
            Permitir Acesso ao Microfone
          </Button>
        </div>
      </div>
    );
  }

  const statusDisplay = getStatusDisplay();

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center">
            <TioAvatar size="lg" state={getAvatarState()} />
          </div>
          <h1>Tio Tor</h1>
          {process.env.NODE_ENV === "development" && questionCount > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              Topic: {currentTopic} | Progress: {topicProgress}
            </div>
          )}
        </div>

        {currentQuestion &&
          (sessionState === "speaking" || sessionState === "recording") && (
            <div className="space-y-2">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start space-x-2 mb-3">
                  <div className="h-2 w-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-foreground leading-relaxed">{currentQuestion}</p>
                </div>
                {isQuestionAudioPlaying && (
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <Volume2 className="h-3 w-3 animate-pulse" />
                    <span>Reproduzindo pergunta...</span>
                  </div>
                )}
              </div>
            </div>
        )}

        {sessionState === "recording" && (
          <div className="flex flex-col items-center gap-5 mt-10">
            <div className="w-full flex justify-center">
              <Countdown label={label} />
            </div>
            <Button
              onClick={handleManualSend}
              variant="default"
              size="lg"
              disabled={!canRespond || isSpeaking || !isListening}
              className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-8 py-3"
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar resposta
            </Button>
          </div>
        )}

        {sessionState === "complete" && (
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <Check className="h-8 w-8 text-green-500 mx-auto" />
              <h3>Excelente trabalho!</h3>
              <p className="text-sm text-muted-foreground">
                Sua simulação de entrevista foi concluída com sucesso.
              </p>
              <div className="bg-card border border-border rounded-lg p-4 text-left mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    Perguntas respondidas
                  </span>
                  <span className="text-sm font-medium">
                    {sessionResults.questions.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Pontuação geral
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {sessionResults.score}/100
                  </span>
                </div>
              </div>
              {sessionResults.finalSummary && (
                <div className="bg-accent p-4 rounded-lg text-left mt-4">
                  <div 
                    className="text-sm prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: sessionResults.finalSummary.replace(/\n/g, "<br/>"),
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Painel de feedback após resposta */}
        {lastFeedback && sessionState !== "complete" && (
          <div className="bg-card border border-border rounded-lg p-4 mt-4">
            <div className="mb-2">
              <strong>Pergunta {lastFeedback.questionNumber} - {currentTopic}</strong>
              <span className="ml-2 text-xs text-muted-foreground">Progresso: {topicProgress}</span>
            </div>
            <div className="mb-2">
              <span className="text-sm font-medium text-muted-foreground">Feedback do Tio Tor:</span>
              <ul className="list-disc pl-5 mt-1 text-sm">
                <li><strong>Clareza:</strong> {lastFeedback.feedback.clarity}</li>
                <li><strong>Storytelling/Técnico:</strong> {lastFeedback.feedback.storytelling}</li>
                <li><strong>Mercado:</strong> {lastFeedback.feedback.overall}</li>
              </ul>
            </div>
            <div className="mt-2">
              <span className="text-sm font-medium text-muted-foreground">Nota:</span>
              <span className="ml-2 text-lg font-bold text-primary">{lastFeedback.score}/100</span>
              <span className="ml-2 text-xs text-muted-foreground">({lastFeedback.score >= 85 ? "Excelente" : lastFeedback.score >= 70 ? "Bom" : "Precisa melhorar"})</span>
            </div>
          </div>
        )}
        {/* Mensagem de erro só se não houver feedback */}
        {error && !lastFeedback && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setError("")}
                className="flex-1"
              >
                Dispensar
              </Button>
              {sessionState === "error" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleRetry}
                  className="flex-1"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Tentar Novamente
                </Button>
              )}
            </div>
          </div>
        )}

        {userAccessToken &&
          sessionState !== "initializing" &&
          sessionState !== "complete" && (
            <div className="text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={onViewProgress}
                className="text-xs"
              >
                Ver Progresso
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}
