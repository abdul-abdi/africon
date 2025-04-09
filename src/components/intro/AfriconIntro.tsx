"use client";

import { Button } from '@/components/ui/button';
import { ArrowDown, Globe, MessageSquare } from 'lucide-react';
import AfricanArtGallery from './AfricanArtGallery';
import AnimatedContainer from '@/components/ui/animated-container';
import { motion } from 'framer-motion';

interface AfriconIntroProps {
  onStartChat: () => void;  // Function to scroll to chat section
  onActivateVoice: () => void; // Function to activate voice mode
}

export default function AfriconIntro({ onStartChat, onActivateVoice }: AfriconIntroProps) {
  // Create patterns for background
  const patternStyle = {
    backgroundImage: "radial-gradient(circle, #E94822 10%, transparent 11%), radial-gradient(circle at bottom left, #F2A922 5%, transparent 6%), radial-gradient(circle at bottom right, #461111 5%, transparent 6%), radial-gradient(circle at top left, #0A7029 5%, transparent 6%)",
    backgroundSize: "7em 7em",
    backgroundPosition: "0 0, 1em 1em, 2em 2em, 3em 3em",
    backgroundColor: "#F7F3E3",
    opacity: 0.1,
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center relative overflow-hidden pb-20">
      {/* Pattern background overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-0"
        style={patternStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
        transition={{ duration: 1.5 }}
      />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 pt-16 md:pt-24">
        {/* Hero section */}
        <AnimatedContainer
          variant="fadeIn"
          className="text-center mb-16 relative"
          duration={0.8}
        >
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#F2A922]/10 rounded-full blur-3xl -z-10"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <AnimatedContainer variant="slideDown" delay={0.2} duration={0.7}>
            <h1 className="text-4xl md:text-6xl font-bold text-[#461111] mb-6">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#E94822] to-[#F2A922]">Africon</span>
            </h1>
          </AnimatedContainer>

          <AnimatedContainer variant="slideUp" delay={0.4} duration={0.7}>
            <p className="text-xl md:text-2xl text-[#0A7029] font-medium mb-8">Your Gateway to African Languages, Culture & History</p>
          </AnimatedContainer>

          <AnimatedContainer variant="fadeIn" delay={0.6} duration={0.8}>
            <p className="text-[#461111]/80 max-w-2xl mx-auto mb-12 text-lg">
              Africon is an AI assistant specialized in African languages, cultures, and history.
              Speak or type in any language, ask questions, request translations, or hear stories
              from across the African continent.
            </p>
          </AnimatedContainer>

          <AnimatedContainer variant="scale" delay={0.8} duration={0.6}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={onStartChat}
                  size="lg"
                  className="bg-[#0A7029] hover:bg-[#0A7029]/90 text-white"
                >
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Start Chatting
                </Button>
              </motion.div>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={onActivateVoice}
                  size="lg"
                  variant="outline"
                  className="border-[#E94822] text-[#E94822] hover:bg-[#E94822]/10"
                >
                  <Globe className="mr-2 h-5 w-5" />
                  Speak in Any African Language
                </Button>
              </motion.div>
            </div>
          </AnimatedContainer>
        </AnimatedContainer>

        {/* Features section */}
        <AnimatedContainer variant="fadeIn" delay={0.3} duration={0.8} className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-[#461111] mb-8 text-center">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <AnimatedContainer variant="slideUp" delay={0.4} duration={0.7}>
              <motion.div
                className="bg-white rounded-xl p-6 shadow-lg border border-[#F2A922]/20"
                whileHover={{ y: -5, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
              >
                <motion.div
                  className="w-12 h-12 bg-[#E94822]/10 rounded-lg flex items-center justify-center mb-4"
                  whileHover={{ rotate: 10, scale: 1.1 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E94822" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                </motion.div>
                <h3 className="text-xl font-bold text-[#461111] mb-2">Multilingual Communication</h3>
                <p className="text-[#461111]/70">
                  Speak or type in any African language. Africon can detect and respond in Swahili, Yoruba, Hausa, Amharic, Zulu, and many more languages from across the continent.
                </p>
              </motion.div>
            </AnimatedContainer>

            {/* Feature 2 */}
            <AnimatedContainer variant="slideUp" delay={0.6} duration={0.7}>
              <motion.div
                className="bg-white rounded-xl p-6 shadow-lg border border-[#F2A922]/20"
                whileHover={{ y: -5, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
              >
                <motion.div
                  className="w-12 h-12 bg-[#0A7029]/10 rounded-lg flex items-center justify-center mb-4"
                  whileHover={{ rotate: 10, scale: 1.1 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A7029" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2s2-.9 2-2v-4c0-1.1-.9-2-2-2z"/><path d="m8 10 2-2m4-4 2-2m-8 6-2-2m12 2 2-2"/></svg>
                </motion.div>
                <h3 className="text-xl font-bold text-[#461111] mb-2">Cultural Storytelling</h3>
                <p className="text-[#461111]/70">
                  Explore rich stories, folktales, and historical narratives from different African cultures, presented with the flair of a traditional griot. Learn about heroes, myths, and legends.
                </p>
              </motion.div>
            </AnimatedContainer>

            {/* Feature 3 */}
            <AnimatedContainer variant="slideUp" delay={0.8} duration={0.7}>
              <motion.div
                className="bg-white rounded-xl p-6 shadow-lg border border-[#F2A922]/20"
                whileHover={{ y: -5, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
              >
                <motion.div
                  className="w-12 h-12 bg-[#F2A922]/10 rounded-lg flex items-center justify-center mb-4"
                  whileHover={{ rotate: 10, scale: 1.1 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F2A922" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                </motion.div>
                <h3 className="text-xl font-bold text-[#461111] mb-2">Translation & Learning</h3>
                <p className="text-[#461111]/70">
                  Get instant translations between African languages and English, or learn about linguistic features and cultural contexts. Discover the rich diversity of African languages.
                </p>
              </motion.div>
            </AnimatedContainer>
          </div>
        </AnimatedContainer>

        {/* Art gallery section */}
        <AnimatedContainer variant="fadeIn" delay={0.5} duration={0.8} className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-[#461111] mb-8 text-center">African Art & Heritage</h2>
          <p className="text-[#461111]/70 text-center max-w-3xl mx-auto mb-8">
            African art is renowned for its vibrant colors, intricate patterns, and deep cultural significance.
            From traditional masks used in ceremonies to sculptures that tell stories of ancestors and deities,
            each piece represents centuries of heritage and craftsmanship.
          </p>
          <AfricanArtGallery />
        </AnimatedContainer>

        {/* Call to action */}
        <AnimatedContainer variant="bounce" delay={1} duration={0.8} className="text-center mt-12">
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={onStartChat}
              size="lg"
              variant="outline"
              className="rounded-full border-[#461111]/20 hover:bg-[#461111]/5 text-[#461111]"
            >
              <ArrowDown className="mr-2 h-5 w-5" />
              Start Your Journey
            </Button>
          </motion.div>
        </AnimatedContainer>
      </div>
    </div>
  );
}