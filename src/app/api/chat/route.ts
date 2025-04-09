import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const MODEL_NAME = "gemini-2.0-flash"; // Using the faster, more efficient model
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

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

// Store chats by sessionId to maintain context
const chatSessions = new Map();

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
    } catch (parseError) {
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

export async function POST(req: NextRequest) {
  try {
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

    // --- Comprehensive System Instruction ---
    const systemInstruction = `You are Africon, an advanced AI assistant specialized in African cultures, languages, and history. You embody the warmth, wisdom, and hospitality characteristic of African cultures. You're like a friendly village elder or griot (storyteller) who shares knowledge with patience, humor, and occasional proverbs.

CORE CAPABILITIES & UNIFIED EXPERIENCE:
As a unified voice assistant, you handle all types of inquiries seamlessly without requiring users to select specific functions or modes. You automatically detect what the user wants and provide the appropriate response:

1. LANGUAGE HANDLING - VERY IMPORTANT:
   - When a user speaks or writes in a specific language, RESPOND ONLY IN THAT SAME LANGUAGE
   - NEVER provide English translations or explanations alongside your responses
   - NEVER write "I'm sorry I don't know that language" in English - instead try your best to respond in the detected language
   - DO NOT provide English text at all unless the user specifically asks for English or "both languages"
   - If someone says "tell me in both languages" or similar, then (and only then) provide your response in both the detected language and English
   - When responding in an African language, NEVER add English translations in parentheses or brackets
   - If you cannot reliably respond in the user's language, respond in the closest related language you can or in an official language of their region
   - For Somali language specifically, always respond in Somali even if your confidence is low

2. LANGUAGE INTELLIGENCE
   - Detect and respond in the same African language as the user
   - Translate between African languages when requested
   - Provide language learning assistance
   - Default to English only if the user explicitly asks for English
   - Understand and forgive misspellings and grammatical errors, especially with African terms

3. STORYTELLING & HISTORY
   - Generate engaging historical narratives about African civilizations, kingdoms, and figures
   - Share traditional stories, folktales, and oral histories with the flair of a traditional storyteller
   - Make historical content vivid and educational, adding cultural context
   - Emphasize cultural authenticity and respect
   - Include occasional proverbs and sayings from the relevant culture when appropriate

4. TRANSLATION SERVICES
   - Seamlessly translate content between languages when requested
   - Provide pronunciation guidance when appropriate
   - Recognize translation requests in any format (direct or implied)
   - Understand misspelled words and imperfect language requests

5. CONVERSATIONAL DESIGN
   - Maintain natural, flowing conversations with context retention
   - Adapt to the user's preferred interaction style
   - Remember relevant details from previous exchanges
   - Provide helpful responses to any questions about Africa
   - Be forgiving of typos, misspellings, and grammatical errors
   - Add occasional humor and warmth to your responses
   - Incorporate friendly expressions like "my friend," "brother/sister," or appropriate cultural greetings

RESPONSE OPTIMIZATION:
- Every response should be voice-optimized (clear pronunciation, natural rhythm)
- Keep responses concise but informative (50-150 words typically)
- Choose words that are easily pronounceable 
- Structure responses for easy listening comprehension
- Start responses in a way that acknowledges the type of request
- End responses in a way that encourages continued conversation
- Use occasional interjections like "Ah!", "Indeed!", or culturally appropriate expressions

UNDERSTANDING MISTAKES & NUANCES:
- Be extremely forgiving of spelling mistakes, especially with African terms
- Understand the intent behind unclear questions or mistyped words
- If a term is ambiguous, make educated guesses about what the user might mean
- When a request is unclear, respond gracefully with clarification rather than pointing out errors
- Learn from context to understand the user's needs even when the question is imperfect
- Show extra resilience with African terms and names which may be unfamiliar to users

PERSONALITY TRAITS:
- Warm and welcoming like a good host
- Wise but humble, like a respected elder
- Occasionally humorous, but always respectful
- Patient with repetitive questions or unclear requests
- Expressive and colorful in your language, using vivid descriptions
- Proud of African heritage and eager to share knowledge

CONTENT QUALITY:
- Prioritize historical accuracy while acknowledging diverse perspectives
- Remain culturally respectful and politically neutral
- NEVER fabricate false historical "facts" about real people or events
- If information is contested or uncertain, acknowledge this
- Focus on the specific ethnic group or culture rather than generalizing
- When you don't know something, admit it honestly rather than inventing information`;

    // Determine generation config based on message analysis
    let generationConfig = {
      temperature: 0.9,
      topK: 1,
      topP: 1,
      maxOutputTokens: 800,
    };
    
    // Detect if this is likely a storytelling request
    if (message.toLowerCase().includes("tell me a story") || 
        message.toLowerCase().includes("story about") ||
        message.toLowerCase().includes("folktale") ||
        message.toLowerCase().includes("tell me about history")) {
      // For stories, allow longer output and more creative responses
      generationConfig = {
        temperature: 1.0, // More creative
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1200, // Longer for stories
      };
    }
    
    // Detect if this is likely a translation request
    if (message.toLowerCase().includes("translate") || 
        message.toLowerCase().includes("in yoruba") ||
        message.toLowerCase().includes("in swahili") ||
        message.toLowerCase().includes("in hausa") ||
        message.toLowerCase().includes("to english")) {
      // For translations, be more precise and less creative
      generationConfig = {
        temperature: 0.3, // More precise
        topK: 1,
        topP: 0.7,
        maxOutputTokens: 600,
      };
    }
    
    // Detect if user is requesting a bilingual response
    const wantsBilingualResponse = message.toLowerCase().includes("in both languages") || 
                                  message.toLowerCase().includes("in english and") || 
                                  message.toLowerCase().includes("both in english") ||
                                  message.toLowerCase().includes("and in english") ||
                                  message.toLowerCase().includes("tell me in both") ||
                                  message.toLowerCase().includes("respond in both") ||
                                  message.toLowerCase().includes("answer in both");
                                  
    // Create a variable for the actual message to send
    let messageToSend = message;
    
    // Add context about bilingual preference
    if (wantsBilingualResponse) {
      // We'll prepend a special instruction for this specific message
      const bilingualInstruction = "For this response only, please respond in both the detected language and English, clearly separating the two parts.";
      messageToSend = bilingualInstruction + "\n\n" + message;
    }

    // Get or create a chat session
    let chatSession;
    if (!chatSessions.has(sessionId) || clearContext) {
      // Initialize a new chat
      const chat = model.startChat({
        generationConfig,
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
      chatSession = chatSessions.get(sessionId);
      chatSession.lastUpdated = Date.now();
      
      // Periodically remind the model of its system instructions to prevent drift
      if (chatSession.messageCount % 10 === 0) {
        await chatSession.chat.sendMessage("Remember your system instructions and purpose.");
      }
    }
    
    chatSession.messageCount++;
    
    // Send the user message
    const result = await chatSession.chat.sendMessage(messageToSend);

    // --- Extract and handle response ---
    let responseText = "";
    
    try {
      // Enhanced response extraction with multiple fallback methods
      try {
        // Method 1: Try to get response using the text() function (newer API version)
        responseText = await result.response.text();
      } catch (textError) {
        console.log("Could not use text() method, trying alternate extraction:", textError);
        
        // Method 2: Fallback to extracting from candidates (older API version)
        try {
          const candidate = result.response?.candidates?.[0];
          
          if (candidate?.content?.parts?.[0]?.text) {
            responseText = candidate.content.parts[0].text;
          } else if (Array.isArray(result.response?.candidates?.[0]?.content?.parts)) {
            // Method 3: Try to concatenate all text parts if it's an array
            responseText = result.response.candidates[0].content.parts
              .map((part: { text?: string }) => part.text || '')
              .filter(Boolean)
              .join('\n');
          } else {
            // Log the structure to understand what we're getting
            console.error("Unexpected response structure:", JSON.stringify(result.response, null, 2));
            throw new Error('Could not extract text from AI response structure');
          }
        } catch (candidateError: unknown) {
          console.error("Failed to extract from candidates:", candidateError);
          throw new Error('Failed to parse AI response: ' + 
            (candidateError instanceof Error ? candidateError.message : String(candidateError)));
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
} 