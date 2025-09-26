import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Trophy, User, RotateCcw, CheckCircle } from 'lucide-react';
import { TioAvatar } from './TioAvatar';
import type { SessionResults } from './SessionScreenAdvanced';

interface PostSessionScreenProps {
  onLogin: () => void;
  onNewSession: () => void;
  sessionResults?: SessionResults;
}

export function PostSessionScreen({ onLogin, onNewSession, sessionResults }: PostSessionScreenProps) {
  // Calculate competency scores based on feedback data
  const calculateCompetencyScores = () => {
    if (!sessionResults?.feedbacks || sessionResults.feedbacks.length === 0) {
      return {
        communication: 7,
        technical: 6,
        leadership: 7,
        marketFit: 8
      };
    }

    const avgScore = sessionResults.score || 75;
    return {
      communication: Math.min(10, Math.max(1, Math.round((avgScore + 5) / 10))),
      technical: Math.min(10, Math.max(1, Math.round((avgScore - 5) / 10))),
      leadership: Math.min(10, Math.max(1, Math.round(avgScore / 10))),
      marketFit: Math.min(10, Math.max(1, Math.round((avgScore + 10) / 10)))
    };
  };

  // Generate action plan based on performance
  const generateActionPlan = () => {
    const score = sessionResults?.score || 75;
    
    if (score >= 80) {
      return [
        "Continue praticando com perguntas mais desafiadoras",
        "Trabalhe em situações de alta pressão",
        "Desenvolva exemplos específicos do seu setor"
      ];
    } else if (score >= 60) {
      return [
        "Estruture suas respostas usando a metodologia STAR",
        "Pratique histórias específicas de conquistas",
        "Melhore a confiança através de treino regular",
        "Prepare exemplos quantitativos de resultados"
      ];
    } else {
      return [
        "Foque em clareza e objetividade nas respostas",
        "Pratique falar com mais confiança e assertividade",
        "Prepare 3-5 histórias profissionais estruturadas",
        "Estude sobre a empresa e setor antes da entrevista",
        "Pratique diariamente por 15-20 minutos"
      ];
    }
  };

  const competencyScores = calculateCompetencyScores();
  const actionPlan = generateActionPlan();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div>
            <h1>Resumo da Sessão</h1>
            <p className="text-muted-foreground">
              Sua simulação de entrevista foi concluída com sucesso
            </p>
          </div>
        </div>

        {/* Session Overview */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-2xl font-medium">{sessionResults?.questions?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Perguntas respondidas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-medium text-primary">{sessionResults?.score || 75}/100</p>
                <p className="text-xs text-muted-foreground">Pontuação geral</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-medium">
                  {sessionResults?.feedbacks?.length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Feedbacks recebidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Competency Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Avaliação por Competência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm">Comunicação</span>
                <Badge variant="secondary" className="font-medium">
                  {competencyScores.communication}/10
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm">Técnica</span>
                <Badge variant="secondary" className="font-medium">
                  {competencyScores.technical}/10
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm">Liderança</span>
                <Badge variant="secondary" className="font-medium">
                  {competencyScores.leadership}/10
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm">Fit de Mercado</span>
                <Badge variant="secondary" className="font-medium">
                  {competencyScores.marketFit}/10
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consolidated Feedback */}
        {sessionResults?.feedbacks && sessionResults.feedbacks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Feedbacks Consolidados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessionResults.feedbacks.map((feedback, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Pergunta {feedback.questionNumber}</span>
                    <Badge variant={feedback.score >= 80 ? "default" : feedback.score >= 60 ? "secondary" : "destructive"}>
                      {feedback.score}/100
                    </Badge>
                  </div>
                  
                  {/* Question Display */}
                  <div className="bg-muted/20 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Pergunta:</p>
                    <p className="text-sm">{feedback.question}</p>
                  </div>
                  
                  {/* Feedback Grid */}
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-start space-x-2">
                      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Clareza:</span>
                      <p className="text-sm">{feedback.feedback.clarity}</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Confiança:</span>
                      <p className="text-sm">{feedback.feedback.confidence}</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Storytelling:</span>
                      <p className="text-sm">{feedback.feedback.storytelling}</p>
                    </div>
                  </div>
                  
                  {index < sessionResults.feedbacks.length - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Final Summary from AI */}
        {sessionResults?.finalSummary && (
          <Card>
            <CardHeader>
              <CardTitle>Avaliação do Recrutador</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{ 
                  __html: sessionResults.finalSummary.replace(/\n/g, '<br/>') 
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Action Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Plano de Ação</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {actionPlan.map((action, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-primary font-medium">•</span>
                  <span className="text-sm">{action}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3">
          <Button 
            onClick={onLogin} 
            className="w-full"
            size="lg"
          >
            <User className="h-4 w-4 mr-2" />
            Criar Conta & Acompanhar Progresso
          </Button>
          
          <Button 
            onClick={onNewSession} 
            variant="outline" 
            className="w-full"
            size="lg"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Nova Simulação
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <TioAvatar state="idle" size="sm" />
            <span className="text-sm text-muted-foreground">Tio Tor</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Seu coach de entrevistas profissionais
          </p>
        </div>
      </div>
    </div>
  );
}