import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { User, LogOut, ChevronDown } from 'lucide-react';

interface LoginButtonProps {
  user: { email: string; name?: string; accessToken?: string } | null;
  onLogin: () => void;
  onLogout?: () => void;
  onViewDashboard?: () => void;
}

export function LoginButton({ user, onLogin, onLogout, onViewDashboard }: LoginButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (user) {
    return (
      <div className="absolute top-4 right-16" ref={menuRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="h-10 border-border text-sm px-3"
        >
          <User className="h-4 w-4 mr-2" />
          {user.email.split('@')[0]}
          <ChevronDown className="h-3 w-3 ml-2" />
        </Button>
        
        {isMenuOpen && (
          <Card className="absolute top-12 right-0 w-48 z-50 shadow-lg">
            <CardContent className="p-2">
              <div className="space-y-1">
                {onViewDashboard && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => {
                      onViewDashboard();
                      setIsMenuOpen(false);
                    }}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                )}

                {onLogout && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      onLogout();
                      setIsMenuOpen(false);
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onLogin}
      className="absolute top-4 right-16 h-10 border-border text-sm px-3"
    >
      <User className="h-4 w-4 mr-2" />
      Veja seu progresso
    </Button>
  );
}