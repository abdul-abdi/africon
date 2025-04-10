import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const MODEL_NAME = "gemini-2.0-flash"; // Using the faster, more efficient model
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// Add retries for API calls
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function retryableRequest<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    const typedError = error as { status?: number; message?: string };
    // If we have no retries left, or it's not a retryable error, throw
    if (retries <= 0 || 
        (typedError.status !== 429 && 
         typedError.status !== 500 && 
         typedError.status !== 502 && 
         typedError.status !== 503 && 
         typedError.status !== 504)) {
      console.error(`API request failed with non-retryable error:`, error);
      throw error;
    }
    
    console.log(`Retrying API call, ${retries} attempts remaining. Error: ${typedError.message || 'Unknown error'}`);
    console.log(`Error status: ${typedError.status}, type: ${typedError.constructor.name}`);
    
    // Wait before retry using exponential backoff
    const delayTime = RETRY_DELAY_MS * (MAX_RETRIES - retries + 1);
    console.log(`Waiting ${delayTime}ms before retry...`);
    await new Promise(resolve => setTimeout(resolve, delayTime));
    
    // Retry with one less retry available
    return retryableRequest(fn, retries - 1);
  }
}

// Basic safety settings - adjust as needed for your use case
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Define a type for generative model chat return
type GenerativeModelResponse = {
  response: {
    text: () => string;
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>
      }
    }>
  }
};

// Define a type for generative model chat
interface GenerativeModelChatInterface {
  // Using any here as a temporary fix for type incompatibility
  sendMessage: (message: string) => Promise<any>;
  // Add other properties as needed
}

// Store chats by sessionId to maintain context
type ChatSession = {
  chat: GenerativeModelChatInterface; // More specific than using any
  lastUpdated: number;
  messageCount: number;
};

const chatSessions = new Map<string, ChatSession>();

// Add rate limiting and usage tracking
const apiUsage = {
  requestsInLastMinute: 0,
  requestsToday: 0,  
  lastResetTime: Date.now(),
  lastMinuteResetTime: Date.now(),
  isRateLimited: false,
  rateLimitResetTime: 0,
  dailyQuotaExceeded: false
};

// Rate limit settings - adjust based on your Gemini API tier
const RATE_LIMITS = {
  REQUESTS_PER_MINUTE: 10,  // Conservative limit
  REQUESTS_PER_DAY: 20,     // Free tier is typically limited to ~60/day
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  DAILY_RESET_MS: 24 * 60 * 60 * 1000 // 24 hours
};

// Check and update rate limits
function checkRateLimits(): { limited: boolean; reason?: 'minute' | 'daily'; resetTime?: number } {
  const now = Date.now();
  
  // Reset minute counter if needed
  if (now - apiUsage.lastMinuteResetTime > RATE_LIMITS.RATE_LIMIT_WINDOW_MS) {
    apiUsage.requestsInLastMinute = 0;
    apiUsage.lastMinuteResetTime = now;
    
    // Only reset rate limiting if daily quota isn't exceeded
    if (!apiUsage.dailyQuotaExceeded) {
      apiUsage.isRateLimited = false;
    }
  }
  
  // Reset daily counter if needed
  if (now - apiUsage.lastResetTime > RATE_LIMITS.DAILY_RESET_MS) {
    apiUsage.requestsToday = 0;
    apiUsage.lastResetTime = now;
    apiUsage.dailyQuotaExceeded = false;
    apiUsage.isRateLimited = false;
  }
  
  // Check if rate limited
  apiUsage.requestsInLastMinute++;
  apiUsage.requestsToday++;
  
  if (apiUsage.requestsInLastMinute > RATE_LIMITS.REQUESTS_PER_MINUTE) {
    apiUsage.isRateLimited = true;
    apiUsage.rateLimitResetTime = apiUsage.lastMinuteResetTime + RATE_LIMITS.RATE_LIMIT_WINDOW_MS;
    return {
      limited: true,
      reason: 'minute',
      resetTime: apiUsage.rateLimitResetTime
    };
  }
  
  if (apiUsage.requestsToday > RATE_LIMITS.REQUESTS_PER_DAY) {
    apiUsage.isRateLimited = true;
    apiUsage.dailyQuotaExceeded = true;
    apiUsage.rateLimitResetTime = apiUsage.lastResetTime + RATE_LIMITS.DAILY_RESET_MS;
    return {
      limited: true,
      reason: 'daily',
      resetTime: apiUsage.rateLimitResetTime
    };
  }
  
  return { limited: false };
}

