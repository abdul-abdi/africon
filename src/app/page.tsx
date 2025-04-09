"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Enhanced function to speak text with better language detection
  const speak = (text: string, languageCode?: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn("🔊 Speech Synthesis not supported by this browser.");
      return;
    }

    console.log(`🔊 Adding to speech queue: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);

    // Add text to the queue instead of speaking immediately
    setSpeechQueue(prev => [...prev, text]);
    setIsSpeaking(true);

    // Store language code for use in processSpeech
    if (languageCode) {
      console.log(`🔊 Using language code: ${languageCode}`);
      sessionStorage.setItem(`speech-lang-${text.substring(0, 20)}`, languageCode);
    }
  };

  // Core speech processing logic - separated to avoid duplication
  const processSpeechCore = (text: string) => {
    setIsSpeechPlaying(true);

    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesisRef.current = utterance;

    // Check if we have a stored language code for this text
    const storedLangCode = sessionStorage.getItem(`speech-lang-${text.substring(0, 20)}`);

    // Improved language detection for African languages
    const voices = window.speechSynthesis.getVoices();
    let targetLangCode = storedLangCode || 'en'; // Use API-detected language or default to English

    // Language code mapping for better voice selection
    const langCodeMap: {[key: string]: string} = {
      'sw': 'sw', // Swahili
      'yo': 'en-NG', // Yoruba - fallback to Nigerian English
      'ha': 'en-NG', // Hausa - fallback to Nigerian English
      'am': 'am', // Amharic
      'zu': 'en-ZA', // Zulu - fallback to South African English
      'xh': 'en-ZA', // Xhosa - fallback to South African English
      'ig': 'en-NG', // Igbo - fallback to Nigerian English
      'af': 'af', // Afrikaans
      'sn': 'en-ZA', // Shona - fallback to South African English
      'st': 'en-ZA', // Sesotho - fallback to South African English
      'tn': 'en-ZA', // Setswana - fallback to South African English
      'wo': 'fr-SN', // Wolof - fallback to Senegalese French
      'so': 'ar', // Somali - fallback to Arabic as it's phonetically closer
    };
    
    // Add support for more African languages
    const additionalLangMap: {[key: string]: string} = {
      'ln': 'fr-CD', // Lingala - fallback to Congolese French
      'mg': 'fr', // Malagasy - fallback to French
      'ny': 'en-MW', // Chichewa - fallback to Malawian English
      'om': 'am', // Oromo - fallback to Amharic
      'rw': 'fr-RW', // Kinyarwanda - fallback to Rwandan French
      'lg': 'en-UG', // Luganda - fallback to Ugandan English
      'ti': 'am', // Tigrinya - fallback to Amharic
    };
    
    // Merge language maps
    const mergedLangMap = {...langCodeMap, ...additionalLangMap};

    // Map the language code if we have a better match
    if (mergedLangMap[targetLangCode]) {
      targetLangCode = mergedLangMap[targetLangCode];
    }

    // Only use pattern detection as fallback if we don't have language from API
    if (!storedLangCode) {
      // African language detection patterns as fallback
      const langPatterns = [
        { code: 'sw', keywords: ['habari', 'asante', 'jambo', 'karibu', 'hakuna', 'matata', 'kwaheri'] }, // Swahili
        { code: 'yo', keywords: ['bawo', 'ṣe', 'jọwọ', 'pẹlẹ', 'kí', 'ní', 'ilé'] }, // Yoruba
        { code: 'ha', keywords: ['sannu', 'yaya', 'kana', 'lafiya', 'nagode', 'madalla'] }, // Hausa
        { code: 'am', keywords: ['selam', 'aderesachu', 'tedenagarku', 'betam', 'ameseginalew'] }, // Amharic
        { code: 'zu', keywords: ['sawubona', 'unjani', 'yebo', 'ngiyabonga', 'hamba'] }, // Zulu
        { code: 'xh', keywords: ['molo', 'unjani', 'ewe', 'enkosi', 'sala'] }, // Xhosa
        { code: 'af', keywords: ['hallo', 'totsiens', 'dankie', 'asseblief', 'goeie'] },  // Afrikaans
        { code: 'so', keywords: ['waa', 'aan', 'ku', 'ka', 'in', 'waxaan', 'maanta', 'wax', 'qof', 'ma'] } // Somali
      ];

      const lowerText = text.toLowerCase();

      // Check for language patterns
      for (const lang of langPatterns) {
        if (lang.keywords.some(keyword => lowerText.includes(keyword))) {
          targetLangCode = langCodeMap[lang.code] || lang.code;
          break;
        }
      }
    }

    // Improved voice selection
    // Try to find exact language match first
    let targetVoice = voices.find(voice => voice.lang.toLowerCase() === targetLangCode.toLowerCase());
    
    // Try partial match if no exact match
    if (!targetVoice) {
      targetVoice = voices.find(voice => voice.lang.toLowerCase().startsWith(targetLangCode.toLowerCase().split('-')[0]));
    }

    // If no match found for specific African language, try to find a voice with similar accent
    if (!targetVoice && targetLangCode !== 'en') {
      // Look for English voices that might have African accents
      const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
      // This is a fallback strategy - browser voice support for African languages is limited
      targetVoice = englishVoices.find(voice => voice.name.toLowerCase().includes('africa')) || 
                    englishVoices.find(voice => voice.name.toLowerCase().includes('nigeria')) ||
                    englishVoices.find(voice => voice.name.toLowerCase().includes('kenya')) ||
                    englishVoices[0];
    }

    if (targetVoice) {
      utterance.voice = targetVoice;
      utterance.lang = targetVoice.lang;
    } else {
      // If we can't find a specific voice, at least set the lang attribute
      utterance.lang = targetLangCode.split('-')[0]; // Use the base language code
      console.warn(`No suitable voice found for detected language (${targetLangCode}). Using default with lang attribute.`);
    }

    // Set speech properties for better experience
    utterance.rate = 1.0; // Normal speed
    utterance.pitch = 1.0; // Normal pitch
    utterance.volume = 1.0; // Maximum volume

    // Add event handlers
    utterance.onstart = () => {
      // Visual indicator that speech is happening
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      // Speech finished - ready for next interaction
      setIsSpeaking(false);
      setIsSpeechPlaying(false);
      speechSynthesisRef.current = null;

      // Remove the stored language code
      sessionStorage.removeItem(`speech-lang-${text.substring(0, 20)}`);
    };

    utterance.onerror = (event) => {
      // Improved error handling
      if (event.error === 'interrupted') {
        console.warn("Speech synthesis was interrupted. This is normal when changing utterances.");
      } else {
        console.error("Speech synthesis error:", event.error);
      }

      // Make sure we clean up properly even on error
      setIsSpeaking(false);
      setIsSpeechPlaying(false);
      speechSynthesisRef.current = null;

      // Remove the stored language code
      sessionStorage.removeItem(`speech-lang-${text.substring(0, 20)}`);
      
      // Try next item in queue
      if (speechQueue.length > 0) {
        setTimeout(() => {
          setSpeechQueue(prev => prev.slice(1));
        }, 500);
      }
    };

    // Safety check to ensure browser is ready
    try {
      // Speak the text
      window.speechSynthesis.speak(utterance);
      
      // Chrome bug workaround: if speech doesn't start in 3 seconds, reset
      const speechTimeout = setTimeout(() => {
        if (speechSynthesisRef.current === utterance && 
            !window.speechSynthesis.speaking && 
            !window.speechSynthesis.pending) {
          console.warn("Speech synthesis appears stuck - resetting");
          setIsSpeaking(false);
          setIsSpeechPlaying(false);
          speechSynthesisRef.current = null;
          
          // Move to next item in queue
          if (speechQueue.length > 0) {
            setSpeechQueue(prev => prev.slice(1));
          }
        }
      }, 3000);
      
      // Clear timeout when speech starts or ends
      utterance.onstart = () => {
        clearTimeout(speechTimeout);
        setIsSpeaking(true);
      };
      
      const originalOnEnd = utterance.onend;
      utterance.onend = (event) => {
        clearTimeout(speechTimeout);
        if (originalOnEnd) originalOnEnd.call(utterance, event);
      };
      
    } catch (error) {
      console.error("Error trying to speak:", error);
      setIsSpeaking(false);
      setIsSpeechPlaying(false);
      speechSynthesisRef.current = null;

      // Remove the stored language code
      sessionStorage.removeItem(`speech-lang-${text.substring(0, 20)}`);
      
      // Try next item in queue
      if (speechQueue.length > 0) {
        setTimeout(() => {
          setSpeechQueue(prev => prev.slice(1));
        }, 500);
      }
    }
  };

  // Actual speech processing function
  const processSpeech = (text: string) => {
    // Ensure we have clean state
    if (speechSynthesisRef.current) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        console.warn("Error canceling previous speech:");
      }
    }

    // Reset speech synthesis if it's stuck
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
        // Small delay to ensure cancel takes effect
        setTimeout(() => {
          processSpeechCore(text);
        }, 100);
        return;
      }
    } catch {
      console.warn("Error checking speech synthesis state:");
    }
    
    // Process immediately if not speaking/pending
    processSpeechCore(text);
  };

  // Initialize Speech Recognition
  useEffect(() => {
    // Pre-initialize voices to avoid delays later
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
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
                
                // If we have a transcript, submit it
                if (lastTranscript.trim().length > 0) {
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
    } else {
        console.warn("🎤 Speech Recognition not supported by this browser.");
        // Optionally disable mic button here
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, isSpeaking, isLoading]);

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
  }, [recognition]);

  const handleMicClick = async () => {
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
                        
                        // Speak the reply if voice mode is active
                        if (isVoiceModeActive) {
                            speak(aiReply, data.language?.languageCode);
                        }
                    } else {
                        console.error("⭐ API call failed for manual click:", response.statusText);
                        // Add error message
                        const errorMessage: Message = {
                            role: "assistant",
                            content: "Sorry, I couldn't process your request. Please try again."
                        };
                        setMessages((prev) => [...prev, errorMessage]);
                        
                        if (isVoiceModeActive) {
                            speak("Sorry, I couldn't process your request. Please try again.");
                        }
                    }
                } catch (error) {
                    console.error("⭐ Exception during API call for manual click:", error);
                    // Add error message
                    const errorMessage: Message = {
                        role: "assistant",
                        content: "Sorry, there was an error processing your request. Please try again."
                    };
                    setMessages((prev) => [...prev, errorMessage]);
                    
                    if (isVoiceModeActive) {
                        speak("Sorry, there was an error processing your request. Please try again.");
                    }
                } finally {
                    setIsLoading(false);
                }
            } else {
                console.log("⭐ No effective text to submit - not making API call");
            }
        } else {
            console.log("⭐ No text to submit after stopping recognition manually");
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
  };

  // Modify handleSubmit to potentially handle form submission via voice
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

        // --- Add Speech Synthesis ---
        speak(data.reply, data.language?.languageCode);
        // --- End Speech Synthesis ---
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

      // --- Add Speech Synthesis for error ---
      speak(errorMessage);
      // --- End Speech Synthesis ---
    } finally {
        setIsLoading(false);
    }
  };

  // Process the speech queue
  useEffect(() => {
    if (speechQueue.length > 0 && !isSpeechPlaying && 'speechSynthesis' in window) {
      const nextText = speechQueue[0];
      console.log(`🔊 Processing speech from queue: "${nextText.substring(0, 30)}${nextText.length > 30 ? '...' : ''}"`);
      setSpeechQueue(prev => prev.slice(1)); // Remove the first item
      processSpeech(nextText);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechQueue, isSpeechPlaying]);

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
            onMicClick={handleMicClick}
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
