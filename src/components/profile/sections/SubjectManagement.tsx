import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Check, Edit2, Calculator, Atom, FlaskConical, Dna, Globe, Landmark, DollarSign, BookMarked } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EnglishIcon = ({ className }: { className?: string }) => (
  <span className={cn("font-serif font-bold text-xl leading-none flex items-center justify-center", className)} aria-label="English">Aa</span>
);

const SUBJECTS = [
  { id: "english", name: "English Language", icon: EnglishIcon, mandatory: true },
  { id: "mathematics", name: "Mathematics", icon: Calculator },
  { id: "physics", name: "Physics", icon: Atom },
  { id: "chemistry", name: "Chemistry", icon: FlaskConical },
  { id: "biology", name: "Biology", icon: Dna },
  { id: "geography", name: "Geography", icon: Globe },
  { id: "government", name: "Government", icon: Landmark },
  { id: "economics", name: "Economics", icon: DollarSign },
  { id: "literature", name: "Literature", icon: BookMarked },
];

interface SubjectManagementProps {
  user: any;
  selectedSubjects: string[];
  onUpdate: (newSubjects: string[]) => void;
}

export function SubjectManagement({ user, selectedSubjects, onUpdate }: SubjectManagementProps) {
  const [open, setOpen] = useState(false);
  const [editedSubjects, setEditedSubjects] = useState<string[]>(selectedSubjects);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (editedSubjects.length !== 4) {
      toast.error("Please select exactly 4 subjects");
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          subjects_meta: { selectedSubjects: editedSubjects },
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;
      onUpdate(editedSubjects);
      toast.success("Subjects updated successfully!");
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update subjects");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black tracking-tighter">Curriculum</h2>
        <p className="text-sm text-muted-foreground">Manage your 4 core subjects for the UTME exam</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {selectedSubjects.map((id) => {
          const subject = SUBJECTS.find(s => s.id === id);
          if (!subject) return null;
          const Icon = subject.icon;
          return (
            <div key={id} className="flex items-center gap-4 p-5 rounded-[1.5rem] border-2 bg-card group transition-all hover:border-primary/50">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                 <Icon className="h-6 w-6 text-primary group-hover:text-primary-foreground transition-colors" />
              </div>
              <div>
                <p className="font-black text-sm tracking-tight">{subject.name}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{subject.mandatory ? "Core Mandatory" : "Elective"}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="h-12 rounded-2xl border-2 px-8 font-black uppercase tracking-widest text-[10px]" onClick={() => setEditedSubjects(selectedSubjects)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Modify Curriculum
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] p-8 border-2 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter">Edit Your Subjects</DialogTitle>
            <DialogDescription className="font-medium">
              Select exactly 4 subjects. English is mandatory for all UTME candidates.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-6">
            {SUBJECTS.map((subject) => {
              const isSelected = editedSubjects.includes(subject.id);
              const Icon = subject.icon;
              return (
                <button
                  key={subject.id}
                  onClick={() => {
                    if (subject.mandatory) return;
                    setEditedSubjects((prev) => {
                      if (prev.includes(subject.id)) return prev.filter((id) => id !== subject.id);
                      if (prev.length < 4) return [...prev, subject.id];
                      return prev;
                    });
                  }}
                  disabled={subject.mandatory}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all",
                    isSelected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50",
                    subject.mandatory && "opacity-80 cursor-not-allowed"
                  )}
                >
                  {isSelected && <div className="absolute right-2 top-2 h-5 w-5 bg-primary rounded-full flex items-center justify-center"><Check className="h-3 w-3 text-primary-foreground" /></div>}
                  <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shadow-sm", isSelected ? "bg-primary" : "bg-muted")}>
                    <Icon className={cn("h-6 w-6", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />
                  </div>
                  <span className={cn("text-[10px] font-black uppercase tracking-tight text-center", isSelected ? "text-primary" : "text-muted-foreground")}>{subject.name}</span>
                </button>
              );
            })}
          </div>
          <DialogFooter>
             <div className="flex grow items-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{editedSubjects.length}/4 SELECTED</p>
             </div>
             <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-bold">Cancel</Button>
                <Button onClick={handleSave} disabled={editedSubjects.length !== 4 || saving} className="rounded-xl bg-primary px-6 font-black uppercase tracking-widest text-[10px] h-11">
                   {saving ? "Updating..." : "Confirm Changes"}
                </Button>
             </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
