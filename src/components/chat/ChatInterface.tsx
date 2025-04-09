"use client";

import React from 'react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mic, Send, BellRing, Globe } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  language?: {
    detectedLanguage: string;
    languageCode: string;
    isAfricanLanguage: boolean;
    confidence: number;
  };
}

interface ChatInterfaceProps {
  messages: Message[];
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleMicClick: () => void;
  onVoiceModeClick: () => void;
  isLoading: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isRateLimited: boolean;
  rateLimitCountdown: number;
  rateLimitReset: number | null;
  noSpeechDetected: boolean;
  getPlaceholder: () => string;
  onNewChat: () => void;
  scrollAreaRef: React.RefObject<HTMLDivElement> | React.MutableRefObject<HTMLDivElement>;
  patternStyle: React.CSSProperties;
}

export default function ChatInterface({
  messages,
  inputValue,
  setInputValue,
  handleSubmit,
  handleMicClick,
  onVoiceModeClick,
  isLoading,
  isSpeaking,
  isListening, 
  isRateLimited,
  rateLimitCountdown,
  rateLimitReset,
  noSpeechDetected,
  getPlaceholder,
  onNewChat,
  scrollAreaRef,
  patternStyle
}: ChatInterfaceProps) {
  return (
    <Card id="chat-interface" className="w-[90vw] max-w-2xl h-[80vh] flex flex-col relative shadow-lg border-[#E94822]/20 overflow-hidden">
      {/* African Pattern Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 opacity-10"
        style={patternStyle}
      />
      
      <div className="relative z-10">
        <div className="text-center py-3 border-b bg-gradient-to-r from-[#461111]/10 via-[#E94822]/10 to-[#F2A922]/10 relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#461111] via-[#E94822] to-[#F2A922]"></div>
          
          <h1 className="text-xl font-bold text-[#461111]">Africon</h1>
          <p className="text-xs text-[#0A7029]">Your African Voice Assistant</p>
        </div>
        
        {isListening && (
          <div className="absolute top-4 right-4 bg-[#E94822] text-white px-3 py-1 rounded-full text-xs animate-pulse flex items-center">
            <BellRing size={12} className="mr-1" />
            Listening...
          </div>
        )}
        
        {isSpeaking && !isListening && (
          <div className="absolute top-4 right-4 bg-[#0A7029] text-white px-3 py-1 rounded-full text-xs animate-pulse flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M12 8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2s2-.9 2-2v-4c0-1.1-.9-2-2-2z"/><path d="m8 10 2-2m4-4 2-2m-8 6-2-2m12 2 2-2"/></svg>
            Speaking...
          </div>
        )}
        
        {isRateLimited && !isListening && !isSpeaking && (
          <div className="absolute top-4 right-4 bg-[#F2A922] text-[#461111] px-3 py-1 rounded-full text-xs flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {rateLimitCountdown > 0 ? `Ready in ${rateLimitCountdown}s` : 'Rate limited'}
          </div>
        )}
      </div>
      
      <CardContent className="flex-grow p-6 overflow-hidden relative z-10">
        <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-32 my-8">
                <div className="text-center p-6 rounded-lg bg-gradient-to-br from-[#F7F3E3] to-[#F2A922]/20 shadow-sm">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F2A922]/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0A7029" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </div>
                  <h3 className="text-[#461111] font-semibold">Welcome to Africon!</h3>
                  <p className="text-sm text-[#461111]/80 mt-2">Your guide to African cultures, languages, and traditions</p>
                </div>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 ${
                  message.role === "user" ? "justify-end" : ""
                }`}
              >
                {message.role === "assistant" && (
                  <Avatar className="h-8 w-8 border border-[#0A7029]/20 bg-[#F7F3E3]">
                    <AvatarFallback className="bg-[#F2A922]/20 text-[#461111]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`rounded-lg px-4 py-2 max-w-[75%] ${
                    message.role === "user"
                      ? "bg-[#E94822] text-white"
                      : "bg-gradient-to-br from-[#F7F3E3] to-[#F2A922]/20 text-[#461111] border border-[#F2A922]/20"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.role === "assistant" && message.language?.detectedLanguage && 
                    message.language.detectedLanguage !== "Unknown" && (
                    <div className="mt-2 text-xs flex items-center">
                      <div className={`px-2 py-1 rounded flex items-center gap-1 ${
                        message.language.isAfricanLanguage 
                          ? "bg-[#0A7029]/10 text-[#0A7029] border border-[#0A7029]/20" 
                          : "bg-[#F2A922]/10 text-[#461111] border border-[#F2A922]/20"
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        <span className="font-medium">{message.language.detectedLanguage}</span>
                        {message.language.isAfricanLanguage && 
                          <span className="ml-1 px-1 py-0.5 rounded bg-[#0A7029]/20 text-[9px]">African</span>
                        }
                      </div>
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <Avatar className="h-8 w-8 border border-[#E94822]/20 bg-[#F7F3E3]">
                    <AvatarFallback className="bg-[#E94822]/20 text-[#461111]">U</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 border border-[#0A7029]/20 bg-[#F7F3E3]">
                  <AvatarFallback className="bg-[#F2A922]/20 text-[#461111]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg px-4 py-2 bg-gradient-to-br from-[#F7F3E3] to-[#F2A922]/20 border border-[#F2A922]/20">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-[#E94822] animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-2 h-2 rounded-full bg-[#F2A922] animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-2 h-2 rounded-full bg-[#0A7029] animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t border-[#E94822]/10 relative z-10 bg-gradient-to-r from-[#461111]/5 via-[#E94822]/5 to-[#F2A922]/5">
        <div className="flex flex-col w-full gap-3">
          {isRateLimited && (
            <div className="bg-[#F2A922]/20 border border-[#F2A922] text-[#461111] p-3 rounded-md text-sm">
              <p className="font-medium mb-1">Africon is taking a short break</p>
              <p className="text-xs">
                {rateLimitCountdown > 0 
                  ? `We can continue our conversation in ${rateLimitCountdown} seconds.` 
                  : "We can continue our conversation soon."}
              </p>
              <div className="w-full bg-[#F7F3E3] h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-[#F2A922] h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{ 
                    width: rateLimitReset ? `${100 - Math.min(100, (rateLimitCountdown / ((rateLimitReset - Date.now()) / 1000 || 60) * 100))}%` : '0%' 
                  }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex gap-2 w-full">
            <Button 
              type="button"
              onClick={handleMicClick}
              variant={isListening ? "destructive" : noSpeechDetected ? "outline" : "secondary"}
              className={`${isListening ? 'animate-pulse bg-[#E94822] hover:bg-[#E94822]/90' : noSpeechDetected ? 'border-[#F2A922] bg-[#F2A922]/20 text-[#461111]' : 'bg-[#0A7029] hover:bg-[#0A7029]/90'} ${isSpeaking || isRateLimited ? 'opacity-50' : ''}`}
              disabled={isLoading || isSpeaking || isRateLimited}
            >
              <Mic className="h-5 w-5" />
            </Button>
            
            <Button 
              type="button"
              onClick={onVoiceModeClick}
              variant="outline"
              className="border-[#0A7029]/30 hover:bg-[#0A7029]/10 hover:text-[#0A7029] flex-shrink-0"
              title="Speak in any African language"
            >
              <Globe className="h-5 w-5 mr-2" />
              <span className="hidden sm:inline">Speak in any African language</span>
            </Button>
          </div>
          
          <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isRateLimited ? `Available in ${rateLimitCountdown}s...` : getPlaceholder()}
              className="flex-grow border-[#F2A922]/30 bg-white/80 focus-visible:ring-[#0A7029] focus-visible:ring-offset-[#F7F3E3]"
              disabled={isLoading || isRateLimited}
            />
            <Button 
              type="button" 
              variant="outline"
              size="icon"
              className="flex-shrink-0 border-[#F2A922]/30 hover:bg-[#F2A922]/20 hover:text-[#461111]" 
              onClick={onNewChat}
              title="Start new conversation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"/><path d="M12 10h4"/><path d="M12 15h4"/><path d="M8 10h.01"/><path d="M8 15h.01"/></svg>
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !inputValue.trim() || isRateLimited}
              className="bg-[#E94822] hover:bg-[#E94822]/90 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          
          <div className="text-xs text-center text-[#461111]/70 p-2 bg-[#F2A922]/10 rounded-md border border-[#F2A922]/20">
            {isRateLimited 
              ? "Africon uses the free tier of Gemini AI which has usage limits. Please wait for the cooldown." 
              : "Try: \"Tell me a story about ancient African kingdoms\" • \"Translate Hello to Swahili\" • \"What is the history of Mali Empire?\""}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
} 