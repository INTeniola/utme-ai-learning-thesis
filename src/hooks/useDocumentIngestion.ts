import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import mammoth from 'mammoth';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export interface ProcessedDocument {
  id?: string;
  rawText: string;
  cleanedMarkdown: string;
  knowledgeSummary: string;
  extractedFormulas: string[];
  generatedQuestions?: any[];
  concepts?: { name: string; description: string }[];
  subject?: string;
  topic?: string;
  fileUrl?: string;
  processing_status?: string;
}

export interface DocumentIngestionState {
  isProcessing: boolean;
  isAddingToKnowledgeBase: boolean;
  processedDocument: ProcessedDocument | null;
  processingStatus: 'idle' | 'analyzing' | 'vectorizing' | 'completed' | 'failed';
  error: string | null;
}

export function useDocumentIngestion() {
  const [state, setState] = useState<DocumentIngestionState>({
    isProcessing: false,
    isAddingToKnowledgeBase: false,
    processedDocument: null,
    processingStatus: 'idle',
    error: null,
  });

  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);

  // Phase 4: Async Realtime Listener
  // Listen for background worker updates (analyzing -> vectorizing -> completed)
  useEffect(() => {
    if (!currentUploadId) return;

    console.log(`[useDocumentIngestion] Subscribing to realtime updates for: ${currentUploadId}`);
    
    const channel = supabase
      .channel(`upload_status_${currentUploadId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'uploaded_content',
          filter: `id=eq.${currentUploadId}`
        },
        (payload) => {
          const newRecord = payload.new as any;
          console.log(`[Realtime Update] Status: ${newRecord.processing_status}`);
          
          if (newRecord.processing_status === 'completed') {
            setState(prev => ({
              ...prev,
              isProcessing: false,
              processingStatus: 'completed',
              processedDocument: {
                id: newRecord.id,
                rawText: newRecord.raw_text,
                cleanedMarkdown: newRecord.cleaned_markdown,
                knowledgeSummary: newRecord.knowledge_summary,
                extractedFormulas: newRecord.extracted_formulas || [],
                concepts: newRecord.concepts || [],
                subject: newRecord.detected_subject,
                topic: newRecord.detected_topic,
              }
            }));
            toast.success('Analysis complete! Mentat has internalized the material.');
            setCurrentUploadId(null); // Stop listening
          } else if (newRecord.processing_status === 'failed') {
            setState(prev => ({
              ...prev,
              isProcessing: false,
              processingStatus: 'failed',
              error: 'Background processing failed.'
            }));
            setCurrentUploadId(null);
          } else {
            // Update mid-processing states (analyzing, vectorizing)
            setState(prev => ({
              ...prev,
              processingStatus: newRecord.processing_status as any
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUploadId]);

  const processDocument = useCallback(async (file: File, subject?: string) => {
    setState(prev => ({ ...prev, isProcessing: true, processingStatus: 'analyzing', error: null }));

    try {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) throw new Error('Unsupported file type.');
      if (file.size > 10 * 1024 * 1024) throw new Error('File size must be less than 10MB');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in');

      // 1. Initial Processing (Client-side OCR for DOCX, or direct binary upload)
      let rawText = '';
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        rawText = result.value;
      }

      // 2. INSERT PENDING RECORD (Triggers Database Webhook)
      const { data: uploadRecord, error: insertError } = await supabase
        .from('uploaded_content')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          raw_text: rawText, // Empty for images/PDFs (Worker handles Vision)
          detected_subject: subject || 'General',
          processing_status: 'processing'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Set state to track via Realtime
      setCurrentUploadId(uploadRecord.id);
      toast.info('Analyzing in background. You can keep chatting.');

    } catch (error) {
      logger.error(error);
      const message = error instanceof Error ? error.message : 'Processing failed';
      setState(prev => ({ ...prev, isProcessing: false, processingStatus: 'failed', error: message }));
      toast.error(message);
    }
  }, []);

  const addToKnowledgeBase = useCallback(async () => {
    // This is now mostly handled by the background worker, 
    // but we can keep it for any additional metadata updates
    setState(prev => ({ ...prev, isAddingToKnowledgeBase: true }));
    setTimeout(() => {
      setState(prev => ({ ...prev, isAddingToKnowledgeBase: false }));
      toast.success('Successfully unified with your knowledge base.');
    }, 1000);
    return true;
  }, []);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      isAddingToKnowledgeBase: false,
      processedDocument: null,
      processingStatus: 'idle',
      error: null,
    });
    setCurrentUploadId(null);
  }, []);

  return {
    ...state,
    processDocument,
    addToKnowledgeBase,
    reset,
  };
}
