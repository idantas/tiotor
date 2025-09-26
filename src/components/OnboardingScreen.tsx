import React, { useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { X, Plus } from "lucide-react";
import { TioAvatar } from "./TioAvatar";
import type { SessionData } from "../App";

interface OnboardingScreenProps {
  onStartSession: (data: SessionData) => void;
}

export function OnboardingScreen({
  onStartSession,
}: OnboardingScreenProps) {
  // Initialize with default interview topics
  const [topics, setTopics] = useState<string[]>([
    "Falar sobre mim",
    "Por que me candidatei a esta vaga",
    "Falar de um desafio que enfrentei",
  ]);
  const [newTopic, setNewTopic] = useState("");
  const [companyContext, setCompanyContext] = useState("");

  const handleAddTopic = () => {
    if (newTopic.trim() && !topics.includes(newTopic.trim())) {
      setTopics([...topics, newTopic.trim()]);
      setNewTopic("");
    }
  };

  const handleDeleteTopic = (topicToDelete: string) => {
    setTopics(
      topics.filter((topic) => topic !== topicToDelete),
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTopic();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topics.length > 0 && companyContext.trim()) {
      onStartSession({
        topics: topics,
        companyContext: companyContext.trim(),
      });
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center">
            <TioAvatar state="idle" size="lg" />
          </div>

          <div>
            <h1 className="text-2xl text-foreground">
              Tio Tor
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Mock Interview Coach
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label
              htmlFor="topics"
              className="text-sm text-foreground"
            >
              Tópicos da entrevista
            </Label>

            {/* Topics Chips */}
            <div className="p-3 border border-border rounded-md bg-background space-y-3">
              <div className="flex flex-wrap gap-2">
                {topics.map((topic, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="px-3 py-1 pr-1 text-sm bg-muted text-foreground border-border flex items-center gap-2"
                  >
                    <span>{topic}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                      onClick={() => handleDeleteTopic(topic)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>

              {/* Add new topic input */}
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Adicionar tópico..."
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 text-sm bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddTopic}
                  disabled={
                    !newTopic.trim() ||
                    topics.includes(newTopic.trim())
                  }
                  className="h-10 w-10 border-border"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="company"
              className="text-sm text-foreground"
            >
              Descrição da vaga
            </Label>
            <Textarea
              id="company"
              placeholder="Cole aqui a descrição completa da vaga: empresa, responsabilidades, requisitos, benefícios..."
              value={companyContext}
              onChange={(e) =>
                setCompanyContext(e.target.value)
              }
              rows={3}
              className="resize-none bg-background border-border text-foreground placeholder:text-muted-foreground h-[200px] overflow-y-auto"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            disabled={
              topics.length === 0 || !companyContext.trim()
            }
          >
            Iniciar Simulação
          </Button>
        </form>
      </div>
    </div>
  );
}