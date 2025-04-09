"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingItem {
  id: number;
  imageUrl: string;
  size: number;
  position: { x: number; y: number };
  speed: { x: number; y: number };
  rotation: number;
  rotationSpeed: number;
  description: string;
  origin: string;
  showInfo: boolean;
}

interface FloatingAfricanArtProps {
  className?: string;
}

// Collection of African art images with descriptions (all from Wikimedia Commons, freely licensed)
const AFRICAN_ART_COLLECTION = [
  {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/62/Masques_BaKongo.JPG",
    description: "BaKongo Masks",
    origin: "Democratic Republic of Congo"
  },
  {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/77/Mask_1.11.jpg",
    description: "Traditional Ceremonial Mask",
    origin: "West Africa"
  },
  {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/37/MC1555.masque.hemba.mask.14b.jpg",
    description: "Hemba Mask",
    origin: "Democratic Republic of Congo"
  },
  {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c0/Lega_Maske_Linden-Museum_F53449L.jpg",
    description: "Lega Mask",
    origin: "Eastern Congo"
  },
  {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/75/Anthropomorphic_bronze_head_in_the_Ife_style%3B_probably_made_around_1900_as_a_cast_of_a_much_older_figure%3B_Line_tattoo_on_face%3B_Private_collection_in_Northern_Germany%3B.jpg",
    description: "Anthropomorphic Bronze Head in Ife Style",
    origin: "Nigeria"
  },
  {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fe/Makonde_sculpture_half_figure_01.jpg",
    description: "Makonde Half Figure Sculpture",
    origin: "Tanzania/Mozambique"
  },
  {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Makonde_sculpture_Shetani_01.jpg",
    description: "Makonde Shetani Sculpture",
    origin: "Tanzania/Mozambique"
  },
  {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0e/Makonde_sculpture_Ujamaa.jpg",
    description: "Makonde Ujamaa Sculpture",
    origin: "Tanzania/Mozambique"
  },
  {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Wooden_statue_showing_childbirth%2C_Angola%2C_1801-1900_Wellcome_L0058714.jpg/800px-Wooden_statue_showing_childbirth%2C_Angola%2C_1801-1900_Wellcome_L0058714.jpg",
    description: "Wooden Statue Showing Childbirth",
    origin: "Angola, 19th Century"
  },
  {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Mask_of_Banda_secret_society_of_Simo%2C_Baga_people%2C_Guinea%2C_01.jpg/800px-Mask_of_Banda_secret_society_of_Simo%2C_Baga_people%2C_Guinea%2C_01.jpg",
    description: "Mask of Banda Secret Society of Simo",
    origin: "Baga People, Guinea"
  },
  {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Masque-cimier_Nalu-Guin%C3%A9e-Pavillon_des_Sessions_%282%29.jpg/800px-Masque-cimier_Nalu-Guin%C3%A9e-Pavillon_des_Sessions_%282%29.jpg",
    description: "Nalu Headdress Mask",
    origin: "Guinea"
  },
  {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Mus%C3%A9e_royal_d%27Afrique_centrale_-_Tshihongo%2C_masque_de_danse_tshokwe_en_r%C3%A9sine.JPG/800px-Mus%C3%A9e_royal_d%27Afrique_centrale_-_Tshihongo%2C_masque_de_danse_tshokwe_en_r%C3%A9sine.JPG",
    description: "Tshihongo Dance Mask",
    origin: "Tshokwe People, Angola"
  }
];

export default function FloatingAfricanArt({ className = '' }: FloatingAfricanArtProps) {
  const [floatingItems, setFloatingItems] = useState<FloatingItem[]>([]);

  // Toggle info display for an item
  const toggleItemInfo = (id: number) => {
    setFloatingItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, showInfo: !item.showInfo } : item
      )
    );
  };

  useEffect(() => {
    // Create initial floating items
    const items: FloatingItem[] = [];
    const itemCount = Math.min(10, AFRICAN_ART_COLLECTION.length); // Number of floating items

    for (let i = 0; i < itemCount; i++) {
      const artItem = AFRICAN_ART_COLLECTION[i % AFRICAN_ART_COLLECTION.length];
      items.push({
        id: i,
        imageUrl: artItem.imageUrl,
        description: artItem.description,
        origin: artItem.origin,
        size: Math.random() * 60 + 80, // Random size between 80-140px (larger for better visibility)
        position: {
          x: Math.random() * 100, // Random position (0-100%)
          y: Math.random() * 100,
        },
        speed: {
          x: (Math.random() - 0.5) * 0.03, // Slower speed for smoother motion
          y: (Math.random() - 0.5) * 0.03,
        },
        rotation: Math.random() * 360, // Random initial rotation
        rotationSpeed: (Math.random() - 0.5) * 0.05, // Slower rotation for smoother motion
        showInfo: false, // Initially hide info
      });
    }

    setFloatingItems(items);
  }, []);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <AnimatePresence>
        {floatingItems.map(item => (
          <motion.div
            key={item.id}
            className="absolute rounded-lg shadow-md cursor-pointer"
            style={{
              width: `${item.size}px`,
              height: `${item.size}px`,
              left: `${item.position.x}%`,
              top: `${item.position.y}%`,
              zIndex: 0,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: 0.8,
              scale: 1,
              x: '-50%',
              y: '-50%',
              rotate: item.rotation,
            }}
            transition={{
              type: 'spring',
              damping: 15,
              stiffness: 50,
              opacity: { duration: 1 },
              rotate: {
                duration: 20 + Math.random() * 20, // Slow rotation between 20-40 seconds
                repeat: Infinity,
                ease: 'linear',
              },
            }}
            drag // Make items draggable
            dragConstraints={{
              top: -200,
              left: -200,
              right: 200,
              bottom: 200,
            }}
            whileHover={{ scale: 1.1, opacity: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => toggleItemInfo(item.id)}
          >
            <Image
              src={item.imageUrl}
              alt={item.description}
              className="w-full h-full object-contain rounded-lg"
              width={item.size}
              height={item.size}
              unoptimized // Using unoptimized for external URLs
            />

            {/* Information overlay */}
            <AnimatePresence>
              {item.showInfo && (
                <motion.div
                  className="absolute inset-0 bg-black/70 rounded-lg flex flex-col justify-center items-center p-2 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <h3 className="text-white font-bold text-sm">{item.description}</h3>
                  <p className="text-white/80 text-xs mt-1">{item.origin}</p>
                  <p className="text-white/60 text-xs mt-2">Click to close</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
