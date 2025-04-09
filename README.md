![Africon Screenshot](https://raw.githubusercontent.com/abdul-abdi/africon/refs/heads/main/public/africon-favicon.ico)
# Africon - African Languages AI Voice Assistant

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_GITHUB_USERNAME%2Fafricon&env=GEMINI_API_KEY&envDescription=Your%20Google%20Gemini%20API%20Key&project-name=africon&repository-name=africon)

Africon is a modern, voice-first AI assistant built with Next.js and Google's Gemini AI. It's designed to understand, interact with, and promote African languages and cultures. Users can speak naturally in various languages, and Africon will detect the language, respond intelligently, and speak the answer back in the same language.

## ✨ Features

*   **Voice-First Interaction**: Optimized for seamless voice commands and responses using the Web Speech API.
*   **Multilingual Understanding & Response**: Leverages Google Gemini to detect the spoken language (with a focus on African languages) and generate responses in the *same* language.
*   **Real-time Speech Recognition**: Captures user voice input directly in the browser.
*   **Natural Text-to-Speech**: Synthesizes AI responses into natural-sounding speech using the Web Speech API, matching the detected language where possible.
*   **Intelligent Conversation**: Maintains conversation context within a session using Google Gemini's chat capabilities.
*   **Fallback Text Input**: Supports traditional text-based chat for users who prefer typing or when voice input is unavailable.
*   **Interactive UI**: Features a modern interface with `shadcn/ui`, visual feedback for listening/speaking states, and potentially engaging elements like a globe or background animations (depending on component implementation).
*   **Session Management**: Keeps track of conversation history within a user session.
*   **Rate Limiting**: Basic protection against API overuse implemented on the backend.
*   **Error Handling & Fallbacks**: Includes mechanisms to handle potential issues with Web Speech APIs (e.g., browser compatibility, permissions, network errors) and API errors (retries, rate limits).
*   **Responsive Design**: Built to work across different screen sizes.

## 🛠️ Technology Stack

*   **Framework**: [Next.js](https://nextjs.org/) (App Router)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **UI Library**: [React](https://react.dev/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
*   **AI Model**: [Google Gemini API](https://ai.google.dev/) (`gemini-1.5-flash`)
*   **Voice APIs**: [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) (SpeechRecognition & SpeechSynthesis)
*   **Deployment**: [Vercel](https://vercel.com/) (Recommended)

_(Potentially add: [Three.js](https://threejs.org/), [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction), [@react-three/drei](https://github.com/pmndrs/drei) if used for globe/visuals)_

## 🏗️ Architecture

*   **Frontend**:
    *   Built with Next.js App Router (`src/app`).
    *   Main application logic resides in `src/app/page.tsx`, handling state management (React Hooks: `useState`, `useRef`, `useEffect`, `useCallback`), user interactions, and coordinating speech recognition/synthesis.
    *   Reusable UI components are organized in `src/components/`.
        *   `chat/`: Components for displaying the chat history and input.
        *   `globe/`: Components related to voice mode visualization (like `VoiceMode`).
        *   `background/`: Components for visual flair (like `FloatingAfricanArt`).
        *   `intro/`: Components for the initial welcome/introduction screen.
        *   `ui/`: Base UI elements from `shadcn/ui`.
    *   Utility functions and custom event dispatchers are in `src/lib/`.
*   **Backend**:
    *   A Next.js API Route (`src/app/api/chat/route.ts`) handles communication with the Google Gemini API.
    *   Manages chat sessions to maintain conversation history.
    *   Performs language detection using Gemini.
    *   Includes retry logic for API requests.
    *   Implements basic API rate limiting (per minute and per day).
*   **State Management**: Primarily uses React's built-in hooks (`useState`, `useRef`, `useCallback`, `useEffect`) within the main page component. Custom events (`src/lib/events.ts`) might be used for cross-component communication.
*   **Styling**: Uses Tailwind CSS for utility-first styling, configured in `tailwind.config.ts` and `postcss.config.mjs`.

## 🚀 Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (Version 18 or later recommended)
*   [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/), or [pnpm](https://pnpm.io/)
*   A modern web browser that supports the [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API#browser_compatibility) (Chrome is recommended for best compatibility).
*   Microphone access granted in the browser.
*   A Google Gemini API Key.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/YOUR_GITHUB_USERNAME/africon.git
    cd africon
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

3.  **Set up environment variables:**
    Create a file named `.env.local` in the root of the project and add your Google Gemini API key:
    ```env
    GEMINI_API_KEY=YOUR_API_KEY_HERE
    ```
    You can get an API key from the [Google AI Studio](https://aistudio.google.com/app/apikey).

4.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```

5.  **Open the application:**
    Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 Environment Variables

*   `GEMINI_API_KEY`: **Required**. Your API key for accessing the Google Gemini API.

## 🌐 Browser Compatibility

The core voice features rely heavily on the Web Speech API (`SpeechRecognition` and `SpeechSynthesis`). Browser support can vary:

*   **Chrome (Desktop & Android)**: Generally offers the best support for both recognition and synthesis.
*   **Safari (macOS & iOS)**: Has known limitations and inconsistencies, especially with `SpeechSynthesis`. The application includes workarounds (like audio context initialization), but issues may still occur.
*   **Firefox**: Supports `SpeechSynthesis` but may require enabling flags or have limited support for `SpeechRecognition`.
*   **Edge**: Based on Chromium, so generally similar compatibility to Chrome.

Always test in your target browsers. Text input provides a fallback for environments where voice is not supported.

## ⚙️ API Usage & Rate Limiting

*   This application uses the Google Gemini API, which is subject to usage quotas and pricing. Refer to the [Gemini API pricing page](https://ai.google.dev/pricing) for details.
*   The backend includes basic rate limiting (`REQUESTS_PER_MINUTE`, `REQUESTS_PER_DAY` in `src/app/api/chat/route.ts`) to prevent accidental overuse. You may need to adjust these limits based on your Gemini plan and expected traffic.
