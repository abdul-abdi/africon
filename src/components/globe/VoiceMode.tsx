"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import InteractiveGlobe from "./InteractiveGlobe";
import { Mic, X } from "lucide-react";

interface VoiceModeProps {
  isActive: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
  isLoading: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isRateLimited: boolean;
  rateLimitCountdown: number;
  onMicClick: () => void;
  noSpeechDetected: boolean;
}

export default function VoiceMode({
  isActive,
  onClose,
  onSubmit,
  isLoading,
  isSpeaking,
  isListening,
  isRateLimited,
  rateLimitCountdown,
  onMicClick,
  noSpeechDetected
}: VoiceModeProps) {
  const [transcribedText, setTranscribedText] = useState<string>("");
  const [processingInput, setProcessingInput] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Handle closing animation
  const handleClose = () => {
    if (cardRef.current) {
      cardRef.current.classList.add('scale-95', 'opacity-0');
      setTimeout(() => {
        onClose();
      }, 300);
    } else {
      onClose();
    }
  };
  
  // Reset transcription when voice mode is activated
  useEffect(() => {
    if (isActive) {
      setTranscribedText("");
      setProcessingInput(false);
    }
  }, [isActive]);
  
  // Handle speech recognition results
  useEffect(() => {
    // Hook into the window.SpeechRecognition event
    const handleSpeechResult = (event: any) => {
      if (event?.detail?.results && event.detail.results[0]?.[0]?.transcript) {
        const text = event.detail.results[0][0].transcript;
        setTranscribedText(text);
        
        // When we get speech, ensure processing indicator is off
        setProcessingInput(false);
      }
    };
    
    // Add event listener to window - assuming the main page has already set up SpeechRecognition
    window.addEventListener('speechrecognitionresult', handleSpeechResult);
    
    return () => {
      window.removeEventListener('speechrecognitionresult', handleSpeechResult);
    };
  }, []);
  
  // Add a listener for speech iframe messages to ensure speech status is shown correctly
  useEffect(() => {
    // Listen for speech messages from iframe or other sources
    const handleSpeechMessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        if (event.data === 'speech-started') {
          console.log("🔊 Speech started - VoiceMode updated");
          // Just for debugging, no action needed as isSpeaking should be set in parent component
        } else if (event.data === 'speech-ended') {
          console.log("🔊 Speech ended - VoiceMode updated");
          // Just for debugging, no action needed as isSpeaking should be set in parent component
        }
      }
    };
    
    // Add listener for cross-frame communication
    window.addEventListener('message', handleSpeechMessage);
    
    return () => {
      window.removeEventListener('message', handleSpeechMessage);
    };
  }, []);
  
  // Show processing indicator when recognition stops with transcript
  useEffect(() => {
    if (!isListening && transcribedText.trim().length > 0 && !isLoading) {
      setProcessingInput(true);
      
      // Auto-submit when recognition stops with a transcript
      if (!isLoading) {
        console.log("Voice mode auto-submitting:", transcribedText);
        setTimeout(() => {
          onSubmit(transcribedText);
        }, 300);
      }
      
      // Automatically reset processing state after a timeout
      // This handles cases where onSubmit isn't called
      const processingTimeout = setTimeout(() => {
        setProcessingInput(false);
      }, 3000);
      
      return () => clearTimeout(processingTimeout);
    } else if (isLoading) {
      // Reset processing if we're actually loading
      setProcessingInput(false);
    }
  }, [isListening, transcribedText, isLoading, onSubmit]);
  
  if (!isActive) return null;
  
  return (
    <Card 
      ref={cardRef}
      className="w-[90vw] max-w-2xl h-[80vh] max-h-[800px] flex flex-col relative shadow-lg border-[#E94822]/20 overflow-hidden transition-all duration-300 bg-[#F7F3E3]"
    >
      <div className="relative z-10">
        <div className="text-center py-3 border-b bg-gradient-to-r from-[#461111]/10 via-[#E94822]/10 to-[#F2A922]/10 relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#461111] via-[#E94822] to-[#F2A922]"></div>
          
          <h1 className="text-xl font-bold text-[#461111]">Voice Mode</h1>
          <p className="text-xs text-[#0A7029]">Speak in any African language</p>
          
          <Button
            onClick={handleClose}
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 text-[#461111]/70 hover:text-[#461111] hover:bg-[#461111]/10"
          >
            <X size={18} />
          </Button>
        </div>
        
        {isListening && (
          <div className="absolute top-4 right-4 bg-[#E94822] text-white px-3 py-1 rounded-full text-xs animate-pulse flex items-center z-20">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
            Listening...
          </div>
        )}
        
        {processingInput && !isListening && !isSpeaking && (
          <div className="absolute top-4 right-4 bg-[#F2A922] text-white px-3 py-1 rounded-full text-xs animate-pulse flex items-center z-20">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            Processing...
          </div>
        )}
        
        {isSpeaking && !isListening && (
          <div className="absolute top-4 right-4 bg-[#0A7029] text-white px-3 py-1 rounded-full text-xs animate-pulse flex items-center z-20">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M12 8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2s2-.9 2-2v-4c0-1.1-.9-2-2-2z"/>
              <path d="m8 10 2-2m4-4 2-2m-8 6-2-2m12 2 2-2"/>
            </svg>
            Speaking...
          </div>
        )}
      </div>
      
      <CardContent className="flex-grow p-6 overflow-hidden relative z-10">
        <div className="h-full w-full flex flex-col">
          {/* Globe Visualization */}
          <div className="flex-grow flex items-center justify-center bg-gradient-to-r from-[#2f2f33] via-[#232328] to-[#2f2f33] rounded-xl overflow-hidden" style={{ minHeight: '300px' }}>
            <InteractiveGlobe 
              isListening={isListening} 
              isSpeaking={isSpeaking}
            />
          </div>
          
          {/* Transcription Display */}
          {transcribedText && (
            <div className="mt-4 p-3 bg-white/70 rounded-lg border border-[#E94822]/20 text-center">
              <p className="text-sm font-medium text-[#461111]">
                {transcribedText}
              </p>
            </div>
          )}
        </div>
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
                    width: rateLimitCountdown > 0 ? `${100 - Math.min(100, (rateLimitCountdown / 60) * 100)}%` : '0%' 
                  }}
                ></div>
              </div>
            </div>
          )}
          
          <Button 
            type="button"
            onClick={onMicClick}
            variant={isListening ? "destructive" : noSpeechDetected ? "outline" : "secondary"}
            size="lg"
            className={`w-full ${isListening ? 'animate-pulse bg-[#E94822] hover:bg-[#E94822]/90' : noSpeechDetected ? 'border-[#F2A922] bg-[#F2A922]/20 text-[#461111]' : 'bg-[#0A7029] hover:bg-[#0A7029]/90'} ${isSpeaking || isRateLimited || isLoading ? 'opacity-50' : ''}`}
            disabled={isLoading || isSpeaking || isRateLimited}
          >
            <Mic className="h-5 w-5 mr-2" />
            {isListening ? "Listening... (tap to stop)" : noSpeechDetected ? "No speech detected - try again" : isRateLimited ? `Cooling down (${rateLimitCountdown}s)` : "Speak in any African language"}
          </Button>
          
          <div className="text-xs text-center text-[#461111]/70 p-2 bg-[#F2A922]/10 rounded-md border border-[#F2A922]/20">
            {isRateLimited 
              ? "Africon uses the free tier of Gemini AI which has usage limits. Please wait for the cooldown." 
              : "Try speaking: \"Tell me a story about ancient African kingdoms\" • \"Translate Hello to Swahili\" • \"What is the history of Mali Empire?\""}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
} 