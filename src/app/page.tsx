"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import VoiceMode from "@/components/globe/VoiceMode";
import { dispatchSpeechResult } from "@/lib/events";
import FloatingAfricanArt from "@/components/background/FloatingAfricanArt";

// Import components
import ChatInterface from "@/components/chat/ChatInterface";
import AfriconIntro from "@/components/intro/AfriconIntro";

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

// Add SpeechRecognition type (can be refined if needed)
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

// Define types for Speech Recognition
interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence: number;
      };
      isFinal?: boolean;
    };
    length: number;
  };
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null); // To hold the recognition instance
  const [sessionId, setSessionId] = useState<string>(`session-${Date.now()}`); // Create unique session ID
  const [isSpeaking, setIsSpeaking] = useState(false); // Track speech synthesis state
  // Content type is used in the API response handling
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [contentType, setContentType] = useState<"conversation" | "story" | "translation">("conversation");
  const [noSpeechDetected, setNoSpeechDetected] = useState(false); // New state for no-speech feedback
  // Rate limiting states
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitReset, setRateLimitReset] = useState<number | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  // Refs
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const noSpeechCountRef = useRef<number>(0);
  const [speechQueue, setSpeechQueue] = useState<string[]>([]);
  const [isSpeechPlaying, setIsSpeechPlaying] = useState(false);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chatInterfaceRef = useRef<HTMLDivElement>(null);
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Add silence detection refs
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechTimestampRef = useRef<number>(Date.now());
  // Add refs to track speech recognition transcript
  const lastTranscriptRef = useRef<string>('');
  const hasSpeechBeenDetectedRef = useRef<boolean>(false);
  const transcriptUpdatedRef = useRef<boolean>(false); // New ref to track if transcript was updated

  // New state for voice mode
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);

  // UI/UX states
  const [showIntro, setShowIntro] = useState(true);

  // Add colors with African themes
  const africanColors = {
    primary: "#E94822", // Warm orange-red (sunset)
    secondary: "#F2A922", // Gold/amber
    tertiary: "#0A7029", // Forest green
    accent: "#461111", // Deep burgundy
    light: "#F7F3E3", // Warm cream/sand
    pattern: "radial-gradient(circle, #E94822 10%, transparent 11%), radial-gradient(circle at bottom left, #F2A922 5%, transparent 6%), radial-gradient(circle at bottom right, #461111 5%, transparent 6%), radial-gradient(circle at top left, #0A7029 5%, transparent 6%)",
  };

  // African pattern background styles
  const patternStyle = {
    backgroundImage: africanColors.pattern,
    backgroundSize: "7em 7em",
    backgroundPosition: "0 0, 1em 1em, 2em 2em, 3em 3em",
    backgroundColor: africanColors.light,
    opacity: 0.1,
  };

  // Add a ref to track when submission is in progress to prevent duplicates
  const submittingTranscriptRef = useRef<boolean>(false);

  // Initialize audio on first user interaction to fix iOS/macOS audio issues
  const initAudioContext = useCallback(() => {
    try {
      console.log("🔊 Initializing audio context for speech playback");
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      
      if (AudioContext) {
        // Create audio context for unlocking audio on mobile devices
        const audioCtx = new AudioContext();
        console.log(`🔊 Audio context created, state: ${audioCtx.state}`);
        
        // Method 1: Buffer source (works well on iOS/Safari)
        const silentBuffer = audioCtx.createBuffer(1, 44100, 44100);
        const bufferSource = audioCtx.createBufferSource();
        bufferSource.buffer = silentBuffer;
        bufferSource.connect(audioCtx.destination);
        
        // Start and stop to unlock
        bufferSource.start(0);
        bufferSource.stop(0.001);
        
        // Method 2: Oscillator (works well on Chrome/Firefox)
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        // Use audible volume to ensure the audio context is fully activated
        gainNode.gain.value = 0.2; 
        oscillator.frequency.value = 440;
        oscillator.type = 'sine';
        
        // Play brief sound to unlock audio
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.2);
        
        // Method 3: Initialize speech synthesis with a silent utterance
        if ('speechSynthesis' in window) {
          // First cancel any existing speech
          window.speechSynthesis.cancel();
          
          // Create a silent utterance
          const silentUtterance = new SpeechSynthesisUtterance(' ');
          silentUtterance.volume = 0.01;
          silentUtterance.rate = 1.0;
          
          // Set up handlers to monitor and clean up
          silentUtterance.onstart = () => {
            console.log("🔊 Silent speech started - audio should be unlocked");
          };
          
          silentUtterance.onend = () => {
            console.log("🔊 Silent speech ended - audio initialized");
          };
          
          silentUtterance.onerror = (e) => {
            console.warn("🔊 Silent speech error:", e);
          };
          
          // Speak and then cancel after a short delay
          try {
            window.speechSynthesis.speak(silentUtterance);
            
            // Cancel after a short delay to avoid actual audio playback
            setTimeout(() => {
              try {
                window.speechSynthesis.cancel();
              } catch (e) {
                console.warn("🔊 Error canceling silent speech:", e);
              }
            }, 250);
          } catch (e) {
            console.warn("🔊 Error initializing silent speech:", e);
          }
        }
        
        // Close audio context after a delay
        setTimeout(() => {
          if (audioCtx.state !== 'closed') {
            try {
              audioCtx.close().then(() => {
                console.log("🔊 Audio context closed successfully");
              }).catch(err => {
                console.warn("🔊 Error closing audio context:", err);
              });
            } catch {
              // Handle browsers that don't support promises with AudioContext
              try {
                audioCtx.close();
                console.log("🔊 Audio context closed (fallback)");
              } catch (err2) {
                console.warn("🔊 Error closing audio context (fallback):", err2);
              }
            }
          }
        }, 2000);
        
        console.log("🔊 Audio context initialized with multiple methods");
      } else {
        console.warn("🔊 AudioContext not supported by this browser");
      }
    } catch (err) {
      console.warn("🔊 Error initializing audio context:", err);
    }
  }, []);

  // Enhanced function to speak text with better language detection
  const speak = useCallback((text: string, languageCode?: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn("🔊 Speech Synthesis not supported by this browser.");
      return;
    }

    // Don't attempt to speak empty text
    if (!text || text.trim() === '') {
      console.log("🔊 Empty text provided to speak, skipping");
      return;
    }

    console.log(`🔊 Adding to speech queue: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);

    // First play a short, audible tone to unlock audio channels in browsers
    // This is especially important for Safari/iOS
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        // Make this audible to ensure audio is activated
        gainNode.gain.value = 0.1;  
        oscillator.frequency.value = 440;
        oscillator.type = 'sine';
        
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          // Don't close the context immediately to keep audio channels open
          setTimeout(() => {
            audioCtx.close().catch(() => {});
          }, 1000);
        }, 100);
        
        console.log("🔊 Played audio tone to unlock speech");
      }
    } catch (e) {
      console.warn("🔊 Could not play audio tone:", e);
    }

    // Initialize audio context to ensure browser audio is unlocked
    initAudioContext();

    // Add text to the queue instead of speaking immediately
    setSpeechQueue(prev => [...prev, text]);
    setIsSpeaking(true);

    // Store language code for use in processSpeech
    if (languageCode) {
      console.log(`🔊 Using language code: ${languageCode}`);
      sessionStorage.setItem(`speech-lang-${text.substring(0, 20)}`, languageCode);
    }
  }, [initAudioContext]);

  // Core speech processing logic - separated to avoid duplication
  const processSpeechCore = useCallback((text: string) => {
    if (!text || text.trim() === '') {
      console.log("🔊 Empty text provided to speech, skipping");
      setIsSpeechPlaying(false);
      if (speechQueue.length > 0) {
        setTimeout(() => {
          setSpeechQueue(prev => prev.slice(1));
        }, 100);
      }
      return;
    }

    console.log(`🔊 Processing speech: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
    setIsSpeechPlaying(true);

    // Create an iframe to isolate speech synthesis from browser extensions
    // This is a workaround for extensions that might be interfering with speech
    try {
      console.log("🔊 Creating isolated speech context");
      
      // First attempt - use document audio context directly with maximum volume
      try {
        // Force cancel any ongoing speech to avoid overlap
        window.speechSynthesis.cancel();
        console.log("🔊 Cleared previous speech");
        
        // Create utterance with the text to speak - max volume
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = 1.0; // Maximum volume
        
        // Get available voices
        const voices = window.speechSynthesis.getVoices();
        // Use first English voice for compatibility
        const englishVoice = voices.find(v => 
          v.lang.toLowerCase().includes('en-us') || 
          v.lang.toLowerCase().includes('en-gb')
        );
        
        if (englishVoice) {
          utterance.voice = englishVoice;
          utterance.lang = englishVoice.lang;
        } else if (voices.length > 0) {
          utterance.voice = voices[0];
          utterance.lang = voices[0].lang;
        }
        
        // Set handlers
        utterance.onstart = () => {
          console.log("🔊 Direct speech started");
        };
        
        utterance.onend = () => {
          console.log("🔊 Direct speech ended");
          setIsSpeaking(false);
          setIsSpeechPlaying(false);
          if (speechQueue.length > 0) {
            setTimeout(() => setSpeechQueue(prev => prev.slice(1)), 200);
          }
        };
        
        utterance.onerror = () => {
          console.log("🔊 Direct speech error - trying iframe fallback");
          createIframeFallback();
        };
        
        // Attempt direct synthesis first
        window.speechSynthesis.speak(utterance);
        console.log("🔊 Direct speech attempt made");
        
        // Keep speech synthesis alive with periodic calls
        const keepAliveInterval = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
            console.log("🔊 Keeping speech alive");
          } else {
            clearInterval(keepAliveInterval);
          }
        }, 5000);
        
        // Clear interval after a maximum time
        setTimeout(() => {
          clearInterval(keepAliveInterval);
        }, 60000);
      } catch (directError) {
        console.warn("🔊 Direct speech failed:", directError);
        createIframeFallback();
      }
      
      // Fallback function that uses an iframe for isolation
      function createIframeFallback() {
        try {
          // Remove any existing speech iframe
          const existingFrame = document.getElementById('speech-iframe');
          if (existingFrame) {
            document.body.removeChild(existingFrame);
          }
          
          // Create a new iframe for isolated speech synthesis
          const iframe = document.createElement('iframe');
          iframe.id = 'speech-iframe';
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
          
          // Get the iframe document and create script
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) {
            throw new Error("Could not access iframe document");
          }
          
          // Create a script element with speech synthesis code
          const script = iframeDoc.createElement('script');
          script.textContent = `
            try {
              // Function to speak text in isolation
              function speakText() {
                const utterance = new SpeechSynthesisUtterance(${JSON.stringify(text)});
                utterance.volume = 1.0;
                utterance.rate = 1.0;
                
                // Try to get voices
                const voices = window.speechSynthesis.getVoices();
                
                // Use English voice if available
                if (voices.length > 0) {
                  const englishVoice = voices.find(v => 
                    v.lang.includes('en-US') || v.lang.includes('en-GB')
                  );
                  if (englishVoice) {
                    utterance.voice = englishVoice;
                    utterance.lang = englishVoice.lang;
                  } else {
                    utterance.voice = voices[0];
                    utterance.lang = voices[0].lang;
                  }
                }
                
                // Set handlers
                utterance.onstart = function() {
                  window.parent.postMessage('speech-started', '*');
                };
                
                utterance.onend = function() {
                  window.parent.postMessage('speech-ended', '*');
                };
                
                utterance.onerror = function(e) {
                  window.parent.postMessage('speech-error: ' + e.error, '*');
                };
                
                // Cancel any existing speech
                window.speechSynthesis.cancel();
                
                // Speak the text
                window.speechSynthesis.speak(utterance);
                
                // Keep speech alive with periodic pings
                const keepAlive = setInterval(function() {
                  if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.pause();
                    window.speechSynthesis.resume();
                  } else {
                    clearInterval(keepAlive);
                  }
                }, 5000);
                
                // Clear interval after maximum time
                setTimeout(function() {
                  clearInterval(keepAlive);
                }, 60000);
              }
              
              // Use voices if they're already available
              if (window.speechSynthesis.getVoices().length > 0) {
                speakText();
              } else {
                // Wait for voices to be loaded
                window.speechSynthesis.onvoiceschanged = function() {
                  speakText();
                  window.speechSynthesis.onvoiceschanged = null;
                };
                
                // Fallback if voices don't load within 1 second
                setTimeout(function() {
                  if (window.speechSynthesis.onvoiceschanged) {
                    speakText();
                    window.speechSynthesis.onvoiceschanged = null;
                  }
                }, 1000);
              }
            } catch(e) {
              window.parent.postMessage('speech-fatal-error: ' + e.message, '*');
            }
          `;
          
          // Add event listener for messages from iframe
          const messageHandler = (event: MessageEvent) => {
            if (typeof event.data === 'string') {
              if (event.data === 'speech-started') {
                console.log("🔊 Iframe speech started");
                setIsSpeaking(true);
              } else if (event.data === 'speech-ended') {
                console.log("🔊 Iframe speech ended");
                setIsSpeaking(false);
                setIsSpeechPlaying(false);
                // Process next item in queue
                if (speechQueue.length > 0) {
                  setTimeout(() => setSpeechQueue(prev => prev.slice(1)), 200);
                }
                
                // Remove the iframe after speech completes
                try {
                  document.body.removeChild(iframe);
                } catch (e) {
                  console.warn("Error removing iframe:", e);
                }
                
                // Remove the message listener
                window.removeEventListener('message', messageHandler);
              } else if (event.data.startsWith('speech-error')) {
                console.warn("🔊 Iframe speech error:", event.data);
                // Try direct audio as last resort
                tryDirectAudio();
              } else if (event.data.startsWith('speech-fatal-error')) {
                console.error("🔊 Iframe fatal error:", event.data);
                // Try direct audio as last resort
                tryDirectAudio();
              }
            }
          };
          
          window.addEventListener('message', messageHandler);
          
          // Append the script to the iframe
          iframeDoc.body.appendChild(script);
          
          console.log("🔊 Created isolated speech iframe");
        } catch (iframeError) {
          console.error("🔊 Iframe speech failed:", iframeError);
          // Last resort - try direct audio
          tryDirectAudio();
        }
      }
      
      // Final fallback - use AudioContext to generate speech-like audio
      function tryDirectAudio() {
        console.log("🔊 Attempting direct audio feedback as last resort");
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            const audioCtx = new AudioContext();
            
            // Skip audio generation but still handle state cleanup
            // Create a simple timeout to handle state changes instead of playing sounds
            const duration = Math.min(text.length / 10, 5); // Limit to 5 seconds max
            
            console.log("🔊 Using silent audio feedback");
            
            // Clean up after the duration
            setTimeout(() => {
              try {
                audioCtx.close();
              } catch (e) {
                console.warn("🔊 Error closing audio context:", e);
              }
              
              // Process next item in queue
              setIsSpeaking(false);
              setIsSpeechPlaying(false);
              if (speechQueue.length > 0) {
                setTimeout(() => setSpeechQueue(prev => prev.slice(1)), 200);
              }
            }, (duration + 1) * 1000);
            
            return;
          }
        } catch (audioError) {
          console.error("🔊 Direct audio failed:", audioError);
        }
        
        // If all else fails, just move to the next item
        console.log("🔊 All speech methods failed, skipping to next item");
        setIsSpeaking(false);
        setIsSpeechPlaying(false);
        if (speechQueue.length > 0) {
          setTimeout(() => setSpeechQueue(prev => prev.slice(1)), 200);
        }
      }
      
    } catch (error) {
      console.error("🔊 Speech processing failed completely:", error);
      setIsSpeaking(false);
      setIsSpeechPlaying(false);
      
      // Move to next item
      if (speechQueue.length > 0) {
        setTimeout(() => setSpeechQueue(prev => prev.slice(1)), 200);
      }
    }
  }, [setIsSpeechPlaying, setIsSpeaking, speechQueue, setSpeechQueue]);

  // Actual speech processing function
  const processSpeech = useCallback((text: string) => {
    // Chrome SpeechSynthesis bug fixes
    const fixChromeSpeedSynthesisBug = () => {
      // Force cancel any ongoing speech
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        console.warn("Error canceling speech synthesis:", err);
      }
      
      // Force resume in case it's stuck in a paused state
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (err) {
        console.warn("Error resuming speech synthesis:", err);
      }
    };

    // Ensure we have clean state
    if (speechSynthesisRef.current) {
      fixChromeSpeedSynthesisBug();
    }

    // Reset speech synthesis if it's stuck
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        fixChromeSpeedSynthesisBug();
        
        // Small delay to ensure cancel takes effect
        setTimeout(() => {
          processSpeechCore(text);
        }, 100);
        return;
      }
    } catch (err) {
      console.warn("Error checking speech synthesis state:", err);
    }
    
    // Process immediately if not speaking/pending
    processSpeechCore(text);
  }, [processSpeechCore]);

  // Initialize Speech Recognition
  useEffect(() => {
    const cleanupFunctions: Array<() => void> = [];
    
    // Pre-initialize voices to avoid delays later
    if ('speechSynthesis' in window) {
      // Fix for Chrome/Safari SpeechSynthesis issues
      const initSpeechSynthesis = () => {
        // Force voice loading
        let voices = window.speechSynthesis.getVoices();
        console.log(`🔊 Initial voices loaded: ${voices.length}`);
        
        // Setup voice change listener for browsers that load voices asynchronously
        const voicesChangedHandler = () => {
          voices = window.speechSynthesis.getVoices();
          console.log(`🔊 Voices loaded after change: ${voices.length}`);
          
          // Log available voices for debugging
          if (voices.length > 0) {
            console.log(`🔊 First 5 available voices: ${voices.slice(0, 5).map(v => `${v.name} (${v.lang})`).join(', ')}`);
            
            // Check if we have any African voices
            const africanVoices = voices.filter(v => 
              v.lang.includes('-NG') || 
              v.lang.includes('-ZA') || 
              v.lang.includes('-GH') || 
              v.lang.includes('-KE') ||
              v.name.toLowerCase().includes('africa')
            );
            
            if (africanVoices.length > 0) {
              console.log(`🔊 Found ${africanVoices.length} African voices: ${africanVoices.map(v => `${v.name} (${v.lang})`).join(', ')}`);
            } else {
              console.log(`🔊 No specific African voices found, will use fallbacks`);
            }
          }
        };
        
        // Register for voice changes
        window.speechSynthesis.onvoiceschanged = voicesChangedHandler;
        
        // Initial call to handle browsers that might have already loaded voices
        voicesChangedHandler();
        
        // Test speech synthesis to make sure audio is working
        const testAudio = () => {
          try {
            // Create a short test utterance that won't be noticeable to the user
            const testUtterance = new SpeechSynthesisUtterance('.');
            testUtterance.volume = 0.01; // Very quiet
            testUtterance.rate = 1.5; // Fast
            testUtterance.onend = () => console.log('🔊 Test speech completed successfully');
            testUtterance.onerror = (e) => console.warn('🔊 Test speech failed:', e.error);
            
            // Cancel any existing speech first
            window.speechSynthesis.cancel();
            
            // Speak the test utterance
            setTimeout(() => {
              window.speechSynthesis.speak(testUtterance);
              console.log('🔊 Test speech initiated');
            }, 500);
          } catch (e) {
            console.warn('🔊 Could not run test speech:', e);
          }
        };
        
        // Run test after a delay to ensure browser is ready
        setTimeout(testAudio, 1000);
        
        // Periodically check and unstick the speech synthesis API
        const keepAlive = () => {
          // If it's speaking, reset the timer
          if (window.speechSynthesis.speaking) {
            console.log("Keeping speech synthesis alive during speech");
            // Safari/Chrome bug: if paused, force resume
            if (window.speechSynthesis.paused) {
              window.speechSynthesis.resume();
              console.log("Resumed paused speech synthesis");
            }
          }
        };
        
        // Check every 5 seconds to keep speech synthesis working
        const keepAliveInterval = setInterval(keepAlive, 5000);
        
        // Fix for page visibility changes in Chrome
        const visibilityHandler = () => {
          if (!document.hidden) {
            console.log("Page visible again, checking speech synthesis state");
            
            if (window.speechSynthesis.paused) {
              window.speechSynthesis.resume();
              console.log("Resumed paused speech on visibility change");
            }
            
            // If nothing is speaking but isSpeaking is true, try to recover
            if (isSpeaking && !window.speechSynthesis.speaking) {
              console.log("Speaking state mismatch, attempting recovery");
              
              // If there's an item in the queue, try processing it again
              if (speechQueue.length > 0) {
                console.log("Reprocessing speech queue after visibility change");
                const currentText = speechQueue[0];
                setSpeechQueue(prev => [...prev.slice(1), currentText]);
              } else {
                // Reset the speaking state since there's nothing to speak
                setIsSpeaking(false);
                setIsSpeechPlaying(false);
              }
            }
          } else {
            console.log("Page hidden, speech synthesis may pause");
          }
        };
        
        document.addEventListener('visibilitychange', visibilityHandler);
        
        // Return cleanup function
        return () => {
          clearInterval(keepAliveInterval);
          document.removeEventListener('visibilitychange', visibilityHandler);
          window.speechSynthesis.onvoiceschanged = null;
          
          // Cancel any pending speech when component unmounts
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
        };
      };
      
      // Initialize and store cleanup function
      cleanupFunctions.push(initSpeechSynthesis());
    } else {
      console.warn("🔊 Speech Synthesis not supported by this browser");
    }
    
    // Make a test call to the API to warm it up
    fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "test",
        sessionId: `test-${Date.now()}`,
        clearContext: true
      }),
    })
    .then(response => {
      if (response.ok) {
        console.log("🔄 API warm-up successful");
      }
    })
    .catch(error => {
      console.warn("🔄 API warm-up failed:", error);
    });
    
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        console.log("🎤 Speech Recognition API available");
        const recognizer = new SpeechRecognition();
        recognizer.continuous = true; // Change to true for better continuous recognition
        recognizer.lang = ''; // Empty string to allow auto-language detection
        recognizer.interimResults = true; // Get interim results for more responsive experience
        recognizer.maxAlternatives = 3; // Increase alternatives for better accuracy

        // Create a flag to track if we've detected speech
        let hasSpeechBeenDetected = false;
        let lastTranscript = '';

        recognizer.onresult = (event: SpeechRecognitionEvent) => {
            const lastResultIndex = event.results.length - 1;
            const transcript = event.results[lastResultIndex][0].transcript;
            const confidence = event.results[lastResultIndex][0].confidence;
            
            console.log(`🎤 Speech detected: "${transcript}" (confidence: ${confidence.toFixed(2)})`);
            
            // Store the transcript for later use when submitting
            lastTranscript = transcript;
            lastTranscriptRef.current = transcript; // Store in component-accessible ref
            transcriptUpdatedRef.current = true; // Mark that transcript was updated
            
            // Only update if we have good confidence
            if (event.results[lastResultIndex][0].confidence > 0.01) { // Decreased confidence threshold
                // Mark that we've detected speech in this session
                hasSpeechBeenDetected = true;
                hasSpeechBeenDetectedRef.current = true;
                
                // Update UI with transcription
                setInputValue(transcript); // Update input field
                
                // Reset no-speech counter on successful speech detection
                noSpeechCountRef.current = 0;
                
                // Dispatch custom event for VoiceMode component
                dispatchSpeechResult(transcript);
                
                // Update last speech timestamp whenever we detect speech
                lastSpeechTimestampRef.current = Date.now();

                // Clear any existing silence timeout and set a new one
                if (silenceTimeoutRef.current) {
                    clearTimeout(silenceTimeoutRef.current);
                }
                
                // Set timeout for silence detection - will auto submit after 3 seconds
                silenceTimeoutRef.current = setTimeout(() => {
                    // Only proceed if we're still listening and have a transcript
                    if (isListening && transcript.trim().length > 0) {
                        console.log("⭐ Silence detected, stopping recognition and submitting");
                        try {
                            // Store the transcript in a local variable
                            const silenceTranscript = transcript;
                            
                            // Stop recognition and update state immediately
                            recognition.stop();
                            setIsListening(false);
                            
                            // Force the inputValue to be set with the transcript
                            // This is critical to ensure the submission uses the correct text
                            setInputValue(silenceTranscript);
                            
                            // CRITICAL: Submit with a delay to ensure state updates
                            setTimeout(() => {
                                if (silenceTranscript.trim()) {
                                    console.log("⭐ Directly submitting after silence:", silenceTranscript);
                                    // Use a function call to ensure we're using the latest version of the transcript
                                    const userMessage: Message = { role: "user", content: silenceTranscript };
                                    setMessages((prev) => [...prev, userMessage]);
                                    setInputValue("");
                                    setIsLoading(true);
                                    transcriptUpdatedRef.current = false; // Reset transcript flag
                                    
                                    // Make the API request directly here to bypass any race conditions
                                    console.log("⭐ Making direct API call");
                                    fetch("/api/chat", {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                            message: silenceTranscript,
                                            sessionId: sessionId,
                                            clearContext: false
                                        }),
                                    })
                                    .then(response => {
                                        console.log("⭐ Direct API response received:", response.status);
                                        if (!response.ok) {
                                            throw new Error(`HTTP error! status: ${response.status}`);
                                        }
                                        return response.json();
                                    })
                                    .then(data => {
                                        console.log("⭐ Direct API success:", data.reply ? data.reply.substring(0, 50) + "..." : "No reply");
                                        if (data.reply && typeof data.reply === 'string' && data.reply.trim() !== '') {
                                            const aiMessage: Message = {
                                                role: "assistant",
                                                content: data.reply,
                                                language: data.language
                                            };
                                            setMessages((prev) => [...prev, aiMessage]);
                                            
                                            // Save session ID
                                            if (data.sessionId) {
                                                setSessionId(data.sessionId);
                                            }
                                            
                                            // Speak the response
                                            speak(data.reply, data.language?.languageCode);
                                        }
                                    })
                                    .catch(error => {
                                        console.error("⭐ Direct API request failed:", error);
                                        const errorMessage = "An error occurred while fetching the response.";
                                        const aiMessage: Message = { role: "assistant", content: errorMessage };
                                        setMessages((prev) => [...prev, aiMessage]);
                                        speak(errorMessage);
                                    })
                                    .finally(() => {
                                        setIsLoading(false);
                                    });
                                }
                            }, 300);
                        } catch (error) {
                            console.warn("⭐ Error stopping recognition on silence:", error);
                            setIsLoading(false);
                        }
                    }
                }, 3000);
            }
        };

        // Create an audiostart event handler
        recognizer.onaudiostart = () => {
            console.log("🎤 Audio capture started");
            // Reset speech detection flag
            hasSpeechBeenDetected = false;
            lastTranscript = '';
            
            // Reset timestamps for silence detection
            lastSpeechTimestampRef.current = Date.now();
            
            // Set a backup timeout in case no speech is detected at all
            const backupTimeout = setTimeout(() => {
                if (isListening && !hasSpeechBeenDetected) {
                    console.log("No speech detected for 8 seconds, stopping");
                    try {
                        recognition.stop();
                        setIsListening(false);
                        setNoSpeechDetected(true);
                    } catch (error) {
                        console.warn("Error stopping backup recognition:", error);
                    }
                }
            }, 8000);
            
            // Setup speech detection monitoring
            const speechCheckInterval = setInterval(() => {
                if (isListening && Date.now() - lastSpeechTimestampRef.current > 1000) {
                    console.log("🎤 Listening for speech...");
                }
                
                if (!isListening) {
                    clearInterval(speechCheckInterval);
                }
            }, 2000);
            
            // Clean up on recognition end
            recognizer.onend = () => {
                console.log("⭐ Recognition ended, with transcript:", lastTranscript);
                clearTimeout(backupTimeout);
                setIsListening(false);
                
                // If we have a transcript and no submission is in progress, submit it
                if (lastTranscript.trim().length > 0 && !submittingTranscriptRef.current) {
                    // Submit directly with the last transcript
                    setTimeout(() => {
                        console.log("⭐ Submitting transcript on recognition end:", lastTranscript);
                        
                        // Use direct API call approach for consistency
                        const userMessage: Message = { role: "user", content: lastTranscript };
                        setMessages((prev) => [...prev, userMessage]);
                        setInputValue("");
                        setIsLoading(true);
                        transcriptUpdatedRef.current = false; // Reset transcript flag
                        
                        // Direct API call to bypass race conditions
                        console.log("⭐ Making direct API call from recognition end");
                        fetch("/api/chat", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                message: lastTranscript,
                                sessionId: sessionId,
                                clearContext: false
                            }),
                        })
                        .then(response => {
                            console.log("⭐ Direct API response received (onend):", response.status);
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            return response.json();
                        })
                        .then(data => {
                            console.log("⭐ API success from recognition end:", data.reply ? data.reply.substring(0, 50) + "..." : "No reply");
                            if (data.reply && typeof data.reply === 'string' && data.reply.trim() !== '') {
                                const aiMessage: Message = {
                                    role: "assistant",
                                    content: data.reply,
                                    language: data.language
                                };
                                setMessages((prev) => [...prev, aiMessage]);
                                
                                // Save session ID
                                if (data.sessionId) {
                                    setSessionId(data.sessionId);
                                }
                                
                                // Speak the response
                                speak(data.reply, data.language?.languageCode);
                            }
                        })
                        .catch(error => {
                            console.error("⭐ API request failed from recognition end:", error);
                            const errorMessage = "An error occurred while fetching the response.";
                            const aiMessage: Message = { role: "assistant", content: errorMessage };
                            setMessages((prev) => [...prev, aiMessage]);
                            speak(errorMessage);
                        })
                        .finally(() => {
                            setIsLoading(false);
                        });
                    }, 300);
                } else {
                    console.log("⭐ Not submitting from onend handler - submission already in progress or no transcript");
                }
            };
        };

        recognizer.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === "no-speech") {
                // Handle no-speech error gracefully without logging to console
                setIsListening(false);
                // Provide subtle user feedback via the input placeholder
                setInputValue("");
                // Set the no-speech state to true to show feedback
                setNoSpeechDetected(true);
                // Reset transcript flag since no speech was detected
                transcriptUpdatedRef.current = false;

                // Track consecutive no-speech errors (avoid infinite retries)
                noSpeechCountRef.current += 1;

                // Auto retry if this is the first no-speech error
                if (noSpeechCountRef.current === 1) {
                    // Give user visual feedback then retry
                    setTimeout(() => {
                        if (!isListening && !isSpeaking && !isLoading) {
                            // Only restart if not already listening or speaking
                            handleMicClick();
                        }
                    }, 1500);
                } else {
                    // More than one consecutive error, just show feedback
                    setTimeout(() => setNoSpeechDetected(false), 3000);

                    // Reset counter after a longer delay to allow for manual retry
                    setTimeout(() => {
                        noSpeechCountRef.current = 0;
                    }, 10000);
                }
            } else if (event.error === "aborted") {
                // Handle aborted error silently - this is normal when stopping recognition manually
                // or when a new recognition session starts while another one is active
                setIsListening(false);
                
                // Skip logging to console as this is not a true error
                return;
            } else {
                // Log other errors as before
                console.error("Speech recognition error:", event.error);
                setIsListening(false);
                // Reset no-speech counter for other errors
                noSpeechCountRef.current = 0;
            }
        };

        // Enable cors for the API call
        try {
            // Check browser microphone authorization status
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(() => {
                    console.log("🎤 Microphone permission granted");
                })
                .catch((error) => {
                    console.error("🎤 Microphone permission denied:", error);
                });
        } catch (permissionErr) {
            console.error("🎤 Error checking microphone permission:", permissionErr);
        }

        setRecognition(recognizer);
    }
    
    // Return combined cleanup function
    return () => {
      cleanupFunctions.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
    };
  }, []);

  // Clean up any lingering timeout and speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
        recognitionTimeoutRef.current = null;
      }
      
      // Properly stop speech recognition
      if (recognition) {
        try {
          recognition.onend = null; // Remove event handlers
          recognition.onerror = null;
          recognition.onresult = null;
          recognition.stop();
        } catch {
          // Ignore errors on cleanup
        }
      }
      
      // Cancel any speech synthesis
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore errors on cleanup
        }
      }
      
      // Reset no-speech counter on unmount
      noSpeechCountRef.current = 0;
    };
  }, [recognition]); // Purposely not including other dependencies as they would cause unnecessary cleanup

  // Define handleMicClick with useCallback before using it in useEffect
  const handleMicClick = useCallback(async () => {
    if (isListening) {
        // We're already listening, so stop
        console.log("⭐ Stopping listening via manual click");
        
        // Give a short delay to ensure any final transcription results are processed
        // This fixes the race condition where onresult may fire right before stopping
        await new Promise(resolve => setTimeout(resolve, 500)); // Increased to 500ms for more reliability
        
        // Capture the current transcript before stopping recognition
        let finalTranscript = '';
        try {
            // Check if there's any transcript available from the recognition object
            if (lastTranscriptRef.current) {
                finalTranscript = lastTranscriptRef.current;
                console.log("⭐ Found final transcript in ref:", finalTranscript);
            }
        } catch {
            console.warn("⭐ Error accessing transcript ref:");
        }
        
        try {
            // Set a flag to prevent duplicate submission from onend handler
            submittingTranscriptRef.current = true;
            
            recognition.stop();
        } catch {
            console.warn("⭐ Error stopping recognition:");
        }
        
        // Immediately set to not listening to prevent double submissions
        setIsListening(false);
        
        // Use either the captured finalTranscript, inputValue, lastTranscriptRef, or empty string
        // Also check if the input field has been manually edited
        const submissionText = finalTranscript || inputValue || '';
        console.log("⭐ Manual submission text:", submissionText, "Length:", submissionText.length);
        
        // Check if we have text to submit and if transcript was ever updated
        if (submissionText.trim().length > 0 || transcriptUpdatedRef.current) {
            // Create a fallback text if nothing was captured but we know speech happened
            const effectiveText = submissionText.trim() || (transcriptUpdatedRef.current ? "hello" : "");
            
            console.log("⭐ Making direct API call for manual click with text:", 
                        effectiveText || "(empty but transcript was updated)");
            
            // Only proceed if we have something to submit
            if (effectiveText) {
                // Set loading state
                setIsLoading(true);
                
                // Use same direct API approach
                const userMessage: Message = { 
                    role: "user", 
                    content: effectiveText
                };
                setMessages((prev) => [...prev, userMessage]);
    
                // Clear input
                setInputValue("");
                
                // Reset transcript updated flag
                transcriptUpdatedRef.current = false;
    
                try {
                    // Make direct API call
                    const response = await fetch("/api/chat", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            message: effectiveText,
                            sessionId,
                            clearContext: false,
                        }),
                    });
                    
                    console.log("⭐ API response received for manual click, status:", response.status);
                    
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log("⭐ API response data for manual click:", data);
                        
                        // Process API response
                        const aiReply = data.reply || "I don't know how to respond to that.";
                        
                        // Add AI message to UI
                        const aiMessage: Message = {
                            role: "assistant",
                            content: aiReply,
                            language: data.language
                        };
                        setMessages((prev) => [...prev, aiMessage]);
                        
                        // Always speak the response
                        speak(aiReply, data.language?.languageCode);
                    } else {
                        console.error("⭐ API call failed for manual click:", response.statusText);
                        // Add error message
                        const errorMessage: Message = {
                            role: "assistant",
                            content: "Sorry, I couldn't process your request. Please try again."
                        };
                        setMessages((prev) => [...prev, errorMessage]);
                        
                        speak("Sorry, I couldn't process your request. Please try again.");
                    }
                } catch (error) {
                    console.error("⭐ Exception during API call for manual click:", error);
                    // Add error message
                    const errorMessage: Message = {
                        role: "assistant",
                        content: "Sorry, there was an error processing your request. Please try again."
                    };
                    setMessages((prev) => [...prev, errorMessage]);
                    
                    speak("Sorry, there was an error processing your request. Please try again.");
                } finally {
                    setIsLoading(false);
                    // Reset the submission flag after completion
                    submittingTranscriptRef.current = false;
                }
            } else {
                console.log("⭐ No effective text to submit - not making API call");
                submittingTranscriptRef.current = false;
            }
        } else {
            console.log("⭐ No text to submit after stopping recognition manually");
            submittingTranscriptRef.current = false;
        }
    } else {
        // Reset no-speech feedback
        setNoSpeechDetected(false);
        
        // Clear the input field when starting new recognition
        setInputValue('');
        
        // Reset our transcript detection flags
        transcriptUpdatedRef.current = false;
        hasSpeechBeenDetectedRef.current = false;
        lastTranscriptRef.current = '';

        // Request permission implicitly by starting
        try {
             // Cancel any ongoing speech
             if (window.speechSynthesis?.speaking) {
                 window.speechSynthesis.cancel();
                 console.log("🎤 Cancelled ongoing speech synthesis");
             }
             
             // Try to stop any existing recognition first
             try {
                 recognition.stop();
                 console.log("🎤 Stopped existing recognition");
             } catch {
                 // Ignore - might not be active
             }
             
             // Request microphone permission before starting
             try {
                 const stream = await navigator.mediaDevices.getUserMedia({ 
                     audio: {
                         echoCancellation: true,
                         noiseSuppression: true,
                         autoGainControl: true
                     } 
                 });
                 console.log("🎤 Microphone permission granted");
                 
                 // We don't need to keep the stream, just needed for permission
                 if (stream.getTracks) {
                     stream.getTracks().forEach(track => {
                         if (track.readyState === 'live') {
                             console.log("🎤 Audio track is live");
                         }
                     });
                 }
             } catch (micErr) {
                 console.error("🎤 Microphone permission denied:", micErr);
                 alert("Please allow microphone access to use voice features.");
                 return;
             }
             
             // Create test audio context to verify audio is working
             try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    const testContext = new AudioContext();
                    console.log("🎤 Audio context state:", testContext.state);
                    
                    // Close test context immediately
                    testContext.close().catch(error => {
                        console.warn("🎤 Error closing test audio context:", error);
                    });
                }
             } catch (audioCtxErr) {
                console.warn("🎤 Audio context test failed:", audioCtxErr);
             }
             
             // Small delay to ensure everything is reset
             setTimeout(() => {
                 try {
                     console.log("🎤 Starting speech recognition with options:", {
                         continuous: recognition.continuous,
                         interimResults: recognition.interimResults,
                         maxAlternatives: recognition.maxAlternatives,
                         lang: recognition.lang || "auto"
                     });
                     recognition.start();
                     setIsListening(true);
                 } catch (startError) {
                     console.error("Error starting recognition:", startError);
                     alert("Could not start voice recognition. Please ensure microphone permission is granted.");
                 }
             }, 150);

        } catch (error) {
            console.error("Error setting up recognition:", error);
            alert("Could not start voice recognition. Please ensure microphone permission is granted.");
        }
    }
  }, [isListening, lastTranscriptRef, recognition, inputValue, transcriptUpdatedRef, 
      setIsListening, setMessages, setInputValue, setNoSpeechDetected,
      speak, sessionId]); // Remove isVoiceModeActive

  // Modify handleSubmit to always speak responses
  const handleSubmit = async (e: React.FormEvent | { type: 'submit', text?: string }) => {
    // Check if it's a FormEvent before calling preventDefault
    if ('preventDefault' in e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    
    // Use provided text parameter if available, otherwise use inputValue state
    const submissionText = 'text' in e && e.text ? e.text : inputValue;
    
    // Debug logging
    console.log("⭐ handleSubmit triggered with text:", submissionText);
    console.log("⭐ Current state - isLoading:", isLoading, "isRateLimited:", isRateLimited);
    
    // Check if we have text to submit
    if (!submissionText.trim() || isLoading || isRateLimited) {
      console.log("⭐ Submission blocked: Empty text or already loading or rate limited");
      return;
    }

    // Detect content type based on input
    let currentContentType = "conversation";
    const lowerInput = submissionText.toLowerCase();

    if (lowerInput.includes("tell me a story") ||
        lowerInput.includes("story about") ||
        lowerInput.includes("folktale") ||
        lowerInput.includes("history of")) {
      currentContentType = "story";
    } else if (lowerInput.includes("translate") ||
               lowerInput.includes("in yoruba") ||
               lowerInput.includes("in swahili") ||
               lowerInput.includes("to english")) {
      currentContentType = "translation";
    }

    setContentType(currentContentType as "conversation" | "story" | "translation");

    const userMessage: Message = { role: "user", content: submissionText };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    console.log("⭐ Preparing API request to /api/chat");
    
    try {
      console.log("⭐ Sending fetch request to API");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId,
          clearContext: false // Keep the conversation context
        }),
      });

      console.log("⭐ API response received, status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.log("⭐ API error:", errorData);

        // Check if this is a rate limit error
        if (response.status === 429 && errorData.rateLimited) {
          setIsRateLimited(true);
          setRateLimitReset(errorData.resetTime || (Date.now() + 60000)); // Default 1 min
        }

        throw new Error(errorData.error || errorData.reply || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("⭐ API success, data received:", data.reply ? data.reply.substring(0, 50) + "..." : "No reply");

      // Check if the API returned a reply property, even if there was an error
      if (data.reply && typeof data.reply === 'string' && data.reply.trim() !== '') {
        const aiMessage: Message = {
          role: "assistant",
          content: data.reply,
          language: data.language // Store language info from API
        };
        setMessages((prev) => [...prev, aiMessage]);

        // Save the session ID returned from the server if available
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }

        // ALWAYS speak the response, regardless of voice mode
        speak(data.reply, data.language?.languageCode);
      } else {
        // This should almost never happen with the improved API, but just in case
        const errorMsg = "Sorry, I couldn't generate a response. Please try asking a different question.";
        const aiMessage: Message = { role: "assistant", content: errorMsg };
        setMessages((prev) => [...prev, aiMessage]);
        speak(errorMsg);
        console.error("Received empty or invalid reply from API");
      }
    } catch (error) {
      console.error("⭐ API request failed:", error);
      let errorMessage = "An error occurred while fetching the response.";

      // Handle specific error messages in a user-friendly way
      if (error instanceof Error) {
        errorMessage = error.message;

        // Make the error message more user-friendly for common issues
        if (errorMessage.includes("rate limit") || errorMessage.includes("quota")) {
          setIsRateLimited(true);
          if (!rateLimitReset) {
            setRateLimitReset(Date.now() + 60000); // Default 1 minute if not provided
          }
          errorMessage = "I'm taking a short break. Please try again in a moment.";
        } else if (errorMessage.includes("timeout") || errorMessage.includes("network")) {
          errorMessage = "It seems your internet connection is unstable. Please check your connection and try again.";
        } else if (errorMessage.includes("safety")) {
          errorMessage = "I couldn't answer that question due to content safety guidelines. Please try a different topic.";
        }
      }

      const aiMessage: Message = { role: "assistant", content: errorMessage };
      setMessages((prev) => [...prev, aiMessage]);

      // ALWAYS speak error messages too
      speak(errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  // Process the speech queue
  useEffect(() => {
    if (speechQueue.length > 0 && !isSpeechPlaying) {
      console.log(`🔊 Processing next item in speech queue (${speechQueue.length} items remaining)`);
      const nextText = speechQueue[0];
      
      // Process the current item but keep it in the queue until it's done
      // The actual removal happens in the onend or onerror handlers
      processSpeech(nextText);
    }
  }, [speechQueue, isSpeechPlaying, processSpeech]);
  
  // Add dedicated useEffect to monitor for and fix stuck speech states
  useEffect(() => {
    // This useEffect helps recover from cases where speech appears to be
    // playing (isSpeaking === true) but nothing is actually happening
    
    if (!isSpeaking) return; // Only run when we think speech is happening
    
    // Setup a periodic check to verify speech is actually working
    const checkInterval = setInterval(() => {
      if (isSpeaking && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        console.log("🔊 Detected stuck speech state - speech should be playing but isn't");
        
        // Get current speech synthesis state for debugging
        console.log("🔊 Speech synthesis state:", {
          speaking: window.speechSynthesis.speaking,
          pending: window.speechSynthesis.pending,
          paused: window.speechSynthesis.paused
        });
        
        // Try to resume if paused
        if (window.speechSynthesis.paused) {
          try {
            window.speechSynthesis.resume();
            console.log("🔊 Resumed paused speech synthesis");
            return; // Exit early if we successfully resumed
          } catch (e) {
            console.warn("🔊 Failed to resume:", e);
          }
        }
        
        // If we can't resume, reset the state and try the next item
        console.log("🔊 Resetting speech state after detecting stuck state");
        
        // Reset state
        setIsSpeaking(false);
        setIsSpeechPlaying(false);
        speechSynthesisRef.current = null;
        
        // Force the queue to process the next item (or retry this one)
        if (speechQueue.length > 0) {
          // Move the current item to the end if we want to retry
          // or just process the next item if we want to skip
          const shouldRetry = false; // Change to true if you want to retry failed items
          
          if (shouldRetry) {
            const currentItem = speechQueue[0];
            setSpeechQueue(prev => [...prev.slice(1), currentItem]);
          } else {
            setSpeechQueue(prev => prev.slice(1));
          }
        }
      }
    }, 5000); // Check every 5 seconds
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [isSpeaking, speechQueue, processSpeech]);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Pre-load voices (important for some browsers like Chrome)
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // The voices list is often populated asynchronously.
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };
      loadVoices(); // Initial attempt
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    // Find the viewport element within the ScrollArea's root
    const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(":scope > div"); // Adjust selector if needed based on actual rendered structure
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  const getPlaceholder = () => {
    // Rotate through different placeholders to suggest functionality
    const placeholders = [
      "Ask a question or chat in any African language...",
      "Ask for a story, historical fact, or translation...",
      "Try 'Tell me about the Great Zimbabwe'...",
      "Try 'Translate hello to Yoruba'...",
      "Say 'tell me in both languages' for bilingual responses..."
    ];

    const messageCount = messages.length;

    if (noSpeechDetected) {
      return "No speech detected. Please try again...";
    } else if (messageCount === 0) {
      return placeholders[0];
    } else if (isSpeaking) {
      return "Listening to response...";
    } else {
      // Cycle through the placeholders based on message count
      return placeholders[messageCount % placeholders.length];
    }
  };

  // Add a countdown timer for rate limits
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (isRateLimited && rateLimitReset) {
      const updateCountdown = () => {
        const secondsLeft = Math.max(0, Math.ceil((rateLimitReset - Date.now()) / 1000));
        setRateLimitCountdown(secondsLeft);

        if (secondsLeft <= 0) {
          setIsRateLimited(false);
          setRateLimitReset(null);
          if (timer) clearInterval(timer);
        }
      };

      updateCountdown(); // Initial update
      timer = setInterval(updateCountdown, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRateLimited, rateLimitReset]);

  // Voice mode is toggled directly in the UI components

  // Scroll to chat interface when starting chat
  const scrollToChat = () => {
    setShowIntro(false);
    setTimeout(() => {
      if (chatInterfaceRef.current) {
        chatInterfaceRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Add visibility change handler to resume speech when user comes back to the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // User has returned to the page - resume any paused speech
        console.log("Page visible, checking speech synthesis state");
        
        if (window.speechSynthesis && window.speechSynthesis.paused) {
          console.log("Resuming paused speech synthesis");
          try {
            window.speechSynthesis.resume();
          } catch (e) {
            console.warn("Error resuming speech on visibility change:", e);
          }
        }
        
        // If speech should be playing but isn't, try to recover
        if (isSpeaking && (!window.speechSynthesis.speaking && !window.speechSynthesis.pending)) {
          console.log("Speech appears to have been interrupted, processing queue");
          
          // Process the current queue again
          if (speechQueue.length > 0) {
            processSpeech(speechQueue[0]);
          } else {
            // Reset state if nothing to play
            setIsSpeaking(false);
            setIsSpeechPlaying(false);
          }
        }
      }
    };
    
    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSpeaking, speechQueue, processSpeech]);

  // Enhance handleMicClick to initialize audio
  const enhancedHandleMicClick = useCallback(() => {
    // Initialize audio on first click
    initAudioContext();
    
    // Call the original handler
    handleMicClick();
  }, [handleMicClick, initAudioContext]);
  
  // Enhance speak function to ensure audio is working
  const enhancedSpeak = useCallback((text: string, languageCode?: string) => {
    // Initialize audio context to ensure audio works
    initAudioContext();
    
    // Add a small delay to ensure audio is initialized
    setTimeout(() => {
      speak(text, languageCode);
    }, 100);
  }, [speak, initAudioContext]);
  
  // Replace speak with enhancedSpeak in relevant places
  useEffect(() => {
    if (isVoiceModeActive && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        enhancedSpeak(lastMessage.content, lastMessage.language?.languageCode);
      }
    }
  }, [messages, isVoiceModeActive, enhancedSpeak]);
  
  // Force browser to load audio capabilities on page load
  useEffect(() => {
    const unlockAudio = () => {
      console.log("Unlocking audio on user interaction");
      initAudioContext();
      
      // Also try to force speech synthesis initialization
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        console.log(`Preloaded ${voices.length} voices`);
        
        // Create and immediately cancel a silent utterance
        const silentUtterance = new SpeechSynthesisUtterance('');
        silentUtterance.volume = 0;
        window.speechSynthesis.speak(silentUtterance);
        window.speechSynthesis.cancel();
      }
      
      // Remove listeners after first interaction
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    
    // Add listeners for user interaction
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, [initAudioContext]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Intro Section */}
      {showIntro && (
        <AfriconIntro
          onStartChat={scrollToChat}
          onActivateVoice={() => {
            setIsVoiceModeActive(true);
            scrollToChat();
          }}
        />
      )}

      {/* Chat Interface Section */}
      <div
        ref={chatInterfaceRef}
        className="flex justify-center items-center min-h-screen w-full bg-[#F7F3E3] relative"
        style={{
          backgroundImage: "linear-gradient(rgba(247, 243, 227, 0.9), rgba(247, 243, 227, 0.9)), url('/africa-pattern.svg')",
          backgroundSize: "200px",
          backgroundRepeat: "repeat",
        }}
        id="chat-section"
      >
        {/* Floating African Art Background - now interactive */}
        <FloatingAfricanArt className="z-0 pointer-events-auto" />
        {/* Voice Mode Component */}
        {isVoiceModeActive && (
          <VoiceMode
            isActive={isVoiceModeActive}
            onClose={() => setIsVoiceModeActive(false)}
            onSubmit={(text) => {
              setInputValue(text);
              handleSubmit({ type: 'submit', text });
            }}
            isLoading={isLoading}
            isSpeaking={isSpeaking}
            isListening={isListening}
            isRateLimited={isRateLimited}
            rateLimitCountdown={rateLimitCountdown}
            onMicClick={enhancedHandleMicClick}
            noSpeechDetected={noSpeechDetected}
          />
        )}

        {/* Original Chat Interface - only show when voice mode is not active */}
        {!isVoiceModeActive && (
          <ChatInterface
            messages={messages}
            inputValue={inputValue}
            setInputValue={setInputValue}
            handleSubmit={handleSubmit}
            handleMicClick={handleMicClick}
            onVoiceModeClick={() => setIsVoiceModeActive(true)}
            isLoading={isLoading}
            isSpeaking={isSpeaking}
            isListening={isListening}
            isRateLimited={isRateLimited}
            rateLimitCountdown={rateLimitCountdown}
            rateLimitReset={rateLimitReset}
            noSpeechDetected={noSpeechDetected}
            getPlaceholder={getPlaceholder}
            onNewChat={() => {
              setMessages([]);
              setSessionId(`session-${Date.now()}`);
              // Reset rate limiting when starting a new conversation
              if (isRateLimited && rateLimitCountdown <= 0) {
                setIsRateLimited(false);
                setRateLimitReset(null);
              }
            }}
            scrollAreaRef={scrollAreaRef as React.RefObject<HTMLDivElement>}
            patternStyle={patternStyle}
          />
        )}
      </div>
    </div>
  );
}
