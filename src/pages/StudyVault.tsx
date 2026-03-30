import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardTopBar } from '@/components/dashboard/DashboardTopBar';
import { MobileNav } from '@/components/dashboard/MobileNav';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { SavedNote, useStudyVault } from '@/hooks/useStudyVault';
import { formatDistanceToNow, isBefore, startOfToday } from 'date-fns';
import { ArrowLeft, Brain, Calendar, CheckSquare, Clock, Folder, Loader2, MoreVertical, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StudyVault() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { notes, loading, loadSavedNotes, deleteNote, markReviewed } = useStudyVault();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    useEffect(() => {
        if (user) loadSavedNotes();
    }, [user, loadSavedNotes]);

    // Extract all unique tags
    const allTags = useMemo(() => {
        const tags = new Set<string>();
        notes.forEach(note => {
            if (note.metadata.subject) tags.add(note.metadata.subject);
            if (note.metadata.topic) tags.add(note.metadata.topic);
            if (note.metadata.tags) note.metadata.tags.forEach(t => tags.add(t));
        });
        return Array.from(tags).sort();
    }, [notes]);

    // Filter logic
    const filteredNotes = useMemo(() => {
        return notes.filter(note => {
            const textMatches = note.content.toLowerCase().includes(searchQuery.toLowerCase());

            const tagMatches = !selectedTag || (
                note.metadata.subject === selectedTag ||
                note.metadata.topic === selectedTag ||
                (note.metadata.tags && note.metadata.tags.includes(selectedTag))
            );

            return textMatches && tagMatches;
        });
    }, [notes, searchQuery, selectedTag]);

    // Group filtered notes by subject
    const groupedNotes = useMemo(() => {
        const groups: Record<string, SavedNote[]> = {};
        filteredNotes.forEach(note => {
            const subject = note.metadata.subject || 'General Notes';
            if (!groups[subject]) {
                groups[subject] = [];
            }
            groups[subject].push(note);
        });
        return groups;
    }, [filteredNotes]);

    // Due logic
    const dueNotesCount = notes.filter(note => {
        if (!note.metadata.next_review_date) return true;
        return isBefore(new Date(note.metadata.next_review_date), startOfToday());
    }).length;

    if (loading && notes.length === 0) {
        return (
            <DashboardLayout
                sidebar={<DashboardSidebar
                    currentView="document"
                    onViewChange={(view) => {
                        navigate('/');
                    }}
                    isAdmin={false}
                />}
                topBar={<DashboardTopBar />}
                bottomNav={<MobileNav
                    currentView="home"
                    onViewChange={(view) => {
                        navigate('/');
                    }}
                />}
            >
                <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            sidebar={<DashboardSidebar
                currentView="document"
                onViewChange={(view) => {
                    navigate('/');
                }}
                isAdmin={false}
            />}
            topBar={<DashboardTopBar />}
            bottomNav={<MobileNav
                currentView="home"
                onViewChange={(view) => {
                    navigate('/');
                }}
            />}
        >
            <div className="mx-auto max-w-6xl space-y-6">

                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="md:hidden">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                            <Brain className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Study Vault</h1>
                            <p className="text-muted-foreground transition-colors hover:text-foreground">
                                Your second brain. {notes.length} saved insights.
                            </p>
                        </div>
                    </div>
                    <Badge variant="secondary" className="gap-2 bg-orange-100 px-4 py-2 text-sm text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                        <Clock className="h-4 w-4" />
                        {dueNotesCount} reviews due today
                    </Badge>
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search your notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-11"
                        />
                    </div>
                </div>

                {/* Tags Row */}
                {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <Badge
                            variant={selectedTag === null ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setSelectedTag(null)}
                        >
                            All Topics
                        </Badge>
                        {allTags.map(tag => (
                            <Badge
                                key={tag}
                                variant={selectedTag === tag ? "default" : "secondary"}
                                className="cursor-pointer transition-all hover:bg-secondary/80"
                                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                            >
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Grouped Notes Accordion */}
                {Object.keys(groupedNotes).length === 0 ? (
                    <div className="py-12 text-center border rounded-xl bg-card">
                        <Folder className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                        <h3 className="text-lg font-semibold text-muted-foreground">No notes found</h3>
                        <p className="text-sm text-muted-foreground/60">
                            {searchQuery ? "Try a different search term" : "Save explanations from the AI Tutor to build your Study Vault"}
                        </p>
                    </div>
                ) : (
                    <Accordion type="multiple" defaultValue={Object.keys(groupedNotes)} className="space-y-4">
                        {Object.entries(groupedNotes).map(([subject, subjectNotes]) => (
                            <AccordionItem key={subject} value={subject} className="border rounded-xl bg-card overflow-hidden">
                                <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Folder className="h-5 w-5 text-primary" />
                                        <span className="font-semibold text-lg">{subject}</span>
                                        <Badge variant="secondary" className="ml-2">
                                            {subjectNotes.length} note{subjectNotes.length !== 1 ? 's' : ''}
                                        </Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6 pt-2">
                                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                                        {subjectNotes.map((note) => {
                                            const isDue = !note.metadata.next_review_date || isBefore(new Date(note.metadata.next_review_date), startOfToday());

                                            return (
                                                <Card key={note.id} className={`flex flex-col overflow-hidden transition-all hover:shadow-md ${isDue ? 'border-primary/50 ring-1 ring-primary/20 bg-primary/5' : ''}`}>
                                                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                                                        <div className="space-y-1">
                                                            <CardTitle className="text-base font-semibold leading-tight line-clamp-1">
                                                                {note.metadata.topic || 'General Note'}
                                                            </CardTitle>
                                                            <div className="flex items-center text-xs text-muted-foreground">
                                                                <Calendar className="mr-1 h-3 w-3" />
                                                                {formatDistanceToNow(new Date(note.created_at))} ago
                                                            </div>
                                                        </div>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={() => deleteNote(note.id)}>
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </CardHeader>

                                                    <CardContent className="flex-1">
                                                        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-6">
                                                            {note.content}
                                                        </p>
                                                    </CardContent>

                                                    <CardFooter className="flex flex-col items-start gap-3 border-t bg-muted/20 px-4 py-4 mt-auto">
                                                        {isDue ? (
                                                            <div className="flex w-full items-center justify-between gap-2">
                                                                <span className="text-xs font-semibold tracking-wide text-primary flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" /> REVIEW DUE
                                                                </span>
                                                                <div className="flex gap-2">
                                                                    <Button size="sm" variant="outline" className="h-7 border-destructive/30 text-xs text-destructive hover:bg-destructive/10" onClick={() => markReviewed(note, 'hard')}>Hard - 1d</Button>
                                                                    <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => markReviewed(note, 'easy')}>Easy - {Math.pow(2, (note.metadata.review_count || 0) + 1)}d</Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex w-full items-center gap-2 text-xs text-muted-foreground font-medium">
                                                                <CheckSquare className="h-4 w-4 text-emerald-500" />
                                                                Reviewed. Next: {new Date(note.metadata.next_review_date!).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                    </CardFooter>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </div>
        </DashboardLayout>
    );
}
