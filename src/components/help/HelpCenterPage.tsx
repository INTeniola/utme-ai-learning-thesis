import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
    BookOpen,
    Brain,
    Clock,
    HelpCircle,
    Lightbulb,
    Mail,
    MessageSquare,
    Search,
    Target,
    Zap
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface HelpCenterPageProps {
  onBack: () => void;
}

const faqs = [
  {
    category: "Getting Started",
    questions: [
      {
        q: "How do I start studying with Quizant?",
        a: "Click on any subject card from your dashboard, then select a study tool like Quick Quiz, Daily Mastery, or Past Questions. Mentat Tutor is also available to guide you through topics step by step."
      },
      {
        q: "How do I change my selected subjects?",
        a: "Go to your Profile page by clicking your avatar in the top right corner and selecting 'Profile'. You can manage your subjects from there."
      },
      {
        q: "What is Mentat Tutor and how does it work?",
        a: "Mentat Tutor is your personal study assistant. It uses the Socratic method to guide you through concepts by asking questions rather than giving direct answers. This helps you understand topics more deeply."
      }
    ]
  },
  {
    category: "Quizzes & Practice",
    questions: [
      {
        q: "How are quiz questions generated?",
        a: "Quiz questions are drawn from a database of past UTME questions and AI-generated questions based on the official JAMB syllabus. The adaptive engine selects questions based on your performance level."
      },
      {
        q: "What is a CBT Simulation?",
        a: "CBT (Computer-Based Test) Simulation mimics the actual UTME exam environment. You'll answer 60 questions across 4 subjects in a timed setting, just like the real exam."
      },
      {
        q: "Can I review my wrong answers?",
        a: "Yes! After completing any quiz, you'll see a detailed breakdown of your performance including explanations for each question. You can also create flashcards from questions you got wrong."
      }
    ]
  },
  {
    category: "Daily Mastery",
    questions: [
      {
        q: "How does spaced repetition work?",
        a: "Spaced repetition shows you flashcards at optimal intervals based on how well you remember them. Cards you find difficult appear more often, while easy cards are shown less frequently."
      },
      {
        q: "Can I create my own flashcards?",
        a: "Yes! You can create flashcards manually or generate them automatically from topics using AI. You can also convert quiz questions you got wrong into flashcards."
      }
    ]
  },
  {
    category: "Progress & Analytics",
    questions: [
      {
        q: "How is my progress tracked?",
        a: "We track your study time, quiz scores, flashcard reviews, and topic mastery. All this data is combined to show your overall readiness for the UTME exam."
      },
      {
        q: "What do the mastery levels mean?",
        a: "Mastery levels range from Beginner to Expert. They're calculated based on your accuracy and consistency across quizzes and practice sessions in each topic."
      }
    ]
  }
];

const studyTips = [
  {
    icon: Clock,
    title: "Study in Focused Sessions",
    description: "Use the Pomodoro technique: 25 minutes of focused study followed by a 5-minute break. Use Focus Mode to track your sessions."
  },
  {
    icon: Target,
    title: "Set Daily Goals",
    description: "Aim to complete at least one quiz and review 20 flashcards daily. Consistency beats intensity in long-term learning."
  },
  {
    icon: Brain,
    title: "Active Recall Over Passive Reading",
    description: "Test yourself frequently instead of just re-reading notes. Our quizzes and flashcards are designed for active recall."
  },
  {
    icon: Zap,
    title: "Focus on Weak Topics",
    description: "Check your Performance page to identify topics where you score lowest. Spend extra time on these areas."
  },
  {
    icon: BookOpen,
    title: "Use Past Questions",
    description: "JAMB often repeats question patterns. Practice with past questions to familiarize yourself with the exam format and common topics."
  },
  {
    icon: Lightbulb,
    title: "Learn from Mistakes",
    description: "When you get a question wrong, read the explanation carefully. Convert difficult questions into flashcards for review."
  }
];

export function HelpCenterPage({ onBack }: HelpCenterPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [sending, setSending] = useState(false);

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(
      q => q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    // Simulate sending (in production, this would call an edge function)
    await new Promise(resolve => setTimeout(resolve, 1000));

    toast.success("Message sent! We'll get back to you soon.");
    setContactName("");
    setContactEmail("");
    setContactMessage("");
    setSending(false);
  };

  return (
    <div className="bg-background overflow-y-auto w-full h-full">
      <main className="mx-auto max-w-4xl p-4 sm:p-6 pb-16">
        <Tabs defaultValue="faq" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="faq" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">FAQs</span>
            </TabsTrigger>
            <TabsTrigger value="tips" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              <span className="hidden sm:inline">Study Tips</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Contact</span>
            </TabsTrigger>
          </TabsList>

          {/* FAQs Tab */}
          <TabsContent value="faq" className="space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* FAQ Categories */}
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((category) => (
                <Card key={category.category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge variant="secondary">{category.category}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {category.questions.map((faq, index) => (
                        <AccordionItem key={index} value={`${category.category}-${index}`}>
                          <AccordionTrigger className="text-left text-sm">
                            {faq.q}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground">
                            {faq.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No FAQs match your search.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Study Tips Tab */}
          <TabsContent value="tips" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  UTME Success Tips
                </CardTitle>
                <CardDescription>
                  Proven strategies to maximize your exam preparation
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              {studyTips.map((tip, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <tip.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">{tip.title}</h3>
                        <p className="text-sm text-muted-foreground">{tip.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Contact Support
                </CardTitle>
                <CardDescription>
                  Have a question or feedback? We'd love to hear from you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitContact} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Your name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Describe your issue or feedback..."
                      rows={5}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={sending}>
                    {sending ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You can also reach us at
                  </p>
                  <a
                    href="mailto:support@quizant.com"
                    className="text-primary hover:underline font-medium"
                  >
                    support@quizant.com
                  </a>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
