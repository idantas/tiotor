// Helper para valores seguros em <line>
function safeLineVal(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar } from 'recharts';
import { Trophy, TrendingUp, MessageSquare, BarChart3, User } from 'lucide-react';
import type { SessionResults, FeedbackData } from './SessionScreenAdvanced';

interface ProgressScreenProps {
  onNewSession: () => void;
  onBackToDashboard?: () => void;
  sessionResults?: SessionResults;
  userEmail?: string;
  userAccessToken?: string;
}

interface ProgressData {
  sessionsCompleted: number;
  lastScore: number;
  averageScore: number;
  scoreHistory: { session: number; score: number; date: string }[];
  skillsProgress: {
    clarity: number;
    confidence: number;
    storytelling: number;
  };
  feedbackHistory: FeedbackData[];
}

export function ProgressScreen({ onNewSession, onBackToDashboard, sessionResults, userEmail, userAccessToken }: ProgressScreenProps) {
  const [progressData, setProgressData] = useState<ProgressData>({
    sessionsCompleted: 0,
    lastScore: 0,
    averageScore: 0,
    scoreHistory: [],
    skillsProgress: {
      clarity: 0,
      confidence: 0,
      storytelling: 0
    },
    feedbackHistory: []
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgressData();
  }, [sessionResults]);

  const fetchProgressData = async () => {
    try {
      const { projectId, publicAnonKey } = await import('../utils/supabase/info');
      const authToken = userAccessToken || publicAnonKey;
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-28776b5d/progress`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // If we have current session results, add them to the data
        if (sessionResults) {
          data.sessionsCompleted += 1;
          data.lastScore = sessionResults.score;
          data.scoreHistory.push({
            session: data.sessionsCompleted,
            score: sessionResults.score,
            date: new Date().toISOString().split('T')[0]
          });
          data.feedbackHistory = [...(data.feedbackHistory || []), ...sessionResults.feedbacks];
          
          // Calculate average score
          const allScores = data.scoreHistory.map((h: any) => h.score);
          data.averageScore = Math.round(allScores.reduce((sum: number, score: number) => sum + score, 0) / allScores.length);
          
          // Calculate skills progress from latest feedbacks
          if (sessionResults.feedbacks.length > 0) {
            const latestFeedbacks = sessionResults.feedbacks;
            const avgScore = sessionResults.score;
            data.skillsProgress = {
              fluency: Math.min(100, avgScore + Math.random() * 10 - 5),
              clarity: Math.min(100, avgScore + Math.random() * 10 - 5),
              grammar: Math.min(100, avgScore + Math.random() * 10 - 5),
              vocabulary: Math.min(100, avgScore + Math.random() * 10 - 5)
            };
          }
        }
        
        setProgressData(data);
      } else {
        // Mock data with current session if available
        const mockData: ProgressData = {
          sessionsCompleted: sessionResults ? 3 : 2,
          lastScore: sessionResults?.score || 85,
          averageScore: sessionResults ? Math.round((85 + 78 + sessionResults.score) / 3) : 82,
          scoreHistory: sessionResults ? [
            { session: 1, score: 85, date: '2024-01-15' },
            { session: 2, score: 78, date: '2024-01-16' },
            { session: 3, score: sessionResults.score, date: new Date().toISOString().split('T')[0] }
          ] : [
            { session: 1, score: 85, date: '2024-01-15' },
            { session: 2, score: 78, date: '2024-01-16' }
          ],
          skillsProgress: {
            clarity: sessionResults?.score ? Math.min(100, sessionResults.score - 3) : 79,
            confidence: sessionResults?.score ? Math.min(100, sessionResults.score + 5) : 82,
            storytelling: sessionResults?.score ? Math.min(100, sessionResults.score + 2) : 85
          },
          feedbackHistory: sessionResults?.feedbacks || []
        };
        setProgressData(mockData);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
      // Fallback with session results
      const fallbackData: ProgressData = {
        sessionsCompleted: sessionResults ? 1 : 0,
        lastScore: sessionResults?.score || 0,
        averageScore: sessionResults?.score || 0,
        scoreHistory: sessionResults ? [
          { session: 1, score: sessionResults.score, date: new Date().toISOString().split('T')[0] }
        ] : [],
        skillsProgress: {
          clarity: sessionResults?.score ? Math.min(100, sessionResults.score - 3) : 0,
          confidence: sessionResults?.score ? Math.min(100, sessionResults.score + 5) : 0,
          storytelling: sessionResults?.score ? Math.min(100, sessionResults.score + 2) : 0
        },
        feedbackHistory: sessionResults?.feedbacks || []
      };
      setProgressData(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 85) return 'default';
    if (score >= 70) return 'secondary';
    return 'destructive';
  };

  const radarData = [
    { skill: 'Clareza', value: progressData.skillsProgress.clarity },
    { skill: 'Confiança', value: progressData.skillsProgress.confidence },
    { skill: 'Storytelling', value: progressData.skillsProgress.storytelling }
  ];

  const skillsBarData = [
    { name: 'Clareza', score: progressData.skillsProgress.clarity },
    { name: 'Confiança', score: progressData.skillsProgress.confidence },
    { name: 'Storytelling', score: progressData.skillsProgress.storytelling }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <div>
              <h1 className="text-foreground">Seu Progresso</h1>
              <p className="text-muted-foreground text-sm">
                {userEmail && `Bem-vindo, ${userEmail.split('@')[0]}!`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onBackToDashboard && (
              <Button variant="outline" onClick={onBackToDashboard}>
                Voltar ao Dashboard
              </Button>
            )}
            <Button onClick={onNewSession}>
              Nova Sessão
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Sessões</p>
                  <p className="text-2xl font-semibold">{progressData.sessionsCompleted}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Última Pontuação</p>
                  <p className={`text-2xl font-semibold ${getScoreColor(progressData.lastScore)}`}>
                    {progressData.lastScore}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Média Geral</p>
                  <p className={`text-2xl font-semibold ${getScoreColor(progressData.averageScore)}`}>
                    {progressData.averageScore}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Feedbacks</p>
                  <p className="text-2xl font-semibold">{progressData.feedbackHistory.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analysis */}
        <Tabs defaultValue="progress" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="progress">Evolução</TabsTrigger>
            <TabsTrigger value="skills">Habilidades</TabsTrigger>
            <TabsTrigger value="feedbacks">Feedbacks</TabsTrigger>
          </TabsList>
          
          <TabsContent value="progress" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Evolução das Pontuações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {progressData.scoreHistory && progressData.scoreHistory.length >= 2 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={progressData.scoreHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="session" 
                          tickFormatter={(value) => Number.isFinite(+value) ? `Sessão ${value}` : ''}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis 
                          domain={[0, 100]}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={3}
                          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 6 }}
                          activeDot={{ r: 8, fill: 'hsl(var(--primary))' }}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                        <p>Complete mais sessões para ver seu progresso</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="skills" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Análise de Habilidades</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    {radarData && radarData.length > 0 && radarData.every(item => Number.isFinite(item.value)) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis 
                            dataKey="skill" 
                            tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                          />
                          <PolarRadiusAxis 
                            angle={90} 
                            domain={[0, 100]} 
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <Radar
                            name="Pontuação"
                            dataKey="value"
                            stroke="hsl(var(--primary))"
                            fill="hsl(var(--primary))"
                            fillOpacity={0.3}
                            strokeWidth={2}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-muted-foreground">
                          <User className="h-12 w-12 mx-auto mb-4" />
                          <p>Análise de habilidades indisponível</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Pontuação por Habilidade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    {skillsBarData && skillsBarData.length > 0 && skillsBarData.every(item => Number.isFinite(item.score)) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={skillsBarData} layout="horizontal">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            type="number" 
                            domain={[0, 100]}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <YAxis 
                            type="category" 
                            dataKey="name"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            width={80}
                          />
                          <Bar 
                            dataKey="score" 
                            fill="hsl(var(--primary))"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-muted-foreground">
                          <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                          <p>Dados de habilidades indisponíveis</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="feedbacks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Feedbacks do Tio Tor</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-6">
                    {progressData.feedbackHistory.length > 0 ? (
                      progressData.feedbackHistory.map((feedback, index) => (
                        <div key={index} className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Badge variant={getScoreBadgeVariant(feedback.score)}>
                                {feedback.score}/100
                              </Badge>
                              <h4 className="font-medium">Pergunta {feedback.questionNumber}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(feedback.timestamp).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="bg-accent p-3 rounded-lg">
                              <p className="text-sm font-medium text-muted-foreground mb-1">Pergunta:</p>
                              <p className="text-sm">{feedback.question}</p>
                            </div>
                            
                            <div className="bg-muted p-3 rounded-lg">
                              <p className="text-sm font-medium text-muted-foreground mb-1">Sua resposta:</p>
                              <p className="text-sm italic">"{feedback.userAnswer}"</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Clareza</p>
                                <p className="text-sm">{feedback.feedback.clarity}</p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Confiança</p>
                                <p className="text-sm">{feedback.feedback.confidence}</p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Storytelling/Técnico</p>
                                <p className="text-sm">{feedback.feedback.storytelling}</p>
                              </div>
                            </div>
                          </div>
                          
                          {index < progressData.feedbackHistory.length - 1 && <Separator />}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Nenhum feedback disponível ainda</p>
                        <p className="text-sm text-muted-foreground">Complete uma sessão para ver os feedbacks detalhados do Tio Tor</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Button */}
        <div className="pt-4">
          <Button 
            onClick={onNewSession}
            className="w-full md:w-auto"
            size="lg"
          >
            Iniciar Nova Sessão
          </Button>
        </div>
      </div>
    </div>
  );
}