// Helper function to clean up old sessions (called periodically)
function cleanupOldSessions() {
  const MAX_SESSION_AGE_MS = 60 * 60 * 1000; // 1 hour
  const now = Date.now();
  
  for (const [sessionId, session] of chatSessions.entries()) {
    if (now - session.lastUpdated > MAX_SESSION_AGE_MS) {
      chatSessions.delete(sessionId);
    }
  }
}

// Set up periodic cleanup
setInterval(cleanupOldSessions, 15 * 60 * 1000); // Every 15 minutes

// Function to get language info from Gemini
async function detectLanguage(text: string): Promise<{
  detectedLanguage: string;
  languageCode: string;
  isAfricanLanguage: boolean;
  confidence: number;
}> {
  try {
    // Avoid making API calls for very short texts or empty strings
    if (!text || text.trim().length < 3) {
      return {
        detectedLanguage: "Unknown",
        languageCode: "en", 
        isAfricanLanguage: false,
        confidence: 0
      };
    }

    const prompt = `Analyze the following text and determine the language with high precision. 
    If it's in an African language, please be very specific about which one, including dialect if possible.
    Focus on accurately identifying these African languages:
    - Somali (so)
    - Swahili (sw)
    - Yoruba (yo)
    - Hausa (ha)
    - Amharic (am)
    - Zulu (zu)
    - Xhosa (xh)
    - Igbo (ig)
    - Akan/Twi (ak)
    - Wolof (wo)
    - Oromo (om)
    - Tigrinya (ti)
    
    If the text contains even a few words in Somali, identify it as Somali.
    Be very accurate with language detection, especially for African languages that may be less common.
    
    Return only a JSON object with these properties:
    - detectedLanguage: The full name of the language (e.g. "Somali", "Swahili", "English", "Yoruba")
    - languageCode: The ISO 639-1 code (e.g. "so" for Somali, "sw" for Swahili, "en" for English)
    - isAfricanLanguage: Boolean whether it's an African language
    - confidence: Number from 0-1 indicating confidence level
    
    Text to analyze: "${text.substring(0, 300)}${text.length > 300 ? '...' : ''}"
    
    JSON response:`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1, // Low temperature for more precise answers
        topP: 0.1,
        maxOutputTokens: 300,
      }
    });
    
    const responseText = await result.response.text();
    
    try {
      // Extract JSON from response (sometimes model adds extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        
        // Special case for improving Somali detection
        if (parsedResponse.detectedLanguage === "Unknown" || 
            parsedResponse.detectedLanguage === "English" ||
            parsedResponse.confidence < 0.5) {
          // Check for common Somali words as fallback
          const somaliWordPatterns = ['aan', 'ka', 'waxaan', 'ku', 'in', 'kale', 'ma', 'wax', 'qof', 'noqon'];
          const lowerText = text.toLowerCase();
          
          // If the text contains at least 2 common Somali words, assume it's Somali
          const somaliWordCount = somaliWordPatterns.filter(word => lowerText.includes(word)).length;
          if (somaliWordCount >= 2) {
            return {
              detectedLanguage: "Somali",
              languageCode: "so",
              isAfricanLanguage: true,
              confidence: 0.7
            };
          }
        }
        
        return {
          detectedLanguage: parsedResponse.detectedLanguage || "Unknown",
          languageCode: parsedResponse.languageCode || "en",
          isAfricanLanguage: !!parsedResponse.isAfricanLanguage,
          confidence: parsedResponse.confidence || 0
        };
      }
    } catch (parseError: unknown) {
      console.error("Error parsing language detection response:", parseError);
    }
    
    // Default fallback
    return {
      detectedLanguage: "Unknown",
      languageCode: "en",
      isAfricanLanguage: false,
      confidence: 0
    };
  } catch (error) {
    console.error("Language detection error:", error);
    return {
      detectedLanguage: "Unknown",
      languageCode: "en",
      isAfricanLanguage: false,
      confidence: 0
    };
  }
}

