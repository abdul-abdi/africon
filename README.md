This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Africon - African Languages Voice Assistant

Africon is a voice-first AI assistant designed to preserve and promote African languages and culture. Built with Next.js, React, and Google's Gemini AI, this application allows users to speak in various African languages and receive spoken responses in the same language.

## Features

- **Voice-First Interface**: Optimized for voice interactions with a prominent microphone button
- **Multilingual Support**: Detects and responds in various African languages
- **Real-Time Speech Recognition**: Uses Web Speech API for voice input
- **Natural Voice Responses**: Synthesizes AI responses into spoken words
- **Fallback Text Interface**: Also supports traditional text chat when needed

## Technology Stack

- **Frontend**: Next.js, React, shadcn/ui components
- **AI**: Google Gemini 2.5 Pro API
- **Voice**: Web Speech API (SpeechRecognition and SpeechSynthesis)

## Usage

1. Click the "Tap to Speak" button to start voice recognition
2. Speak in any African language
3. The AI will detect the language and respond in the same language
4. The response will be automatically spoken aloud

## Requirements

- Modern browser with Web Speech API support (Chrome recommended)
- Microphone access permission
- API key for Google Gemini (set as GEMINI_API_KEY environment variable)

## Getting Started

First, set up your environment variable:

```bash
# Create a .env.local file with your Gemini API key
echo "GEMINI_API_KEY=your_api_key_here" > .env.local
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.
