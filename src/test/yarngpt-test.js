/**
 * Quick YarnGPT Test Script
 * 
 * Run this in the browser console to test YarnGPT integration
 * 
 * Usage:
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Run: testYarnGPT()
 */

async function testYarnGPT() {
    const apiKey = 'sk_live_rErrW_ceKa3C5Ibb0yWrGXU6qK3Q_JWBv7yuizJ0A_o';
    const testText = 'Hello! This is a test of YarnGPT text-to-speech integration for Quizant.';

    console.log('🎙️ Testing YarnGPT API...');
    console.log('Text:', testText);

    try {
        const response = await fetch('https://yarngpt.ai/api/v1/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                text: testText,
                voice: 'Idera',
                response_format: 'mp3',
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API error: ${response.status}`);
        }

        console.log('✅ API Response OK');

        // Get audio blob
        const audioBlob = await response.blob();
        console.log('✅ Audio blob received:', audioBlob.size, 'bytes');

        // Create and play audio
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onplay = () => console.log('🔊 Playing audio...');
        audio.onended = () => {
            console.log('✅ Audio playback completed');
            URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = (e) => console.error('❌ Audio playback error:', e);

        await audio.play();
        console.log('✅ YarnGPT test successful!');

    } catch (error) {
        console.error('❌ YarnGPT test failed:', error);
    }
}

// Auto-run test
console.log('YarnGPT test script loaded. Run: testYarnGPT()');
