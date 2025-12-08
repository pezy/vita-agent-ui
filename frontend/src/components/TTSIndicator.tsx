import React from 'react';
import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';

interface TTSIndicatorProps {
    isSpeaking: boolean;
}

export const TTSIndicator: React.FC<TTSIndicatorProps> = ({ isSpeaking }) => {
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <motion.div
                className={`
                    flex items-center gap-4 pl-4 pr-5 py-3 
                    rounded-full shadow-lg border border-white/20 backdrop-blur-md
                    transition-colors duration-300
                    ${isSpeaking ? 'bg-black/80 text-white' : 'bg-white/90 text-gray-500 border-gray-200'}
                `}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <div className="flex items-center gap-2">
                    <Volume2 size={16} className={isSpeaking ? "text-blue-400" : "text-gray-400"} />
                    <span className="text-xs font-semibold tracking-wide">
                        {isSpeaking ? "AI SPEAKING" : "AI READY"}
                    </span>
                </div>

                {/* Wave Visualization */}
                <div className="flex items-center gap-[3px] h-8">
                    {[...Array(8)].map((_, i) => (
                        <motion.div
                            key={i}
                            className={`w-1.5 rounded-full ${isSpeaking ? 'bg-blue-400' : 'bg-gray-300/50'}`}
                            initial={{ height: 4 }}
                            animate={{
                                height: isSpeaking ? [12, 24, 16, 30, 12] : 4,
                            }}
                            transition={{
                                duration: 1, // Slightly faster to feel responsive but smooth
                                repeat: Infinity,
                                repeatType: "mirror", // Mirror makes it smoother than loop
                                delay: i * 0.08,
                                ease: "easeInOut",
                            }}
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};
