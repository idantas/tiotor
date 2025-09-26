import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Volume2,
  Brain,
  Pause,
  Play,
  Square,
  AlertCircle,
  Mic,
} from "lucide-react";
import { TioAvatar } from "./TioAvatar";
import type { SessionData } from "../App";

interface SessionScreenProps {
  sessionData: SessionData;
  onSessionComplete: (sessionResults: SessionResults) => void;
  onViewProgress: () => void;
  isFirstSession?: boolean;
  userAccessToken?: string;
}

export interface SessionResults {
  score: number;
  feedbacks: FeedbackData[];
  questions: QuestionData[];
  totalQuestions: number;
}

export interface FeedbackData {
  questionNumber: number;
  question: string;
  userAnswer: string;
  feedback: {
    fluency: string;
    clarity: string;
    grammar: string;
    vocabulary: string;
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
  | "introduction"
  | "recording"
  | "processing"
  | "speaking"
  | "paused"
  | "complete";

export function SessionScreen({
  sessionData,
  onSessionComplete,
  onViewProgress,
  isFirstSession = false,
  userAccessToken,
}: SessionScreenProps) {
  const [sessionState, setSessionState] =
    useState<SessionState>("initializing");
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [permissionError, setPermissionError] =
    useState<string>("");
  const [microphonePermission, setMicrophonePermission] =
    useState<"prompt" | "granted" | "denied">("prompt");
  const [permissionRequested, setPermissionRequested] =
    useState(false);
  const [sessionInitialized, setSessionInitialized] =
    useState(false);
  const [currentAudio, setCurrentAudio] =
    useState<HTMLAudioElement | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [currentQuestion, setCurrentQuestion] =
    useState<string>("");
  const [sessionResults, setSessionResults] =
    useState<SessionResults>({
      score: 0,
      feedbacks: [],
      questions: [],
      totalQuestions: 0,
    });
  const [hasIntroduced, setHasIntroduced] = useState(false);

  // Audio analysis for silence detection
  const [audioContext, setAudioContext] =
    useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(
    null,
  );
  const [silenceTimeout, setSilenceTimeout] =
    useState<NodeJS.Timeout | null>(null);
  const [isAnalysingAudio, setIsAnalysingAudio] =
    useState(false);
  const [speechStarted, setSpeechStarted] = useState(false);
  const [speechTimeout, setSpeechTimeout] =
    useState<NodeJS.Timeout | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const initializationStarted = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!initializationStarted.current) {
      initializationStarted.current = true;
      checkMicrophonePermission();
    }

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (
      microphonePermission === "granted" &&
      !sessionInitialized
    ) {
      setSessionInitialized(true);
      setTimeout(() => {
        if (isFirstSession && !hasIntroduced) {
          introduceUncle();
        } else {
          generateFirstQuestion();
        }
      }, 500);
    }
  }, [
    microphonePermission,
    sessionInitialized,
    isFirstSession,
    hasIntroduced,
  ]);

  const cleanup = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());
    }
    if (audioContext) {
      audioContext.close();
    }
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
    }
    if (speechTimeout) {
      clearTimeout(speechTimeout);
    }
  };

  const checkMicrophonePermission = async () => {
    try {
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        setMicrophonePermission(
          permission.state as "prompt" | "granted" | "denied",
        );
      }
    } catch (error) {
      console.log("Permission API not supported");
    }
  };

  const introduceUncle = async () => {
    const introText = `Hello! I'm Tio Tor, your personal English interview coach. I'm here to help you practice and improve your communication skills. We'll start with some questions based on the topics you've chosen. Remember: answer in English, be natural, and don't worry about small mistakes. The important thing is to practice! Let's begin!`;

    setHasIntroduced(true);
    setSessionState("introduction");
    await speakText(introText, () => {
      generateFirstQuestion();
    });
  };

  const generateFirstQuestion = async () => {
    if (questionCount > 0) {
      return;
    }

    try {
      const { projectId, publicAnonKey } = await import(
        "../utils/supabase/info"
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        8000,
      );

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-28776b5d/interview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            topics: sessionData.topics,
            companyContext: sessionData.companyContext,
            questionNumber: 1,
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Failed to generate question");
      }

      const questionData = await response.json();
      setCurrentQuestion(questionData.next_question);
      setQuestionCount(1);
      await speakQuestion(questionData.next_question);
    } catch (error) {
      console.error("Error generating first question:", error);
      const fallbackQuestion =
        "Tell me about yourself and your experience";
      setCurrentQuestion(fallbackQuestion);
      setQuestionCount(1);
      await speakQuestion(fallbackQuestion);
    }
  };

  const speakQuestion = async (question: string) => {
    await speakText(question, () => {
      startRecording();
    });
  };

  const speakText = async (
    text: string,
    onComplete?: () => void,
  ) => {
    if (sessionState === "speaking") {
      return;
    }

    setSessionState("speaking");

    try {
      const { projectId, publicAnonKey } = await import(
        "../utils/supabase/info"
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        6000,
      );

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-28776b5d/tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`TTS failed: ${response.status}`);
      }

      const ttsData = await response.json();

      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      const audio = new Audio(ttsData.audioUrl);
      setCurrentAudio(audio);

      audio.preload = "auto";

      let hasStartedPlaying = false;

      const playAudio = () => {
        if (hasStartedPlaying) return;
        hasStartedPlaying = true;

        audio.play().catch((playError) => {
          console.error("Audio play failed:", playError);
          if (onComplete) onComplete();
        });
      };

      audio.onended = () => {
        if (onComplete) onComplete();
      };

      audio.onerror = () => {
        console.error("Audio playback failed");
        if (onComplete) onComplete();
      };

      audio.onloadeddata = () => {
        playAudio();
      };

      setTimeout(() => {
        if (!hasStartedPlaying && audio.readyState >= 1) {
          playAudio();
        }
      }, 100);

      setTimeout(() => {
        if (!hasStartedPlaying) {
          playAudio();
        }
      }, 300);
    } catch (error) {
      console.error("Error with TTS:", error);
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 800);
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      setPermissionError("");
      setPermissionRequested(true);

      if (
        !window.isSecureContext &&
        location.hostname !== "localhost"
      ) {
        throw new Error(
          "Microphone access requires HTTPS or localhost",
        );
      }

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Browser does not support microphone access",
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!stream || stream.getAudioTracks().length === 0) {
        throw new Error("No audio tracks available");
      }

      stream.getTracks().forEach((track) => track.stop());
      setMicrophonePermission("granted");

      if (!sessionInitialized) {
        setSessionInitialized(true);
        setTimeout(() => {
          if (isFirstSession && !hasIntroduced) {
            introduceUncle();
          } else {
            generateFirstQuestion();
          }
        }, 500);
      }
    } catch (error) {
      console.error(
        "Error requesting microphone permission:",
        error,
      );

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          setPermissionError(
            "Microphone access was denied. Please allow microphone access in your browser settings.",
          );
          setMicrophonePermission("denied");
        } else if (error.name === "NotFoundError") {
          setPermissionError(
            "No microphone detected. Please connect a microphone and try again.",
          );
          setMicrophonePermission("denied");
        } else if (
          error.name === "NotSupportedError" ||
          error.message.includes("does not support")
        ) {
          setPermissionError(
            "Your browser doesn't support audio recording. Try Chrome, Firefox, or Safari.",
          );
          setMicrophonePermission("denied");
        } else if (
          error.name === "SecurityError" ||
          error.message.includes("HTTPS")
        ) {
          setPermissionError(
            "Microphone access requires a secure connection (HTTPS). Please access the site over HTTPS.",
          );
          setMicrophonePermission("denied");
        } else if (error.name === "AbortError") {
          setPermissionError(
            "Permission request was interrupted. Please try again.",
          );
          setMicrophonePermission("denied");
        } else {
          setPermissionError(
            `Microphone setup failed: ${error.message}. Please check your microphone settings.`,
          );
          setMicrophonePermission("denied");
        }
      } else {
        setPermissionError(
          "Microphone access failed. Please check your microphone settings.",
        );
        setMicrophonePermission("denied");
      }
    }
  };

  const setupAudioAnalysis = (stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const analyserNode = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);

      analyserNode.fftSize = 512;
      analyserNode.smoothingTimeConstant = 0.8;
      source.connect(analyserNode);

      setAudioContext(audioCtx);
      setAnalyser(analyserNode);
      setIsAnalysingAudio(true);
      setSpeechStarted(false);

      monitorSilence(analyserNode);
    } catch (error) {
      console.error("Error setting up audio analysis:", error);
    }
  };

  const monitorSilence = (analyserNode: AnalyserNode) => {
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let lastSpeechTime = Date.now();

    const checkAudioLevel = () => {
      if (!isAnalysingAudio || sessionState !== "recording")
        return;

      analyserNode.getByteFrequencyData(dataArray);

      // Calculate average volume level
      const average =
        dataArray.reduce((sum, value) => sum + value, 0) /
        bufferLength;
      const volume = average / 255; // Normalize to 0-1

      const now = Date.now();
      const SPEECH_THRESHOLD = 0.02; // Speech detection threshold
      const SILENCE_AFTER_SPEECH_TIMEOUT = 2000; // 2 seconds of silence after speech
      const TOTAL_SILENCE_TIMEOUT = 8000; // 8 seconds total silence timeout

      if (volume > SPEECH_THRESHOLD) {
        // User is speaking
        if (!speechStarted) {
          setSpeechStarted(true);
        }
        lastSpeechTime = now; // Reset silence timer

        // Clear any existing silence timeout
        if (silenceTimeout) {
          clearTimeout(silenceTimeout);
          setSilenceTimeout(null);
        }
      } else {
        // Silence detected
        const silenceDuration = now - lastSpeechTime;

        if (speechStarted) {
          // User was speaking before, now silent
          if (
            silenceDuration > SILENCE_AFTER_SPEECH_TIMEOUT &&
            !silenceTimeout
          ) {
            const timeout = setTimeout(() => {
              if (isRecording && sessionState === "recording") {
                stopRecording();
              }
            }, 100);
            setSilenceTimeout(timeout);
          }
        } else {
          // User hasn't started speaking yet
          if (
            silenceDuration > TOTAL_SILENCE_TIMEOUT &&
            !silenceTimeout
          ) {
            const timeout = setTimeout(() => {
              if (isRecording && sessionState === "recording") {
                stopRecording();
              }
            }, 100);
            setSilenceTimeout(timeout);
          }
        }
      }

      // Continue monitoring
      requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  const startRecording = async () => {
    try {
      setPermissionError("");

      if (microphonePermission === "denied") {
        throw new Error("Microphone permission was denied");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!stream || stream.getAudioTracks().length === 0) {
        throw new Error("Failed to get valid audio stream");
      }

      streamRef.current = stream;
      setupAudioAnalysis(stream);

      let options: MediaRecorderOptions = {};
      if (
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ) {
        options.mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options.mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        options.mimeType = "audio/mp4";
      }

      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });

        if (audioBlob.size > 0) {
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          processAnswer(audioBlob);
        } else {
          setTimeout(() => {
            if (sessionState !== "complete") {
              startRecording();
            }
          }, 1000);
        }

        setIsAnalysingAudio(false);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setPermissionError(
          "Recording error occurred - Please try again",
        );
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setSessionState("recording");
      setMicrophonePermission("granted");

      // Auto stop after 30 seconds
      const maxRecordingTimeout = setTimeout(() => {
        if (isRecording && sessionState === "recording") {
          stopRecording();
        }
      }, 30000);

      setSpeechTimeout(maxRecordingTimeout);
    } catch (error) {
      console.error("Error starting recording:", error);

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          setPermissionError(
            "Microphone access was denied. Please allow microphone access.",
          );
          setMicrophonePermission("denied");
        } else if (error.name === "NotFoundError") {
          setPermissionError(
            "No microphone found. Please connect a microphone.",
          );
          setMicrophonePermission("denied");
        } else if (error.name === "SecurityError") {
          setPermissionError(
            "Security error accessing microphone. Please use HTTPS.",
          );
          setMicrophonePermission("denied");
        } else {
          setPermissionError(
            `Recording failed: ${error.message}. Please check your microphone.`,
          );
        }
      } else {
        setPermissionError(
          "Recording failed - Please check your microphone settings",
        );
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setSessionState("processing");
      setIsAnalysingAudio(false);
      setSpeechStarted(false);

      if (silenceTimeout) {
        clearTimeout(silenceTimeout);
        setSilenceTimeout(null);
      }

      if (speechTimeout) {
        clearTimeout(speechTimeout);
        setSpeechTimeout(null);
      }
    }
  };

  const stopSession = () => {
    cleanup();

    const validScores = sessionResults.feedbacks.map(
      (f) => f.score,
    );
    const averageScore =
      validScores.length > 0
        ? Math.round(
            validScores.reduce((sum, score) => sum + score, 0) /
              validScores.length,
          )
        : 75;

    const finalResults: SessionResults = {
      ...sessionResults,
      score: averageScore,
      totalQuestions: questionCount,
    };

    setSessionState("complete");

    setTimeout(() => {
      onSessionComplete(finalResults);
    }, 1000);
  };

  const processAnswer = async (audioBlob: Blob) => {
    try {
      const { projectId, publicAnonKey } = await import(
        "../utils/supabase/info"
      );

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const transcriptionResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-28776b5d/transcribe`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: formData,
        },
      );

      if (!transcriptionResponse.ok) {
        throw new Error("Transcription failed");
      }

      const transcriptionData =
        await transcriptionResponse.json();
      const transcript = transcriptionData.transcript;

      if (!transcript || transcript.trim().length < 3) {
        setTimeout(() => {
          startRecording();
        }, 1000);
        return;
      }

      // Check for special commands/requests from user
      const transcriptLower = transcript.toLowerCase().trim();

      // 1. Repeat request patterns
      const repeatPatterns = [
        /can you repeat/i,
        /repeat/i,
        /say again/i,
        /what was the question/i,
        /didn't hear/i,
        /didn't catch/i,
        /sorry.*repeat/i,
        /pardon/i,
        /excuse me/i,
        /again please/i,
        /one more time/i,
        /could you say.*again/i,
        /^again$/i,
        /^repeat$/i,
        /^sorry$/i,
        /^pardon$/i,
      ];

      const isRepeatRequest = repeatPatterns.some((pattern) =>
        pattern.test(transcriptLower),
      );

      if (isRepeatRequest) {
        console.log(
          "User requested to repeat question:",
          transcript,
        );

        // Provide friendly acknowledgment and repeat
        const repeatResponses = [
          "Of course! Let me repeat the question for you.",
          "No problem! Here's the question again.",
          "Absolutely! I'll repeat that for you.",
          "Sure thing! Let me ask you again.",
        ];

        const repeatResponse =
          repeatResponses[
            Math.floor(Math.random() * repeatResponses.length)
          ];

        await speakText(repeatResponse, () => {
          speakQuestion(currentQuestion);
        });
        return;
      }

      // 2. Clarification request patterns
      const clarificationPatterns = [
        /can you clarify/i,
        /what do you mean/i,
        /i don't understand/i,
        /not clear/i,
        /confused/i,
        /explain/i,
        /clarify/i,
      ];

      const isClarificationRequest = clarificationPatterns.some(
        (pattern) => pattern.test(transcriptLower),
      );

      if (isClarificationRequest) {
        console.log(
          "User requested clarification:",
          transcript,
        );

        // Provide clarification and rephrase the question
        const clarificationResponse = `Let me rephrase that question in a different way: ${currentQuestion} In other words, I'd like you to share your thoughts on this topic in your own words.`;

        await speakText(clarificationResponse, () => {
          startRecording();
        });
        return;
      }

      // Continue with interview process...
      const interviewResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-28776b5d/interview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            topics: sessionData.topics,
            companyContext: sessionData.companyContext,
            questionNumber: questionCount,
            currentQuestion,
            userAnswer: transcript,
          }),
        },
      );

      if (!interviewResponse.ok) {
        throw new Error("Interview processing failed");
      }

      const interviewData = await interviewResponse.json();

      // Save results and continue
      if (questionCount < 5) {
        setCurrentQuestion(interviewData.next_question);
        setQuestionCount((prev) => prev + 1);
        await speakText(interviewData.feedback.overall, () => {
          speakQuestion(interviewData.next_question);
        });
      } else {
        await speakText(interviewData.feedback.overall, () => {
          stopSession();
        });
      }
    } catch (error) {
      console.error("Error processing answer:", error);
      setTimeout(() => {
        stopSession();
      }, 2000);
    }
  };

  const getStatusMessage = () => {
    if (permissionError) {
      return "Microphone access issue - Please fix permissions to continue";
    }

    if (
      microphonePermission === "prompt" &&
      !permissionRequested
    ) {
      return "Allow microphone access to begin your interview practice";
    }

    if (microphonePermission === "denied") {
      return "Please allow microphone access to continue with your practice";
    }

    if (
      microphonePermission === "granted" &&
      !sessionInitialized
    ) {
      return "Initializing session...";
    }

    switch (sessionState) {
      case "initializing":
        return "Preparing your session with Uncle Tor...";
      case "introduction":
        return "Uncle Tor is introducing himself...";
      case "recording":
        return speechStarted
          ? "I hear you speaking... I'll continue when you finish (2 sec pause)"
          : "Start speaking your answer now...";
      case "processing":
        return "Analyzing your response...";
      case "speaking":
        return "Uncle Tor is providing detailed feedback with tips...";
      case "paused":
        return "Session paused";
      case "complete":
        return "Session completed!";
      default:
        return "Get ready to start practicing!";
    }
  };

  const getTioAvatarState = ():
    | "idle"
    | "listening"
    | "speaking"
    | "thinking" => {
    switch (sessionState) {
      case "introduction":
      case "speaking":
        return "speaking";
      case "recording":
        return "listening";
      case "processing":
      case "initializing":
        return "thinking";
      default:
        return "idle";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-12">
        <div className="space-y-12">
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <h2 className="text-foreground">Uncle Tor</h2>
              <TioAvatar
                state={getTioAvatarState()}
                size="lg"
              />
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {getStatusMessage()}
              </p>
            </div>
          </div>

          {/* Permission Request */}
          {microphonePermission === "prompt" &&
            !permissionRequested && (
              <div className="text-center">
                <Button
                  onClick={requestMicrophonePermission}
                  className="w-full"
                  size="lg"
                >
                  Allow Microphone Access
                </Button>
              </div>
            )}

          {/* Permission Error */}
          {(permissionError ||
            microphonePermission === "denied") && (
            <div className="text-center space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive max-w-sm mx-auto leading-relaxed">
                    {permissionError ||
                      "Microphone access was denied"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col space-y-3">
                <Button
                  onClick={() => {
                    setPermissionError("");
                    setPermissionRequested(false);
                    setMicrophonePermission("prompt");
                    setTimeout(() => {
                      requestMicrophonePermission();
                    }, 100);
                  }}
                  className="w-full"
                  size="lg"
                >
                  Try Microphone Again
                </Button>
              </div>
            </div>
          )}

          {/* Recording State */}
          {sessionState === "recording" && (
            <div className="flex flex-col items-center space-y-6">
              <div className="flex justify-center">
                <Button
                  onClick={stopSession}
                  variant="outline"
                  size="sm"
                  className="text-xs opacity-50 hover:opacity-100"
                >
                  <Square className="h-3 w-3 mr-1" />
                  End Session
                </Button>
              </div>
            </div>
          )}

          {sessionState === "complete" && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Session completed successfully!
              </p>
              <Button
                onClick={onViewProgress}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          )}

          {/* Progress indicator */}
          {questionCount > 0 && sessionState !== "complete" && (
            <div className="text-center space-y-2">
              <div className="flex justify-center space-x-1">
                {Array.from({
                  length: Math.min(questionCount, 5),
                }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < questionCount - 1
                        ? "bg-foreground"
                        : i === questionCount - 1
                          ? "bg-foreground animate-pulse"
                          : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Question {questionCount} of 5
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}