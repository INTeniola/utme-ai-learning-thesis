import { LatexRenderer } from '@/components/study/LatexRenderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    ArrowLeft,
    BookOpen,
    Camera,
    CheckCircle2,
    FileText,
    ImageIcon,
    Loader2,
    Plus,
    Sparkles,
    Upload,
    X,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface DocumentIngestionProps {
  onBack: () => void;
  initialSubject?: string | null;
}

const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'General',
];

export function DocumentIngestion({ onBack, initialSubject }: DocumentIngestionProps) {
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
    if (!file.type.startsWith('image/')) {
      return;
    }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
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
    setSelectedSubject('');
    reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [reset]);

  // Cleanup preview URL on unmount
  const handleClearPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [previewUrl]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="mb-8">
        <h1 className="text-xl font-bold sm:text-2xl">Scan Notes</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Upload textbooks, documents (PDF/DOCX), or handwritten notes to extract and learn from them
        </p>
      </div>

      {/* Upload Section - shown when no document is processed */}
      {!processedDocument && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="h-5 w-5" />
              Upload Document
            </CardTitle>
            <CardDescription>
              Take a photo or upload a file (Image, PDF, Word) of your textbook or notes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Subject Selection */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium">
                Subject (Optional)
              </label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Auto-detect subject" />
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
            {!previewUrl ? (
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
                  capture="environment"
                  className="sr-only"
                  onChange={handleFileInput}
                />
                <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-2 text-center text-sm font-medium">
                  Drop a file here or click to upload
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  Supports Images, PDF, DOCX • Max 10MB
                </p>
                <Button variant="outline" size="sm" className="mt-4 gap-2">
                  <Upload className="h-4 w-4" />
                  Choose File
                </Button>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-64 w-full rounded-lg object-contain"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2"
                  onClick={handleClearPreview}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Process Button */}
            {selectedFile && !isProcessing && (
              <Button
                onClick={handleProcess}
                className="mt-4 w-full gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Process Document
              </Button>
            )}

            {/* Processing State */}
            {isProcessing && (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-lg bg-muted/50 p-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium">Processing your document...</p>
                  <p className="text-sm text-muted-foreground">
                    Running OCR and formatting content
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Processed Document View */}
      {processedDocument && (
        <ProcessedDocumentView
          document={processedDocument}
          isAddingToKnowledgeBase={isAddingToKnowledgeBase}
          onAddToKnowledgeBase={addToKnowledgeBase}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

// Separate component for processed document
function ProcessedDocumentView({
  document,
  isAddingToKnowledgeBase,
  onAddToKnowledgeBase,
  onReset,
}: {
  document: ProcessedDocument;
  isAddingToKnowledgeBase: boolean;
  onAddToKnowledgeBase: () => Promise<boolean>;
  onReset: () => void;
}) {
  const [addedToKB, setAddedToKB] = useState(false);

  const handleAdd = async () => {
    const success = await onAddToKnowledgeBase();
    if (success) setAddedToKB(true);
  };

  return (
    <div className="space-y-4">
      {/* Success Header */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="font-medium text-green-800">Document processed successfully!</p>
            <p className="text-sm text-green-700">
              Extracted and formatted content is ready
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-4">
          {document.subject && (
            <Badge variant="secondary" className="gap-1">
              <BookOpen className="h-3 w-3" />
              {document.subject}
            </Badge>
          )}
          {document.topic && (
            <Badge variant="outline">{document.topic}</Badge>
          )}
          {document.extractedFormulas.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" />
              {document.extractedFormulas.length} formulas
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Knowledge Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Knowledge Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {document.knowledgeSummary}
          </p>
        </CardContent>
      </Card>

      {/* Extracted Formulas */}
      {document.extractedFormulas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Key Formulas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {document.extractedFormulas.map((formula, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-muted px-3 py-2"
                >
                  <LatexRenderer content={formula} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cleaned Content */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Processed Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-h-80 overflow-y-auto rounded-lg bg-muted/50 p-4">
            <LatexRenderer content={document.cleanedMarkdown} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {!addedToKB ? (
          <Button
            onClick={handleAdd}
            disabled={isAddingToKnowledgeBase}
            className="flex-1 gap-2"
          >
            {isAddingToKnowledgeBase ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add to My Study Vault
              </>
            )}
          </Button>
        ) : (
          <Button disabled className="flex-1 gap-2 bg-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Added to Study Vault
          </Button>
        )}
        <Button variant="outline" onClick={onReset} className="gap-2">
          <Camera className="h-4 w-4" />
          Upload Another
        </Button>
      </div>
    </div>
  );
}
