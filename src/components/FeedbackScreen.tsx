import React, { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { 
  Check, 
  ArrowRight, 
  Target, 
  Shield, 
  BookOpen,
  Settings
} from "lucide-react";
import { TioAvatar } from "./TioAvatar";

interface FeedbackData {
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
}

interface FeedbackScreenProps {
  feedbackData: FeedbackData;
  isFirstFeedback: boolean;
  onContinue: () => void;
  onSkipFeedbacks: () => void;
}

export function FeedbackScreen({
  feedbackData,
  isFirstFeedback,
  onContinue,
  onSkipFeedbacks,
}: FeedbackScreenProps) {
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false);

  const handleSkipFeedbacks = () => {
    if (!showSkipConfirmation) {
      setShowSkipConfirmation(true);
      return;
    }
    onSkipFeedbacks();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excelente";
    if (score >= 60) return "Bom";
    return "Pode melhorar";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        {/* Avatar */}
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center">
            <TioAvatar size="lg" state="thinking" />
          </div>
          <h1>Tio Tor</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Feedback da Pergunta {feedbackData.questionNumber}
          </p>
        </div>

        {/* Question Context */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-start space-x-2 mb-3">
            <div className="h-2 w-2 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {feedbackData.question}
            </p>
          </div>
        </div>

        {/* Score Badge */}
        <div className="text-center">
          <Badge 
            variant="secondary" 
            className={`px-4 py-2 text-base ${getScoreColor(feedbackData.score)}`}
          >
            {feedbackData.score}/100 - {getScoreLabel(feedbackData.score)}
          </Badge>
        </div>

        {/* Feedback Analysis */}
        <div className="space-y-4">
          {/* Clarity */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium">Clareza</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              {feedbackData.feedback.clarity}
            </p>
          </div>

          {/* Confidence */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium">Confiança</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              {feedbackData.feedback.confidence}
            </p>
          </div>

          {/* Storytelling/Technical */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium">Storytelling/Técnico</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              {feedbackData.feedback.storytelling}
            </p>
          </div>
        </div>

        {/* Overall Feedback */}
        {feedbackData.feedback.overall && (
          <div className="bg-accent p-4 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Observação Geral</h4>
            <p className="text-sm text-muted-foreground">
              {feedbackData.feedback.overall}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-4">
          {isFirstFeedback ? (
            <>
              {/* Skip Feedback Confirmation */}
              {showSkipConfirmation && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Settings className="h-4 w-4 text-amber-600" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Ok, a partir de agora mostraremos os feedbacks somente no final da simulação. 
                      Você pode mudar isso depois em Configurações.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSkipConfirmation(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSkipFeedbacks}
                      className="flex-1"
                    >
                      Confirmar
                    </Button>
                  </div>
                </div>
              )}

              {/* First Feedback Options */}
              {!showSkipConfirmation && (
                <div className="space-y-3">
                  <Button
                    onClick={onContinue}
                    variant="default"
                    size="lg"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Ir para a próxima pergunta
                  </Button>
                  
                  <Button
                    onClick={handleSkipFeedbacks}
                    variant="outline"
                    size="lg"
                    className="w-full"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Pular feedbacks
                  </Button>
                </div>
              )}
            </>
          ) : (
            /* Continue Button for Non-First Feedbacks */
            <Button
              onClick={onContinue}
              variant="default"
              size="lg"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Continuar para próxima pergunta
            </Button>
          )}
        </div>

        {/* Encouragement Message */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            {feedbackData.score >= 80 
              ? "Você está indo muito bem! Continue assim." 
              : feedbackData.score >= 60 
                ? "Bom trabalho! Alguns ajustes e você estará perfeito."
                : "Não desanime! Cada prática te deixa mais preparado para a entrevista real."}
          </p>
        </div>
      </div>
    </div>
  );
}