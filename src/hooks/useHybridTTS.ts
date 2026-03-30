import { logger } from '@/lib/logger';
import { useCallback, useState } from 'react';
import { useTextToSpeech as useBrowserTTS } from './useTextToSpeech';

export type TTSProvider = 'browser' | 'auto';

interface UseHybridTTSOptions {
    provider?: TTSProvider;
}

export interface UseHybridTTSReturn {
    speak: (text: string) => Promise<void>;
    stop: () => void;
    pause: () => void;
    resume: () => void;
    setRate: (rate: number) => void;
    seek: (progress: number) => void;
    isSpeaking: boolean;
    isPaused: boolean;
    isLoading: boolean;
    progress: number;
    error: string | null;
    provider: TTSProvider;
    setProvider: (provider: TTSProvider) => void;
    availableProviders: TTSProvider[];
}

/**
 * Hybrid Text-to-Speech Hook (Simplified)
 * 
 * Now only uses browser TTS since YarnGPT was removed.
 */
export function useHybridTTS(options: UseHybridTTSOptions = {}): UseHybridTTSReturn {
    const [provider, setProvider] = useState<TTSProvider>(options.provider || 'auto');
    const [error, setError] = useState<string | null>(null);

    const browserTTS = useBrowserTTS();

    const speak = useCallback(async (text: string) => {
        setError(null);
        try {
            logger.info('Using Browser TTS');
            browserTTS.speak(text);
        } catch (err: any) {
            const errorMsg = err.message || 'Text-to-speech failed';
            logger.error('TTS error:', errorMsg);
            setError(errorMsg);
        }
    }, [browserTTS]);

    const stop = useCallback(() => {
        browserTTS.stop();
        setError(null);
    }, [browserTTS]);

    const pause = useCallback(() => {
        browserTTS.pause();
    }, [browserTTS]);

    const resume = useCallback(() => {
        browserTTS.resume();
    }, [browserTTS]);

    const setRate = useCallback((rate: number) => {
        browserTTS.setRate(rate);
    }, [browserTTS]);

    const seek = useCallback((p: number) => {
        browserTTS.seek(p);
    }, [browserTTS]);

    const isSpeaking = browserTTS.isSpeaking;
    const isPaused = browserTTS.isPaused;
    const isLoading = false;
    const progress = browserTTS.progress;

    return {
        speak,
        stop,
        pause,
        resume,
        setRate,
        seek,
        isSpeaking,
        isPaused,
        isLoading,
        progress,
        error: error,
        provider,
        setProvider,
        availableProviders: ['auto', 'browser'],
    };
}
