import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Plus, BarChart3, Play, Calendar, Target, ArrowRight, CheckCircle, Clock, Download } from 'lucide-react';
import { TioAvatar } from './TioAvatar';

interface Session {
  id: string;
  topics: string[];
  companyContext: string;
  score?: number;
  timestamp: string;
  status: 'completed' | 'active' | 'in-progress';
  feedbacks?: Array<{
    fluency: string;
    clarity: string;
    grammar: string;
    vocabulary: string;
  }>;
}

interface DashboardScreenProps {
  userEmail?: string;
  userAccessToken?: string;
  onStartNewSession: () => void;
  onViewProgress: (sessionId?: string) => void;
  onLogoExporter?: () => void;
}

interface UserStats {
  totalSessions: number;
  averageScore: number;
  lastSessionDate?: string;
}

export function DashboardScreen({ 
  userEmail, 
  userAccessToken, 
  onStartNewSession,
  onViewProgress,
  onLogoExporter
}: DashboardScreenProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchSessions();
  }, [userAccessToken]);

  const fetchSessions = async () => {
    if (!userAccessToken) return;

    setIsLoading(true);
    setError('');

    try {
      const { projectId } = await import('../utils/supabase/info');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-28776b5d/sessions`,
        {
          headers: {
            'Authorization': `Bearer ${userAccessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const transformedSessions: Session[] = data.sessions.map((session: any) => ({
          id: session.id,
          topics: session.topics || [],
          companyContext: session.companyContext || '',
          score: session.score,
          timestamp: session.timestamp,
          status: (session.score !== undefined && session.score > 0) ? 'completed' : 'active',
          feedbacks: session.feedbacks || []
        }));
        setSessions(transformedSessions);

        // Calculate user stats
        if (transformedSessions.length > 0) {
          const sessionsWithScores = transformedSessions.filter(s => s.score !== undefined);
          const avgScore = sessionsWithScores.length > 0 
            ? Math.round(sessionsWithScores.reduce((sum, s) => sum + (s.score || 0), 0) / sessionsWithScores.length)
            : 0;
          
          setUserStats({
            totalSessions: transformedSessions.length,
            averageScore: avgScore,
            lastSessionDate: transformedSessions[0]?.timestamp
          });
        }
      } else {
        throw new Error('Failed to fetch sessions');
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setError('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  const getSessionObjective = (session: Session) => {
    if (session.companyContext) {
      return `${session.companyContext} Interview Practice`;
    }
    return session.topics.length > 0 
      ? `${session.topics.slice(0, 2).join(' & ')} Practice`
      : 'General Interview Practice';
  };

  const getStatusBadge = (status: Session['status']) => {
    switch (status) {
      case 'completed':
        return {
          color: 'bg-green-500',
          icon: CheckCircle,
          text: 'Completed',
          textColor: 'text-green-700'
        };
      case 'active':
      case 'in-progress':
        return {
          color: 'bg-blue-500',
          icon: Clock,
          text: 'Active',
          textColor: 'text-blue-700'
        };
      default:
        return {
          color: 'bg-gray-500',
          icon: Clock,
          text: 'Unknown',
          textColor: 'text-gray-700'
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <TioAvatar state="listening" size="lg" />
          <p className="text-muted-foreground">Loading your sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <TioAvatar state="idle" size="lg" />
          <div>
            <h1 className="text-3xl text-foreground mb-2">
              Welcome back{userEmail ? `, ${userEmail.split('@')[0]}` : ''}!
            </h1>
            <p className="text-muted-foreground">
              Continue practicing or start a new interview session
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Quick Stats */}
        {userStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border border-border rounded-md">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{userStats.totalSessions}</div>
                <p className="text-sm text-muted-foreground">Sessions Completed</p>
              </CardContent>
            </Card>
            <Card className="border border-border rounded-md">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{userStats.averageScore}%</div>
                <p className="text-sm text-muted-foreground">Average Score</p>
              </CardContent>
            </Card>
            <Card className="border border-border rounded-md">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">
                  {userStats.lastSessionDate ? formatDate(userStats.lastSessionDate) : 'Never'}
                </div>
                <p className="text-sm text-muted-foreground">Last Practice</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* New Session CTA */}
        <Card className="border border-border rounded-md hover:border-primary/40 transition-all duration-200 hover:shadow-lg cursor-pointer" onClick={onStartNewSession}>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Plus className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="text-xl mb-2">Start New Interview Session</h2>
            <p className="text-muted-foreground mb-6">
              Practice your skills with personalized interview questions
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <Button size="lg" onClick={(e) => { e.stopPropagation(); onStartNewSession(); }} className="w-full max-w-xs">
                <Play className="h-4 w-4 mr-2" />
                Begin Practice
              </Button>
              {onLogoExporter && (
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={(e) => { e.stopPropagation(); onLogoExporter(); }} 
                  className="w-full max-w-xs"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Logo
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sessions List */}
        <div className="space-y-6">
          <h2 className="text-xl">Your Practice Sessions</h2>
          
          {sessions.length === 0 ? (
            <Card className="border border-border rounded-md">
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg mb-2">No sessions yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start your first interview practice session
                </p>
                <Button onClick={onStartNewSession}>
                  <Plus className="h-4 w-4 mr-2" />
                  Start First Session
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sessions.map((session, index) => {
                const statusBadge = getStatusBadge(session.status);
                const StatusIcon = statusBadge.icon;
                
                return (
                  <Card key={session.id} className="border border-border rounded-md hover:shadow-lg transition-all duration-200 hover:border-primary/30 relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative flex items-center gap-2">
                            {/* Status Badge Circle */}
                            <div className={`w-3 h-3 ${statusBadge.color} rounded-full flex items-center justify-center`}>
                              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            </div>
                            <CardTitle className="text-lg">
                              {getSessionObjective(session)}
                            </CardTitle>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Status Badge Text */}
                          <div className="flex items-center gap-1">
                            <StatusIcon className={`h-3 w-3 ${statusBadge.textColor}`} />
                            <span className={`text-xs ${statusBadge.textColor} font-medium`}>
                              {statusBadge.text}
                            </span>
                          </div>
                          {session.score && (
                            <Badge variant={getScoreBadgeVariant(session.score)} className="px-3 py-1">
                              {session.score}%
                            </Badge>
                          )}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(session.timestamp)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Topics:</span> {session.topics.join(', ') || 'General Interview'}
                          </p>
                          {session.companyContext && (
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">Context:</span> {session.companyContext}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onViewProgress(session.id)}
                            className="hover:bg-secondary"
                          >
                            <BarChart3 className="h-4 w-4 mr-2" />
                            View Progress
                          </Button>
                          <Button 
                            size="sm"
                            onClick={onStartNewSession}
                            className="bg-primary hover:bg-primary/90"
                          >
                            {session.status === 'completed' ? 'Practice Again' : 'Resume Practice'}
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}