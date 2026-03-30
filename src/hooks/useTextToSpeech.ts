import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTextToSpeechReturn {
    speak: (text: string) => void;
    stop: () => void;
    pause: () => void;
    resume: () => void;
    setRate: (rate: number) => void;
    seek: (progress: number) => void;
    isSpeaking: boolean;
    isPaused: boolean;
    progress: number;
    isSupported: boolean;
    voices: SpeechSynthesisVoice[];
    selectedVoice: SpeechSynthesisVoice | null;
    setSelectedVoice: (voice: SpeechSynthesisVoice) => void;
}

export function useTextToSpeech(): UseTextToSpeechReturn {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

    // Load available voices
    useEffect(() => {
        if (!isSupported) return;

        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            setVoices(availableVoices);

            // Set default voice (prefer English)
            if (!selectedVoice && availableVoices.length > 0) {
                const englishVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
                setSelectedVoice(englishVoice);
            }
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, [isSupported, selectedVoice]);

    const speak = useCallback((text: string) => {
        if (!isSupported) {
            console.warn('Text-to-speech is not supported in this browser');
            return;
        }

        // Stop any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.rate = playbackRate;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => {
            setIsSpeaking(true);
            setIsPaused(false);
            setProgress(0);
        };

        // Browser TTS doesn't give us granular progress, so we mock it.
        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                setProgress((prev) => Math.min(prev + 0.05, 0.95)); // rough estimate
            }
        };

        utterance.onend = () => {
            setIsSpeaking(false);
            setIsPaused(false);
            setProgress(1);
        };

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            setIsSpeaking(false);
            setIsPaused(false);
        };

        utteranceRef.current = utterance;

        try {
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Speech synthesis play error (browser policy):', error);
            setIsSpeaking(false);
        }
    }, [isSupported, selectedVoice]);

    const stop = useCallback(() => {
        if (isSupported) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            setIsPaused(false);
            setProgress(0);
        }
    }, [isSupported]);

    const pause = useCallback(() => {
        if (isSupported && isSpeaking && !isPaused) {
            window.speechSynthesis.pause();
            setIsPaused(true);
        }
    }, [isSupported, isSpeaking, isPaused]);

    const resume = useCallback(() => {
        if (isSupported && isPaused) {
            window.speechSynthesis.resume();
            setIsPaused(false);
        }
    }, [isSupported, isPaused]);

    const setRate = useCallback((rate: number) => {
        setPlaybackRate(rate);
        // Browser SpeechSynthesisUtterance rate cannot be changed on the fly reliably without canceling
        // But we store it for the next utterance.
    }, []);

    const seek = useCallback((p: number) => {
        // Not natively supported by SpeechSynthesis, mock local progress
        setProgress(p);
    }, []);

    return {
        speak,
        stop,
        pause,
        resume,
        setRate,
        seek,
        isSpeaking,
        isPaused,
        progress,
        isSupported,
        voices,
        selectedVoice,
        setSelectedVoice
    };
}
