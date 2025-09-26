import React, { useState, useEffect } from 'react';
import { OnboardingScreen } from './components/OnboardingScreen';
import { SessionScreenAdvanced } from './components/SessionScreenAdvanced';
import { FeedbackScreen } from './components/FeedbackScreen';
import { ProgressScreen } from './components/ProgressScreen';
import { PostSessionScreen } from './components/PostSessionScreen';
import { LoginScreen } from './components/LoginScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { LogoExporter } from './components/LogoExporter';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginButton } from './components/LoginButton';
import { Footer } from './components/Footer';
import { TioAvatar } from './components/TioAvatar';
import { endSession } from './lib/session-engine';
import type { SessionResults } from './components/SessionScreenAdvanced';

export interface SessionData {
  topics: string[];
  companyContext: string;
  score?: number;
  timestamp?: string;
}

interface UserData {
  email: string;
  name?: string;
  accessToken?: string;
}

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
  timestamp: string;
}

type Screen = 'onboarding' | 'session' | 'feedback' | 'post-session' | 'login' | 'progress' | 'dashboard' | 'logo-exporter';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding');
  const [sessionData, setSessionData] = useState<SessionData>({
    topics: [],
    companyContext: ''
  });
  const [sessionResults, setSessionResults] = useState<SessionResults | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [isFirstSession, setIsFirstSession] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Feedback system state
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackData | null>(null);
  const [showImmediateFeedback, setShowImmediateFeedback] = useState(true);
  const [isFirstFeedback, setIsFirstFeedback] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    // Set dark mode as default theme immediately
    if (!document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.add('dark');
    }
    
    const checkExistingSession = async () => {
      try {
        // Shorter timeout to prevent hanging
        const globalTimeout = setTimeout(() => {
          console.log('Global initialization timeout, proceeding to onboarding');
          setCurrentScreen('onboarding');
          setIsInitializing(false);
        }, 1000); // Reduced to 1 second for faster initialization

        const savedUser = localStorage.getItem('tio-tor-user');
        if (!savedUser) {
          clearTimeout(globalTimeout);
          setCurrentScreen('onboarding');
          setIsInitializing(false);
          return;
        }

        let userData;
        try {
          userData = JSON.parse(savedUser);
        } catch (parseError) {
          console.warn('Invalid saved user data, clearing localStorage');
          localStorage.removeItem('tio-tor-user');
          clearTimeout(globalTimeout);
          setCurrentScreen('onboarding');
          setIsInitializing(false);
          return;
        }

        // If no access token, skip validation entirely
        if (!userData?.accessToken) {
          localStorage.removeItem('tio-tor-user');
          clearTimeout(globalTimeout);
          setCurrentScreen('onboarding');
          setIsInitializing(false);
          return;
        }

        // Skip server validation to avoid timeout issues
        // Just use the saved user data if it exists
        clearTimeout(globalTimeout);
        setUser(userData);
        setCurrentScreen('dashboard');
        setIsInitializing(false);

      } catch (error) {
        console.log('Error during initialization, proceeding to onboarding:', error);
        localStorage.removeItem('tio-tor-user');
        setCurrentScreen('onboarding');
        setIsInitializing(false);
      }
    };

    // Add global error handler for unhandled promise rejections and errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.warn('Unhandled promise rejection:', event.reason);
      // Prevent the default behavior to avoid console errors
      event.preventDefault();
    };

    const handleError = (event: ErrorEvent) => {
      console.warn('Global error caught:', event.error);
      // Don't prevent default for regular errors
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    checkExistingSession();

    // Cleanup event listeners
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  const handleStartSession = (data: SessionData) => {
    setSessionData(data);
    setCurrentScreen('session');
    // Reset feedback system for new session
    setShowImmediateFeedback(true);
    setIsFirstFeedback(true);
    setCurrentFeedback(null);
  };

  const handleQuestionAnswered = (feedbackData: FeedbackData) => {
    if (showImmediateFeedback) {
      setCurrentFeedback(feedbackData);
      setCurrentScreen('feedback');
    }
    // If not showing immediate feedback, the session continues automatically
  };

  const handleFeedbackContinue = () => {
    setIsFirstFeedback(false);
    setCurrentFeedback(null);
    setCurrentScreen('session');
  };

  const handleSkipFeedbacks = () => {
    setShowImmediateFeedback(false);
    setIsFirstFeedback(false);
    setCurrentFeedback(null);
    setCurrentScreen('session');
  };

  const handleSessionComplete = (results: SessionResults) => {
    setSessionResults(results);
    setSessionData(prev => ({ 
      ...prev, 
      score: results.score, 
      timestamp: new Date().toISOString() 
    }));
    
    // Hard end gate - stop all session audio/processing immediately
    try {
      endSession();
    } catch (error) {
      console.warn("Error ending session:", error);
    }
    
    // Only logged in users can see progress
    if (user) {
      setCurrentScreen('progress');
    } else {
      // Users without login always go to post-session screen
      setCurrentScreen('post-session');
    }
  };

  const handlePostSessionLogin = () => {
    setCurrentScreen('login');
  };

  const handlePostSessionNewSession = () => {
    setIsFirstSession(false);
    setCurrentScreen('onboarding');
    setSessionData({ topics: [], companyContext: '' });
  };

  const handleLogin = (email: string, name?: string, accessToken?: string) => {
    const userData = { email, name, accessToken };
    setUser(userData);
    
    // Save user session to localStorage
    localStorage.setItem('tio-tor-user', JSON.stringify(userData));
    
    // After successful login, redirect to dashboard
    setCurrentScreen('dashboard');
  };

  const handleLoginBack = () => {
    if (isFirstSession && !sessionResults) {
      // Coming from onboarding
      setCurrentScreen('onboarding');
    } else {
      // Coming from post-session
      setCurrentScreen('post-session');
    }
  };

  const handleOnboardingLogin = () => {
    setCurrentScreen('login');
  };

  const handleHeaderLogin = () => {
    setCurrentScreen('login');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('tio-tor-user');
    setCurrentScreen('onboarding');
  };

  const handleNewSession = () => {
    setCurrentScreen('onboarding');
    setSessionData({ topics: [], companyContext: '' });
  };

  const handleDashboardNewSession = () => {
    setCurrentScreen('onboarding');
    setSessionData({ topics: [], companyContext: '' });
  };

  const handleBackToDashboard = () => {
    if (user) {
      setCurrentScreen('dashboard');
    } else {
      setCurrentScreen('onboarding');
    }
  };

  const handleViewProgress = (sessionId?: string) => {
    setCurrentScreen('progress');
  };

  const handleLogoExporter = () => {
    setCurrentScreen('logo-exporter');
  };

  const handleBackFromLogoExporter = () => {
    if (user) {
      setCurrentScreen('dashboard');
    } else {
      setCurrentScreen('onboarding');
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <TioAvatar state="idle" size="lg" />
          <div className="space-y-2">
            <p className="text-muted-foreground">Carregando...</p>
            <div className="w-24 h-1 bg-muted rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '80%' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background relative flex flex-col">
        <LoginButton 
          user={user}
          onLogin={handleHeaderLogin}
          onLogout={handleLogout}
          onViewDashboard={user ? () => setCurrentScreen('dashboard') : undefined}
        />
        
        <div className="flex-1">
          {currentScreen === 'onboarding' && (
            <OnboardingScreen 
              onStartSession={handleStartSession}
            />
          )}
          
          {currentScreen === 'session' && (
            <SessionScreenAdvanced 
              sessionData={sessionData}
              onSessionComplete={handleSessionComplete}
              onQuestionAnswered={handleQuestionAnswered}
              onViewProgress={handleViewProgress}
              isFirstSession={isFirstSession}
              userAccessToken={user?.accessToken}
              showImmediateFeedback={showImmediateFeedback}
            />
          )}

          {currentScreen === 'feedback' && currentFeedback && (
            <FeedbackScreen 
              feedbackData={currentFeedback}
              isFirstFeedback={isFirstFeedback}
              onContinue={handleFeedbackContinue}
              onSkipFeedbacks={handleSkipFeedbacks}
            />
          )}
          
          {currentScreen === 'post-session' && (
            <PostSessionScreen 
              onLogin={handlePostSessionLogin}
              onNewSession={handlePostSessionNewSession}
              sessionResults={sessionResults || undefined}
            />
          )}
          
          {currentScreen === 'login' && (
            <LoginScreen 
              onLogin={handleLogin}
              onBack={handleLoginBack}
            />
          )}
          
          {currentScreen === 'progress' && (
            <ProgressScreen 
              onNewSession={handleNewSession}
              onBackToDashboard={user ? handleBackToDashboard : undefined}
              sessionResults={sessionResults || undefined}
              userEmail={user?.email}
              userAccessToken={user?.accessToken}
            />
          )}

          {currentScreen === 'dashboard' && (
            <DashboardScreen 
              userEmail={user?.email}
              userAccessToken={user?.accessToken}
              onStartNewSession={handleDashboardNewSession}
              onViewProgress={handleViewProgress}
              onLogoExporter={handleLogoExporter}
            />
          )}
          
          {currentScreen === 'logo-exporter' && (
            <LogoExporter 
              onBack={handleBackFromLogoExporter}
            />
          )}
        </div>
        
        <Footer onLogoExporter={handleLogoExporter} />
      </div>
    </ErrorBoundary>
  );
}