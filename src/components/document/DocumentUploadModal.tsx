import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ProcessedDocument, useDocumentIngestion } from '@/hooks/useDocumentIngestion';
import { cn } from '@/lib/utils';
import {
    CheckCircle2,
    FileText,
    Loader2,
    Plus,
    Sparkles,
    Upload,
    X,
    BookOpen
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface DocumentUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadComplete?: (document: ProcessedDocument) => void;
    initialSubject?: string;
    activeSources?: Array<{ file_name: string }>;
}

const SUBJECTS = [
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'English',
    'General',
];

export function DocumentUploadModal({
    isOpen,
    onClose,
    onUploadComplete,
    initialSubject,
    activeSources = [],
}: DocumentUploadModalProps) {
    const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject || '');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        isProcessing,
        isAddingToKnowledgeBase,
        processedDocument,
        error,
        processDocument,
        addToKnowledgeBase,
        reset,
    } = useDocumentIngestion();

    const handleFileSelect = useCallback((file: File) => {
        // Basic validation
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!validTypes.includes(file.type)) {
            // You might want to show an error toast here
            return;
        }

        setSelectedFile(file);
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        } else {
            setPreviewUrl(null);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    const handleProcess = useCallback(async () => {
        if (!selectedFile) return;
        await processDocument(selectedFile, selectedSubject || undefined);
    }, [selectedFile, selectedSubject, processDocument]);

    const handleReset = useCallback(() => {
        setSelectedFile(null);
        setPreviewUrl(null);
        // Don't reset subject as user might want to upload another for same subject
        reset();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [reset]);

    const handleClose = () => {
        handleReset();
        onClose();
    };

    const handleAddToKB = async () => {
        const success = await addToKnowledgeBase();
        if (success) {
            if (onUploadComplete && processedDocument) {
                onUploadComplete(processedDocument);
            }
            // Optional: Close modal after success or let user choose to close
            // setTimeout(handleClose, 1500); 
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Knowledge Vault</DialogTitle>
                    <DialogDescription>
                        Manage your study materials and enhance Mentat's understanding.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6 pt-2">
                    {!processedDocument ? (
                        <div className="space-y-6">
                            {/* Subject Selection */}
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Subject context
                                </label>
                                <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!!initialSubject}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUBJECTS.map((subject) => (
                                            <SelectItem key={subject} value={subject}>
                                                {subject}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Drop Zone */}
                            {!selectedFile ? (
                                <div
                                    className={cn(
                                        'relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
                                        'hover:border-primary hover:bg-primary/5',
                                        'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
                                    )}
                                    onDrop={handleDrop}
                                    onDragOver={(e) => e.preventDefault()}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
                                        className="sr-only"
                                        onChange={handleFileInput}
                                    />
                                    <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                                    <p className="mb-2 text-center text-sm font-medium">
                                        Drop a file here or click to upload
                                    </p>
                                    <p className="text-center text-xs text-muted-foreground">
                                        Supports Images, PDF, DOCX • Max 10MB
                                    </p>
                                </div>
                            ) : (
                                <div className="relative rounded-lg border p-4">
                                    <div className="flex items-center gap-4">
                                        {previewUrl ? (
                                            <img src={previewUrl} alt="Preview" className="h-16 w-16 rounded object-cover" />
                                        ) : (
                                            <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
                                                <FileText className="h-8 w-8 text-muted-foreground" />
                                            </div>
                                        )}
                                        <div className="flex-1 overflow-hidden">
                                            <p className="truncate font-medium">{selectedFile.name}</p>
                                            <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={handleReset}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Error State */}
                            {error && (
                                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                                    <p className="text-sm text-destructive">{error}</p>
                                </div>
                            )}

                            {/* Process Button */}
                            {selectedFile && !isProcessing && (
                                <Button onClick={handleProcess} className="w-full gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    Process & Analyze
                                </Button>
                            )}

                            {/* Processing State */}
                            {isProcessing && (
                                <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/50 p-6">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <div className="text-center">
                                        <p className="font-medium">Processing document...</p>
                                        <p className="text-sm text-muted-foreground">
                                            Extracting text and analyzing content
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <div>
                                    <p className="font-medium text-green-800">Analysis Complete</p>
                                    <p className="text-sm text-green-700">Ready to add to knowledge base</p>
                                </div>
                            </div>

                            <div className="rounded-lg border p-4">
                                <h4 className="mb-2 font-medium">Summary</h4>
                                <p className="text-sm text-muted-foreground">{processedDocument.knowledgeSummary}</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {processedDocument.subject && <Badge variant="secondary">{processedDocument.subject}</Badge>}
                                {processedDocument.topic && <Badge variant="outline">{processedDocument.topic}</Badge>}
                                <Badge variant="outline">{processedDocument.extractedFormulas.length} formulas</Badge>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={handleAddToKB}
                                    disabled={isAddingToKnowledgeBase}
                                    className="flex-1 gap-2"
                                >
                                    {isAddingToKnowledgeBase ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4" />
                                            Add to Study Vault
                                        </>
                                    )}
                                </Button>
                                <Button variant="outline" onClick={handleReset}>
                                    Upload Another
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Active Context Sources Section */}
                    {activeSources.length > 0 && (
                        <div className="mt-10 border-t pt-6">
                            <h4 className="flex items-center gap-2 text-sm font-semibold mb-4">
                                <BookOpen className="h-4 w-4 text-primary" />
                                Active Context Sources
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                                {activeSources.map((source, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 group hover:border-primary/20 transition-colors">
                                        <div className="h-9 w-9 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border/50">
                                            <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate text-foreground" title={source.file_name}>
                                                {source.file_name}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">Active in session</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
