"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
// THREE is imported by react-globe.gl, removing explicit import
// import * as THREE from 'three';

// Dynamically import the GlobeGL component with SSR disabled
const GlobeGL = dynamic(() => import('react-globe.gl'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-40 h-40 rounded-full bg-[#1a1a2e] border-4 border-[#F2A922]/60 animate-pulse flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/earth-blue-marble.jpg')] bg-cover bg-center opacity-30"></div>
        <div className="text-[#F2A922] font-medium z-10 text-center">
          <div className="text-sm mb-1">Loading</div>
          <div className="flex gap-1 justify-center">
            <span className="animate-bounce delay-75">.</span>
            <span className="animate-bounce delay-150">.</span>
            <span className="animate-bounce delay-300">.</span>
          </div>
        </div>
      </div>
    </div>
  )
});

interface InteractiveGlobeProps {
  isListening: boolean;
  onSpeechEnd?: (text: string) => void;
  isSpeaking: boolean;
}

export default function InteractiveGlobe({ 
  isListening, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSpeechEnd,
  isSpeaking 
}: InteractiveGlobeProps) {
  // Use 'any' type for react-globe.gl compatibility
  const globeRef = useRef<any>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [globeRadius, setGlobeRadius] = useState(200);
  const [visualizerData, setVisualizerData] = useState<number[]>(Array(64).fill(0));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Update globe radius based on viewport - make globe smaller to match second image
      const sideLength = Math.min(window.innerWidth, window.innerHeight);
      const scaleFactor = window.innerWidth < 768 ? 0.2 : 0.15; // Smaller globe for mobile and desktop
      setGlobeRadius(sideLength * scaleFactor);
    };
    
    handleResize(); // Initial call
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set up globe visualization
  useEffect(() => {
    // Add a small delay to ensure the component is fully mounted
    const initTimer = setTimeout(() => {
      if (globeRef.current) {
        try {
          // Set initial globe configuration
          globeRef.current.controls().autoRotate = true;
          globeRef.current.controls().autoRotateSpeed = 0.5;
          // Set a better camera angle and zoom level to match second image
          globeRef.current.pointOfView({ lat: 5, lng: 20, altitude: 2.5 }, 1000);
          
          // Mark globe as ready
          setGlobeReady(true);
        } catch (err) {
          console.warn("Error initializing globe:", err);
          // Retry after a short delay
          setTimeout(() => {
            try {
              if (globeRef.current) {
                globeRef.current.controls().autoRotate = true;
                setGlobeReady(true);
              }
            } catch (retryErr) {
              console.error("Failed to initialize globe after retry:", retryErr);
            }
          }, 1000);
        }
      }
    }, 300);
    
    return () => clearTimeout(initTimer);
  // Only run once on component mount
  }, []);
  
  // Update globe visualization based on audio data - defined with useCallback to fix dependency issues
  const animateGlobeAudio = useCallback(() => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const updateVisualizer = () => {
      if (!analyserRef.current) return;
      
      // Get frequency data
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Normalize and update state (use only a subset of the frequency data)
      const normalizedData = Array.from(dataArray)
        .filter((_, i) => i % 2 === 0) // Sample every other value
        .slice(0, 64)
        .map(val => val / 255); // Normalize to 0-1
      
      setVisualizerData(normalizedData);
      
      // Continue animation loop if still listening
      if (isListening) {
        requestAnimationFrame(updateVisualizer);
      }
    };
    
    updateVisualizer();
  }, [isListening]);

  // Set up audio analyzer for visualization when listening
  useEffect(() => {
    if (isListening) {
      const startMicVisualization = async () => {
        try {
          // Get microphone access
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = stream;
          
          // Create audio context and analyzer
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          
          const analyser = audioContext.createAnalyser();
          analyserRef.current = analyser;
          analyser.fftSize = 128;
          
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          
          // Start visualization loop
          animateGlobeAudio();
        } catch (err) {
          console.error("Error accessing microphone:", err);
        }
      };
      
      startMicVisualization();
    } else {
      // Clean up audio resources when not listening
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (err) {
          console.warn("Error closing AudioContext:", err);
        }
        audioContextRef.current = null;
      }
      
      analyserRef.current = null;
      
      // Reset visualizer data
      setVisualizerData(Array(64).fill(0));
    }
    
    return () => {
      // Cleanup function
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (err) {
          console.warn("Error closing AudioContext:", err);
        }
        audioContextRef.current = null;
      }
    };
  }, [isListening, animateGlobeAudio]);

  // Create points for visualization
  const generatePoints = () => {
    const points = [];
    // Reduce the number of points for better performance and to match second image
    const numPoints = 800;
    
    for (let i = 0; i < numPoints; i++) {
      const lat = (Math.random() - 0.5) * 180;
      const lng = (Math.random() - 0.5) * 360;
      
      // Assign a frequency band based on position
      const bandIndex = Math.min(Math.floor(Math.abs(lat) / 2.8125), 63);
      const intensity = visualizerData[bandIndex] || 0;
      
      points.push({
        lat,
        lng,
        color: isSpeaking ? 
          `rgba(100, 150, 255, ${0.2 + intensity * 0.8})` : // Blue for speaking
          isListening ? 
          `rgba(100, 150, 255, ${0.2 + intensity * 0.8})` : // Blue for listening
          'rgba(100, 150, 255, 0.5)', // Blue for idle
        radius: isListening || isSpeaking ? 
          0.2 + intensity * 0.8 : // Smaller radius
          0.3
      });
    }
    
    return points;
  };

  // Using this for styling guidance, kept for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const africanColors = {
    primary: "#E94822", // Warm orange-red (sunset)
    secondary: "#F2A922", // Gold/amber
    tertiary: "#0A7029", // Forest green
    accent: "#461111", // Deep burgundy
    light: "#F7F3E3", // Warm cream/sand
  };

  return (
    <div className="w-full h-full flex justify-center items-center bg-gradient-to-r from-[#2a2a35] via-[#282830] to-[#2a2a35]">
      <div 
        className={`relative transition-all duration-300 flex items-center justify-center ${
          isListening || isSpeaking ? 'scale-105' : 'scale-100'
        }`}
        style={{ width: '100%', height: '100%' }}
      >
        {!globeReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-[#1a1a2e] border-2 border-[#4a89dc]/40 animate-pulse flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('/earth-blue-marble.jpg')] bg-cover bg-center opacity-50"></div>
              <div className="text-[#8ab4f8] font-medium z-10 text-center">
                <div className="text-xs mb-1">Loading</div>
                <div className="flex gap-1 justify-center">
                  <span className="animate-bounce delay-75">.</span>
                  <span className="animate-bounce delay-150">.</span>
                  <span className="animate-bounce delay-300">.</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div style={{ width: globeRadius * 2, height: globeRadius * 2 }}>
          {typeof window !== 'undefined' && (
            <GlobeGL
              ref={globeRef}
              globeImageUrl="/earth-blue-marble.jpg" 
              backgroundColor="rgba(0,0,0,0)" // Transparent background
              pointsData={generatePoints()}
              pointColor="color"
              pointRadius="radius"
              pointsMerge={true}
              pointsTransitionDuration={200}
              atmosphereColor="#4a89dc" // Match the blue color from the second image
              atmosphereAltitude={0.25} // Increase atmosphere glow
              width={globeRadius * 2}
              height={globeRadius * 2}
            />
          )}
        </div>
        
        {(isListening || isSpeaking) && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center p-2">
            <div className={`px-3 py-1 rounded-full text-xs animate-pulse flex items-center ${
              isListening ? 
                'bg-[#E94822] text-white' : 
                'bg-[#0A7029] text-white'
            }`}>
              {isListening ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                  Listening...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M12 8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2s2-.9 2-2v-4c0-1.1-.9-2-2-2z"/>
                    <path d="m8 10 2-2m4-4 2-2m-8 6-2-2m12 2 2-2"/>
                  </svg>
                  Speaking...
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 