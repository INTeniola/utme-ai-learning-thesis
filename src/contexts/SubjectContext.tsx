import { createContext, ReactNode, useContext, useState } from 'react';

interface SubjectContextType {
    subject: string | undefined;
    setSubject: (subject: string | undefined) => void;
}

const SubjectContext = createContext<SubjectContextType | undefined>(undefined);

const SUBJECT_STORAGE_KEY = 'quizant_selected_subject';

export function SubjectProvider({ children }: { children: ReactNode }) {
    const [subject, setSubjectState] = useState<string | undefined>(undefined); // No default subject

    const setSubject = (newSubject: string | undefined) => {
        setSubjectState(newSubject);
        if (newSubject) {
            localStorage.setItem(SUBJECT_STORAGE_KEY, newSubject);
        } else {
            localStorage.removeItem(SUBJECT_STORAGE_KEY);
        }
    };

    return (
        <SubjectContext.Provider value={{ subject, setSubject }}>
            {children}
        </SubjectContext.Provider>
    );
}

export function useSubject() {
    const context = useContext(SubjectContext);
    if (context === undefined) {
        throw new Error('useSubject must be used within a SubjectProvider');
    }
    return context;
}
