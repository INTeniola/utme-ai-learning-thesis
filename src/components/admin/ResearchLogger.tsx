import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import {
    ArrowLeft,
    Database,
    Download,
    FileJson,
    FileSpreadsheet,
    Loader2,
    Shield,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface ResearchLoggerProps {
  onBack: () => void;
}

export function ResearchLogger({ onBack }: ResearchLoggerProps) {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus('Compiling research data...');

    try {
      const { data, error } = await supabase.functions.invoke('research-export', {
        body: {
          format,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });

      if (error) throw error;

      // Download the file
      const blob = new Blob(
        [format === 'json' ? JSON.stringify(data, null, 2) : data],
        { type: format === 'json' ? 'application/json' : 'text/csv' }
      );
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research_export_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatus('Export completed successfully!');
      toast.success('Research data exported successfully');

    } catch (err) {
      console.error('Export failed:', err);
      const message = err instanceof Error ? err.message : 'Export failed';
      setExportStatus(`Error: ${message}`);
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold sm:text-2xl">Research Logger</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Export anonymized user journey data for research analysis
        </p>
      </div>

      {/* Admin Notice */}
      <Card className="mb-6 border-yellow-200 bg-yellow-50">
        <CardContent className="flex items-start gap-3 p-4">
          <Shield className="mt-0.5 h-5 w-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-800">Admin Access Only</p>
            <p className="text-sm text-yellow-700">
              This feature is restricted to administrators. All exported data is 
              anonymized to protect user privacy while maintaining research validity.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5" />
            Export Configuration
          </CardTitle>
          <CardDescription>
            Configure your research data export settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as 'json' | 'csv')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    JSON (Full structured data)
                  </div>
                </SelectItem>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV (Spreadsheet compatible)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">From Date (Optional)</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">To Date (Optional)</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Data Included */}
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="mb-3 text-sm font-medium">Data Included in Export:</p>
            <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                User profiles (anonymized)
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Exam sessions & scores
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Question-level logs
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Mastery progression
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Time spent per question
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Aggregate statistics
              </li>
            </ul>
          </div>

          {/* Export Button */}
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full gap-2"
            size="lg"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export Research Data
              </>
            )}
          </Button>

          {/* Status */}
          {exportStatus && (
            <p className={`text-center text-sm ${
              exportStatus.includes('Error') ? 'text-destructive' : 'text-muted-foreground'
            }`}>
              {exportStatus}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Research Notes */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Research Data Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="space-y-2">
            <li>• All user IDs are truncated to preserve anonymity</li>
            <li>• Personal information (names, emails) is excluded</li>
            <li>• Data is suitable for IRB-approved educational research</li>
            <li>• JSON format includes diagnostic metadata for analysis</li>
            <li>• CSV format is optimized for SPSS/Excel import</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
