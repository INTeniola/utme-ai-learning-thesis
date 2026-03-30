import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export interface SavedNote {
    id: string;
    content: string;
    created_at: string;
    metadata: {
        subject?: string;
        topic?: string;
        source?: string;
        tags?: string[];
        next_review_date?: string;
        review_count?: number;
        [key: string]: any;
    };
}

/**
 * Hook for accessing user's knowledge base via AI interactions
 * Enables tool symbiosis across quiz, AI tutor, and visualizer
 * 
 * Note: Uses ai_interactions table to store document-related context
 * Documents are stored with message_type='document_upload'
 */
export function useStudyVault() {
    const { user } = useAuth();
    const [notes, setNotes] = useState<SavedNote[]>([]);
    const [loading, setLoading] = useState(false);

    /**
     * Get document context from AI interactions
     * Documents are stored as ai_interactions with message_type='document_upload'
     */
    const getDocumentContext = useCallback(async (
        subject?: string,
        maxLength: number = 10000
    ): Promise<string> => {
        if (!user) {
            logger.warn('No user logged in, cannot fetch documents');
            return '';
        }

        try {
            let query = supabase
                .from('ai_interactions')
                .select('content, context, metadata')
                .eq('user_id', user.id)
                .eq('message_type', 'document_upload')
                .order('created_at', { ascending: false })
                .limit(10);

            const { data, error } = await query;

            if (error) {
                logger.error('Error fetching document context:', error);
                return '';
            }

            if (!data || data.length === 0) {
                return '';
            }

            // Filter by subject if provided
            const filteredDocs = subject
                ? data.filter(doc => {
                    const meta = doc.metadata as any;
                    return meta?.subject?.toLowerCase() === subject.toLowerCase();
                })
                : data;

            // Concatenate document content
            const context = filteredDocs
                .map(doc => {
                    const meta = doc.metadata as any;
                    const subj = meta?.subject || 'General';
                    const topic = meta?.topic || 'Notes';
                    return `
=== ${subj} - ${topic} ===
${doc.content}
`;
                })
                .join('\n\n')
                .substring(0, maxLength);

            return context;
        } catch (error) {
            logger.error('Exception in getDocumentContext:', error);
            return '';
        }
    }, [user]);

    /**
     * Check if user has uploaded documents for a subject
     */
    const hasDocumentsForSubject = useCallback(async (
        subject: string
    ): Promise<boolean> => {
        if (!user) return false;

        try {
            const { data, error } = await supabase
                .from('ai_interactions')
                .select('id')
                .eq('user_id', user.id)
                .eq('message_type', 'document_upload')
                .limit(1);

            if (error) {
                logger.error('Error checking documents:', error);
                return false;
            }

            return (data?.length || 0) > 0;
        } catch (error) {
            logger.error('Exception in hasDocumentsForSubject:', error);
            return false;
        }
    }, [user]);

    /**
     * Save content to knowledge base
     */
    const saveToKnowledgeBase = useCallback(async (
        content: string,
        metadata: { subject: string; topic?: string; source?: string }
    ): Promise<boolean> => {
        if (!user) return false;

        try {
            // Check daily limit (10 per day)
            const today = new Date().toISOString().split('T')[0];
            const { count, error: countError } = await supabase
                .from('ai_interactions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('message_type', 'document_upload')
                .gte('created_at', today);

            if (countError) {
                logger.error('Error checking daily KB limit:', countError);
                return false;
            }

            if ((count || 0) >= 10) {
                logger.warn('Daily save limit reached');
                toast.error('Daily save limit reached (10/day). Please try again tomorrow.');
                return false;
            }

            const { error } = await supabase
                .from('ai_interactions')
                .insert({
                    user_id: user.id,
                    session_id: crypto.randomUUID(), // Generate a unique session ID for this save
                    message_type: 'document_upload', // Treat as document for context
                    content: content,
                    metadata: {
                        ...metadata,
                        type: 'saved_note',
                        saved_at: new Date().toISOString(),
                        tags: [],
                        review_count: 0
                    }
                });

            if (error) {
                logger.error('Error saving to KB:', error);
                return false;
            }
            return true;
        } catch (error) {
            logger.error('Exception in saveToKnowledgeBase:', error);
            return false;
        }
    }, [user]);

    /**
     * Fetch all saved notes for the Study Vault UI
     */
    const loadSavedNotes = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('ai_interactions')
                .select('id, content, created_at, metadata')
                .eq('user_id', user.id)
                .eq('message_type', 'document_upload')
                .order('created_at', { ascending: false });

            if (error) {
                logger.error('Error loading saved notes:', error);
                toast.error('Failed to load notes');
                return;
            }

            setNotes(data as SavedNote[]);
        } catch (error) {
            logger.error('Exception loading saved notes:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    /**
     * Delete a saved note from the user's base
     */
    const deleteNote = useCallback(async (id: string) => {
        try {
            const { error } = await supabase
                .from('ai_interactions')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setNotes(prev => prev.filter(n => n.id !== id));
            toast.success('Note removed from Study Vault');
        } catch (error) {
            logger.error('Error deleting note:', error);
            toast.error('Failed to delete note');
        }
    }, []);

    /**
     * Update strictly the metadata payload of a note (tags, etc)
     */
    const updateNoteMetadata = useCallback(async (id: string, newMetadata: any) => {
        try {
            const { error } = await supabase
                .from('ai_interactions')
                .update({ metadata: newMetadata })
                .eq('id', id);

            if (error) throw error;

            setNotes(prev => prev.map(n =>
                n.id === id ? { ...n, metadata: newMetadata } : n
            ));
        } catch (error) {
            logger.error('Error updating note metadata:', error);
            toast.error('Failed to update note details');
        }
    }, []);

    /**
     * A simplistic Spaced Repetition logic. Bumps the next_review_date by N days.
     */
    const markReviewed = useCallback(async (note: SavedNote, ease: 'easy' | 'hard') => {
        const currentCount = note.metadata.review_count || 0;
        const newCount = currentCount + 1;

        // Simple easing multiplier: 
        // Easy = push it further into the future exponentially
        // Hard = review it again tomorrow
        const daysToNextReview = ease === 'easy' ? Math.pow(2, newCount) : 1;

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + daysToNextReview);

        const updatedMetadata = {
            ...note.metadata,
            review_count: newCount,
            next_review_date: nextDate.toISOString()
        };

        await updateNoteMetadata(note.id, updatedMetadata);
        toast.success(`Marked as reviewed. Next review in ${daysToNextReview} day(s).`);
    }, [updateNoteMetadata]);

    return {
        notes,
        loading,
        getDocumentContext,
        hasDocumentsForSubject,
        saveToKnowledgeBase,
        loadSavedNotes,
        deleteNote,
        updateNoteMetadata,
        markReviewed
    };
}
