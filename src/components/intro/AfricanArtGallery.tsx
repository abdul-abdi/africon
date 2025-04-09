"use client";

import { useState } from 'react';
import AfricanArtPlaceholder from './AfricanArtPlaceholder';

// Collection of authentic African art pieces with descriptions
const artCollection = [
  {
    id: 1,
    title: "Adinkra Symbol Art",
    origin: "Ghana",
    imageUrl: "/art/adinkra.jpg",
    description: "Adinkra symbols represent concepts or aphorisms, originating from the Akan people of Ghana.",
    colorStart: "#E94822",
    colorEnd: "#F2A922",
    pattern: "geometric" as const
  },
  {
    id: 2,
    title: "Maasai Beadwork",
    origin: "Kenya/Tanzania",
    imageUrl: "/art/maasai.jpg",
    description: "Colorful beaded jewelry and decorations created by the Maasai people, expressing cultural identity.",
    colorStart: "#F2A922",
    colorEnd: "#0A7029",
    pattern: "dots" as const
  },
  {
    id: 3,
    title: "Ndebele House Painting",
    origin: "South Africa",
    imageUrl: "/art/ndebele.jpg",
    description: "Geometric patterns painted on houses by Ndebele women, showcasing cultural heritage.",
    colorStart: "#0A7029",
    colorEnd: "#461111",
    pattern: "lines" as const
  },
  {
    id: 4,
    title: "Tingatinga Painting",
    origin: "Tanzania",
    imageUrl: "/art/tingatinga.jpg",
    description: "Vibrant art style named after Edward Saidi Tingatinga, depicting African wildlife and daily life.",
    colorStart: "#461111",
    colorEnd: "#E94822",
    pattern: "waves" as const
  },
  {
    id: 5,
    title: "Kente Cloth",
    origin: "Ghana",
    imageUrl: "/art/kente.jpg",
    description: "Intricately woven textile with symbolic patterns, originating from the Akan people.",
    colorStart: "#F2A922",
    colorEnd: "#461111",
    pattern: "geometric" as const
  },
  {
    id: 6,
    title: "Benin Bronze",
    origin: "Nigeria",
    imageUrl: "/art/benin.jpg",
    description: "Detailed bronze sculptures from the historical Kingdom of Benin, showing court life and ceremonies.",
    colorStart: "#0A7029",
    colorEnd: "#F2A922",
    pattern: "dots" as const
  }
];

export default function AfricanArtGallery() {
  const [activeArt, setActiveArt] = useState<number | null>(null);
  
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {artCollection.map((art) => (
          <div 
            key={art.id} 
            className="bg-white rounded-xl overflow-hidden shadow-lg border border-[#F2A922]/20 hover:shadow-xl transition-all duration-300 group cursor-pointer"
            onClick={() => setActiveArt(activeArt === art.id ? null : art.id)}
          >
            <div className="relative h-48 overflow-hidden">
              <AfricanArtPlaceholder 
                title={art.title}
                colorStart={art.colorStart}
                colorEnd={art.colorEnd}
                pattern={art.pattern}
              />
              
              <div className="absolute inset-0 bg-[#461111] opacity-0 group-hover:opacity-30 transition-opacity z-10"></div>
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#461111]/70 to-transparent text-white transform translate-y-2 group-hover:translate-y-0 transition-transform z-20">
                <h3 className="font-bold text-sm">{art.title}</h3>
                <p className="text-xs opacity-90">{art.origin}</p>
              </div>
            </div>
            
            <div className={`p-4 bg-white transition-all duration-300 ${activeArt === art.id ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0 hidden'}`}>
              <p className="text-[#461111]/70 text-sm">{art.description}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-[#461111]/60 italic">
          Click on any art piece to learn more about its cultural significance.
        </p>
      </div>
    </div>
  );
} 