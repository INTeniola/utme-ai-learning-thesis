import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import {
    BookOpen,
    Crown,
    MessageSquare,
    Plus,
    Search,
    Send,
    Star,
    TrendingUp,
    Trophy,
    Users
} from 'lucide-react';
import { useState } from 'react';

interface StudyGroup {
    id: string;
    name: string;
    subject: string;
    members: number;
    maxMembers: number;
    description: string;
    isActive: boolean;
    creator: string;
}

interface GroupMember {
    id: string;
    name: string;
    avatar?: string;
    streak: number;
    points: number;
    isOnline: boolean;
}

interface SharedResource {
    id: string;
    type: 'note' | 'question' | 'explanation';
    title: string;
    author: string;
    upvotes: number;
    timestamp: Date;
}

export function StudyGroups() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('discover');
    const [searchQuery, setSearchQuery] = useState('');
    const [groups, setGroups] = useState<StudyGroup[]>([
        {
            id: '1',
            name: 'JAMB 2026 Warriors',
            subject: 'All Subjects',
            members: 24,
            maxMembers: 30,
            description: 'Preparing together for JAMB 2026. Daily challenges and group study sessions.',
            isActive: true,
            creator: 'Sarah M.'
        },
        {
            id: '2',
            name: 'Physics Masters',
            subject: 'Physics',
            members: 12,
            maxMembers: 20,
            description: 'Deep dive into physics concepts. Solve problems together.',
            isActive: true,
            creator: 'John D.'
        },
        {
            id: '3',
            name: 'Math Wizards',
            subject: 'Mathematics',
            members: 18,
            maxMembers: 25,
            description: 'From algebra to calculus. We tackle it all!',
            isActive: false,
            creator: 'Emma K.'
        }
    ]);

    const [myGroups] = useState<StudyGroup[]>([groups[0]]);
    const [groupMembers] = useState<GroupMember[]>([
        { id: '1', name: 'Sarah M.', streak: 15, points: 2450, isOnline: true },
        { id: '2', name: 'John D.', streak: 8, points: 1890, isOnline: true },
        { id: '3', name: 'Emma K.', streak: 12, points: 2100, isOnline: false },
        { id: '4', name: 'You', streak: 12, points: 1950, isOnline: true }
    ]);

    const [sharedResources] = useState<SharedResource[]>([
        {
            id: '1',
            type: 'explanation',
            title: 'How to solve quadratic equations using factoring',
            author: 'Sarah M.',
            upvotes: 24,
            timestamp: new Date('2026-01-28')
        },
        {
            id: '2',
            type: 'question',
            title: 'JAMB 2023 Physics Q15 - Need help with projectile motion',
            author: 'John D.',
            upvotes: 12,
            timestamp: new Date('2026-01-29')
        },
        {
            id: '3',
            type: 'note',
            title: 'Complete summary: Organic Chemistry reactions',
            author: 'Emma K.',
            upvotes: 31,
            timestamp: new Date('2026-01-27')
        }
    ]);

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.subject.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getResourceIcon = (type: string) => {
        switch (type) {
            case 'note': return BookOpen;
            case 'question': return MessageSquare;
            case 'explanation': return Star;
            default: return BookOpen;
        }
    };

    return (
        <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold">Study Groups</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Learn together, achieve together
                    </p>
                </div>
                <Button size="sm" className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Group
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto">
                    <TabsTrigger value="discover" className="text-xs sm:text-sm py-2">
                        <Search className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Discover</span>
                        <span className="sm:hidden">Find</span>
                    </TabsTrigger>
                    <TabsTrigger value="my-groups" className="text-xs sm:text-sm py-2">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">My Groups</span>
                        <span className="sm:hidden">Mine</span>
                    </TabsTrigger>
                    <TabsTrigger value="leaderboard" className="text-xs sm:text-sm py-2">
                        <Trophy className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Leaderboard</span>
                        <span className="sm:hidden">Ranks</span>
                    </TabsTrigger>
                </TabsList>

                {/* Discover Groups Tab */}
                <TabsContent value="discover" className="space-y-4 mt-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search groups by name or subject..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 text-sm"
                        />
                    </div>

                    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                        {filteredGroups.map((group) => (
                            <Card key={group.id} className={group.isActive ? 'border-primary/30' : ''}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <CardTitle className="text-sm sm:text-base truncate">{group.name}</CardTitle>
                                            <CardDescription className="text-xs mt-1">
                                                <Badge variant="outline" className="text-xs">
                                                    {group.subject}
                                                </Badge>
                                            </CardDescription>
                                        </div>
                                        {group.isActive && (
                                            <Badge variant="default" className="text-xs flex-shrink-0">
                                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" />
                                                Live
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                                        {group.description}
                                    </p>
                                    <div className="flex items-center justify-between text-xs sm:text-sm">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                                            <span>{group.members}/{group.maxMembers}</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">by {group.creator}</span>
                                    </div>
                                    <Button size="sm" className="w-full text-xs sm:text-sm">
                                        Join Group
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* My Groups Tab */}
                <TabsContent value="my-groups" className="space-y-4 mt-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                        {/* Active Group */}
                        <Card className="lg:col-span-2">
                            <CardHeader className="pb-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <CardTitle className="text-base sm:text-lg">JAMB 2026 Warriors</CardTitle>
                                    <Badge variant="default" className="text-xs w-fit">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" />
                                        24 online
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Shared Resources */}
                                <div>
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <BookOpen className="h-4 w-4" />
                                        Shared Resources
                                    </h3>
                                    <ScrollArea className="h-[300px] sm:h-[400px]">
                                        <div className="space-y-2">
                                            {sharedResources.map((resource) => {
                                                const Icon = getResourceIcon(resource.type);
                                                return (
                                                    <Card key={resource.id} className="hover:bg-muted/50 cursor-pointer">
                                                        <CardContent className="p-3">
                                                            <div className="flex items-start gap-2 sm:gap-3">
                                                                <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5 flex-shrink-0" />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs sm:text-sm font-medium line-clamp-2">
                                                                        {resource.title}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs text-muted-foreground">
                                                                        <span>{resource.author}</span>
                                                                        <span>•</span>
                                                                        <span className="flex items-center gap-1">
                                                                            <TrendingUp className="h-3 w-3" />
                                                                            {resource.upvotes}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </div>

                                {/* Quick Message */}
                                <div className="flex gap-2">
                                    <Input placeholder="Share a resource or ask a question..." className="text-sm" />
                                    <Button size="icon" className="flex-shrink-0">
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Members Sidebar */}
                        <Card className="lg:col-span-1">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm sm:text-base">Members</CardTitle>
                                <CardDescription className="text-xs">
                                    {groupMembers.filter(m => m.isOnline).length} online
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[300px] sm:h-[400px]">
                                    <div className="space-y-3">
                                        {groupMembers
                                            .sort((a, b) => b.points - a.points)
                                            .map((member, index) => (
                                                <div key={member.id} className="flex items-center gap-2 sm:gap-3">
                                                    <div className="flex-shrink-0 relative">
                                                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                                                            <AvatarFallback className="text-xs sm:text-sm">
                                                                {member.name.split(' ').map(n => n[0]).join('')}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {member.isOnline && (
                                                            <span className="absolute bottom-0 right-0 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-500 rounded-full border-2 border-background" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            {index === 0 && <Crown className="h-3 w-3 text-yellow-500 flex-shrink-0" />}
                                                            <p className="text-xs sm:text-sm font-medium truncate">{member.name}</p>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {member.points} pts • {member.streak}🔥
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Leaderboard Tab */}
                <TabsContent value="leaderboard" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base sm:text-lg">Group Leaderboard</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                Top performers this week
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {groupMembers
                                    .sort((a, b) => b.points - a.points)
                                    .map((member, index) => (
                                        <div
                                            key={member.id}
                                            className={`flex items-center gap-3 sm:gap-4 p-3 rounded-lg ${index < 3 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'
                                                }`}
                                        >
                                            <div className="flex-shrink-0 w-6 sm:w-8 text-center">
                                                {index === 0 && <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500 mx-auto" />}
                                                {index === 1 && <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground mx-auto" />}
                                                {index === 2 && <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 mx-auto" />}
                                                {index > 2 && <span className="text-sm sm:text-base font-bold text-muted-foreground">#{index + 1}</span>}
                                            </div>
                                            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                                                <AvatarFallback className="text-xs sm:text-sm">
                                                    {member.name.split(' ').map(n => n[0]).join('')}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm sm:text-base font-medium truncate">{member.name}</p>
                                                <p className="text-xs text-muted-foreground">{member.streak} day streak</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm sm:text-lg font-bold">{member.points}</p>
                                                <p className="text-xs text-muted-foreground">points</p>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