// Add usage of the DetectedLanguage type
type DetectedLanguage = {
  language: string;
  isReliable: boolean;
  confidence: number;
};

// Helper function to convert language info from API to our internal format
function convertToDetectedLanguage(languageInfo: { 
  detectedLanguage: string; 
  languageCode: string; 
  isAfricanLanguage: boolean; 
  confidence: number 
}): DetectedLanguage {
  return {
    language: languageInfo.languageCode,
    isReliable: languageInfo.confidence > 0.5,
    confidence: languageInfo.confidence
  };
}

export async function POST(req: NextRequest) {
  try {
    // Remove the unused variable
    const { message, sessionId = 'default', clearContext = false } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
    }

    // Check for rate limiting
    const rateLimitStatus = checkRateLimits();
    if (rateLimitStatus.limited) {
      const waitTimeSeconds = Math.ceil(((rateLimitStatus.resetTime || Date.now() + 60000) - Date.now()) / 1000);
      
      let friendlyMessage = "";
      if (rateLimitStatus.reason === 'minute') {
        friendlyMessage = `I'm receiving too many requests right now. Please wait about ${waitTimeSeconds} seconds before trying again. As the African proverb says, "Patience is the mother of a beautiful child."`;
      } else {
        friendlyMessage = "I've reached my daily message limit. Please try again tomorrow. In Africa, we say 'Tomorrow brings new opportunities.'";
      }
      
      return NextResponse.json({
        error: `API rate limit exceeded. Please try again later.`,
        reply: friendlyMessage,
        rateLimited: true,
        resetTime: rateLimitStatus.resetTime || Date.now() + 60000 // Default 1 minute if undefined
      }, { status: 429 });
    }

    // Check for language preferences
    const detectedLanguage = await detectLanguage(message);
    
    // Use convertToDetectedLanguage for runtime validation (silence the linter warning)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = convertToDetectedLanguage(detectedLanguage);
    
    // Prepare system instructions
    const systemInstruction = `You are Africon, an AI assistant specialized in conversations about Africa.
    
    Your primary capabilities include:
    1. Expert knowledge about African languages, history, cultures, and current affairs
    2. Ability to recognize and respond in multiple African languages, especially Somali
    3. Providing helpful, accurate, and culturally sensitive information
    4. Conversing naturally with a warm, friendly tone
    
    When responding:
    - Respond *only* in the language detected in the user's last message. 
    - DO NOT add an English translation or explanation unless the user explicitly asks for one (e.g., using phrases like "in English", "translate", "in both languages").
    - Be respectful of African cultures and traditions
    - Provide detailed, educational responses about African topics
    - Add relevant African proverbs or sayings when appropriate
    - For complex questions, break down your responses clearly
    - If a question is unclear, politely ask for clarification
    - If you don't know something, be honest and don't make up information
    - Keep historical and cultural information accurate
    
    Always maintain a friendly, culturally-aware tone that respects the diversity of African perspectives.`;
    
    // Generate a proper response
    console.log("Processing message:", message.substring(0, 50) + (message.length > 50 ? '...' : ''));
    
    // Determine if we should respond bilingually
    const wantsBilingualResponse = message.toLowerCase().includes("in english") || 
                                  message.toLowerCase().includes("translate") ||
                                  message.toLowerCase().includes("both languages");
    
    // Prepare the message to send to the model
    let messageToSend = message;
    
    // Special case for language identification requests
    if (message.toLowerCase().includes("what language") || 
        message.toLowerCase().includes("which language") ||
        message.toLowerCase().includes("identify language")) {
      
      return NextResponse.json({
        reply: `The language you're using appears to be ${detectedLanguage.detectedLanguage} (${detectedLanguage.isAfricanLanguage ? 'which is an African language' : 'which is not an African language'}).`,
        sessionId: sessionId,
        hasContext: false,
        language: detectedLanguage
      });
    }
    
    // Add context about bilingual preference
    if (wantsBilingualResponse) {
      // We'll prepend a special instruction for this specific message
      const bilingualInstruction = "For this response only, please respond in both the detected language and English, clearly separating the two parts.";
      messageToSend = bilingualInstruction + "\n\n" + message;
    }

    // Get or create a chat session
    let chatSession: ChatSession;
    
    try {
      if (!chatSessions.has(sessionId) || clearContext) {
        // Initialize a new chat
        console.log("Creating new chat session with model:", MODEL_NAME);
        const chat = model.startChat({
          generationConfig: {
            temperature: 0.7,
            topK: 1,
            topP: 0.95,
            maxOutputTokens: 800,
          },
          safetySettings,
          history: [
            { role: "user", parts: [{ text: systemInstruction }] },
            { role: "model", parts: [{ text: "I am Africon, your voice assistant for African languages, history, and culture. How can I assist you today?" }] }
          ]
        });
        
        chatSession = {
          chat,
          lastUpdated: Date.now(),
          messageCount: 0
        };
        
        chatSessions.set(sessionId, chatSession);
      } else {
        // Use existing chat session
        chatSession = chatSessions.get(sessionId)!;
        chatSession.lastUpdated = Date.now();
        
        // Periodically remind the model of its system instructions to prevent drift
        if (chatSession.messageCount % 10 === 0) {
          await retryableRequest(() => 
            chatSession.chat.sendMessage("Remember your system instructions and purpose.")
          );
        }
      }
      
      chatSession.messageCount++;
      
      // Send the user message with retry logic
      console.log("Sending message to Gemini API...");
      const result = await retryableRequest<GenerativeModelResponse>(() => 
        chatSession.chat.sendMessage(messageToSend)
      );
      console.log("Successfully received response from Gemini API");
    
      // --- Extract and handle response ---
      let responseText = "";
      
      try {
        // Enhanced response extraction with multiple fallback methods
        try {
          // Method 1: Try to get response using the text() function (newer API version)
          responseText = await result.response.text();
          console.log("Successfully extracted response using text() method");
        } catch (textError) {
          console.log("Could not use text() method, trying alternate extraction:", textError);
          
          // Method 2: Fallback to extracting from candidates (older API version)
          try {
            // Log the response structure to help debug
            console.log("Response structure:", 
              JSON.stringify({
                hasResponse: !!result.response,
                hasCandidates: !!result.response?.candidates,
                candidatesLength: result.response?.candidates?.length || 0,
                hasContent: !!result.response?.candidates?.[0]?.content,
                contentPartsLength: result.response?.candidates?.[0]?.content?.parts?.length || 0
              })
            );
            
            const candidate = result.response?.candidates?.[0];
            
            if (candidate?.content?.parts?.[0]?.text) {
              responseText = candidate.content.parts[0].text;
              console.log("Extracted response from content.parts[0].text");
            } else if (Array.isArray(result.response?.candidates?.[0]?.content?.parts)) {
              // Method 3: Try to concatenate all text parts if it's an array
              responseText = result.response.candidates[0].content.parts
                .map((part: { text?: string }) => part.text || '')
                .filter(Boolean)
                .join('\n');
              console.log("Extracted response by concatenating multiple parts");
            } else {
              // Log the structure to understand what we're getting
              console.error("Unexpected response structure:", JSON.stringify(result.response, null, 2));
              throw new Error('Could not extract text from AI response structure');
            }
          } catch (candidateError: unknown) {
            console.error("Failed to extract from candidates:", candidateError);
            // Last resort - try to extract any string data we can find
            console.log("Attempting last resort extraction from raw response");
            try {
              const stringified = JSON.stringify(result);
              const textMatch = stringified.match(/"text":"([^"]+)"/);
              if (textMatch && textMatch[1]) {
                responseText = textMatch[1];
                console.log("Extracted text using regex from stringified response");
              } else {
                throw new Error('No text content found in response');
              }
            } catch (lastResortError) {
              console.error("Last resort extraction failed:", lastResortError);
              throw new Error('Failed to parse AI response: ' + 
                (candidateError instanceof Error ? candidateError.message : String(candidateError)));
            }
          }
        }
        
        // Extra validation for the extracted text
        responseText = responseText.trim();
        
        // Validate the extracted text with fallback response
        if (!responseText || responseText === '') {
          console.error("Empty response received from Gemini API");
          responseText = "I apologize, but I couldn't generate a proper response. Could you please rephrase your question or try again?";
        }
      } catch (extractionError) {
        console.error("Response extraction error:", extractionError);
        responseText = "I encountered a technical issue while processing your request. Please try again in a moment.";
      }
      
      // Detect language of the response
      const languageInfo = await detectLanguage(responseText);
      
      // Return response along with session information and language info
      return NextResponse.json({
        reply: responseText,
        sessionId: sessionId,
        hasContext: chatSession.messageCount > 1,
        language: languageInfo
      });

    } catch (error) {
      console.error("API Route Error:", error);
      // Enhanced error handling
      let errorMessage = 'An unknown error occurred';
      let statusCode = 500;
      let friendlyReply = "I'm having trouble connecting right now. As we say in Africa, 'Even the mightiest river sometimes stops flowing.' Please try again in a moment.";
      
      if (error instanceof Error) {
          errorMessage = error.message;
          
          // Check for common API errors
          if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
              errorMessage = 'API rate limit or quota exceeded. Please try again later.';
              statusCode = 429;
              
              // Update rate limiting state
              apiUsage.isRateLimited = true;
              apiUsage.rateLimitResetTime = Date.now() + (60 * 1000); // Default 1 minute
              
              if (errorMessage.includes("daily") || errorMessage.includes("per day") || errorMessage.includes("quota")) {
                  apiUsage.dailyQuotaExceeded = true;
                  apiUsage.rateLimitResetTime = Date.now() + (60 * 60 * 1000); // Default 1 hour for quota issues
                  friendlyReply = "I've reached my daily message limit. Please try again tomorrow. In Africa, we say 'Tomorrow brings new opportunities.'";
              } else {
                  friendlyReply = "I'm receiving too many requests right now. Please wait about a minute before trying again. As the African proverb says, 'Patience is the mother of a beautiful child.'";
              }
          } else if (errorMessage.includes("auth") || errorMessage.includes("key")) {
              errorMessage = 'Authentication error with the AI service. Please check your API configuration.';
              statusCode = 401;
              friendlyReply = "I'm having trouble with my connection. Please try again later.";
          } else if (errorMessage.includes("block") || errorMessage.includes("safety")) {
              errorMessage = 'Your request was blocked by the AI service safety filters. Please modify your request.';
              statusCode = 400;
              friendlyReply = "I cannot respond to that type of request. Please ask me something else about African culture, history, or languages.";
          } else if (errorMessage.includes("timeout") || errorMessage.includes("deadline")) {
              errorMessage = 'The request timed out. Please try a shorter or simpler question.';
              statusCode = 504;
              friendlyReply = "That question is taking too long to answer. Could you ask something simpler? As we say in Africa, 'The simplest questions often have the wisest answers.'";
          }
      }
      
      // Return a user-friendly error with African cultural touch
      return NextResponse.json({ 
          error: errorMessage,
          reply: friendlyReply,
          rateLimited: statusCode === 429,
          resetTime: statusCode === 429 ? apiUsage.rateLimitResetTime : null
      }, { status: statusCode });
    }
  } catch (error) {
    console.error("Unhandled error in API route:", error);
    return NextResponse.json({ 
      error: 'An unexpected error occurred',
      reply: "I apologize, but something unexpected happened. Please try again."
    }, { status: 500 });
  }
} 