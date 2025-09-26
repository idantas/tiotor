import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { User, Mail, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { TioAvatar } from './TioAvatar';

interface LoginScreenProps {
  onLogin: (email: string, name?: string, accessToken?: string) => void;
  onBack: () => void;
}

export function LoginScreen({ onLogin, onBack }: LoginScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [isAutoSwitching, setIsAutoSwitching] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const { projectId, publicAnonKey } = await import('../utils/supabase/info');
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-28776b5d/signin`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          email: loginForm.email,
          password: loginForm.password
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle specific login errors
        if (data.error && data.error.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (data.error && data.error.includes('Email not confirmed')) {
          throw new Error('Please check your email and confirm your account before signing in.');
        }
        throw new Error(data.error || 'Login failed. Please try again.');
      }
      
      if (data.success && data.session) {
        onLogin(
          data.user.email, 
          data.user.user_metadata?.name || data.user.email.split('@')[0],
          data.session.access_token
        );
      } else {
        throw new Error('Invalid server response');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    if (registerForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }
    
    try {
      const { projectId, publicAnonKey } = await import('../utils/supabase/info');
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-28776b5d/signup`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          email: registerForm.email,
          password: registerForm.password,
          name: registerForm.name
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle specific error for existing user
        if (data.error && data.error.includes('already been registered')) {
          setError('This email is already registered. Switching to sign in...');
          setIsAutoSwitching(true);
          // Auto-switch to login tab after a brief delay
          setTimeout(() => {
            const loginTab = document.querySelector('[value="login"]') as HTMLElement;
            loginTab?.click();
            // Pre-fill the email in login form
            setLoginForm(prev => ({ ...prev, email: registerForm.email }));
            setIsAutoSwitching(false);
          }, 2000);
          return;
        }
        throw new Error(data.error || 'Account creation failed');
      }
      
      if (data.success && data.user) {
        // After successful registration, automatically sign in
        const signinResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-28776b5d/signin`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            email: registerForm.email,
            password: registerForm.password
          })
        });
        
        const signinData = await signinResponse.json();
        
        if (signinResponse.ok && signinData.success) {
          onLogin(
            signinData.user.email, 
            signinData.user.user_metadata?.name || registerForm.name,
            signinData.session.access_token
          );
        } else {
          // Registration successful but auto-login failed
          setError('Account created successfully! Switching to sign in...');
          setIsAutoSwitching(true);
          // Switch to login tab
          setTimeout(() => {
            const loginTab = document.querySelector('[value="login"]') as HTMLElement;
            loginTab?.click();
            setLoginForm(prev => ({ ...prev, email: registerForm.email }));
            setIsAutoSwitching(false);
          }, 1500);
        }
      } else {
        throw new Error('Invalid server response');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'Account creation failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted/30">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="absolute top-6 left-6"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="mx-auto flex items-center justify-center mb-6">
            <TioAvatar state="idle" size="lg" />
          </div>
          
          <div>
            <h1 className="text-2xl text-foreground mb-2">Welcome back</h1>
            <p className="text-muted-foreground">Continue your journey with Tio Tor</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert 
            variant={isAutoSwitching ? "default" : "destructive"} 
            className={isAutoSwitching 
              ? "border-blue-200 bg-blue-50 dark:bg-blue-950/50" 
              : "border-red-200 bg-red-50 dark:bg-red-950/50"
            }
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm flex items-center gap-2">
              {error}
              {isAutoSwitching && (
                <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Auth Card */}
        <Card className="border border-border rounded-md">
          <CardContent className="p-6">
            <Tabs defaultValue="login" className="space-y-6" onValueChange={() => setError('')}>
              <TabsList className="grid w-full grid-cols-2 h-11">
                <TabsTrigger value="login" className="text-sm">Sign In</TabsTrigger>
                <TabsTrigger value="register" className="text-sm">Create Account</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10 h-11"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full h-11 mt-6" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name" className="text-sm">Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-name"
                        type="text"
                        placeholder="Your name"
                        className="pl-10 h-11"
                        value={registerForm.name}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, name: e.target.value }))}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10 h-11"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-sm">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                        required
                        disabled={isLoading}
                        minLength={6}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Minimum 6 characters</p>
                  </div>
                  
                  <Button type="submit" className="w-full h-11 mt-6" disabled={isLoading || isAutoSwitching}>
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                  
                  {error && error.includes('already registered') && !isAutoSwitching && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full h-11 mt-2" 
                      onClick={() => {
                        const loginTab = document.querySelector('[value="login"]') as HTMLElement;
                        loginTab?.click();
                        setLoginForm(prev => ({ ...prev, email: registerForm.email }));
                        setError('');
                      }}
                    >
                      Switch to Sign In
                    </Button>
                  )}
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Secure authentication powered by Supabase
          </p>
        </div>
      </div>
    </div>
  );
}