import { Project, SyntaxKind, FunctionDeclaration, MethodDeclaration, VariableDeclaration, ArrowFunction, FunctionExpression, ProjectOptions } from "ts-morph";
import * as fs from "fs";

const project = new Project({ tsConfigFilePath: "tsconfig.json" });

project.addSourceFilesAtPaths("src/lib/aiGateway.ts");
project.addSourceFilesAtPaths("src/hooks/useAITutor.ts");
project.addSourceFilesAtPaths("src/hooks/useQuiz.ts");
project.addSourceFilesAtPaths("src/hooks/useProgressDashboard.ts");
project.addSourceFilesAtPaths("src/hooks/useFlashcards.ts");
project.addSourceFilesAtPaths("supabase/functions/generate-quiz/index.ts");

const targets = [
    { file: "aiGateway.ts", exps: ["checkUserQuota", "generateSafe", "generateSafeStream", "embedContent", "generateFromImage"] },
    { file: "useAITutor.ts", exps: ["buildRichStudentContext", "getSystemPrompt", "sendMessage", "ingestToolResult", "analyseStudentStyle", "useAITutor"] },
    { file: "useQuiz.ts", exps: ["generateQuiz", "submitQuiz", "getAdaptiveQuestion", "useQuiz"] },
    { file: "useProgressDashboard.ts", exps: ["useProgressDashboard"] },
    { file: "useFlashcards.ts", exps: ["useFlashcards"] },
    { file: "generate-quiz/index.ts", exps: ["normaliseSubject", "generateAIQuestions", "serve"] } // edge function
];

function ensureJSDoc(node: any, description: string) {
    if (!node.getJsDocs) return;
    const existing = node.getJsDocs();
    if (existing.length > 0) {
        existing[0].remove();
    }
    
    let paramsText = "";
    if (node.getParameters) {
        const params = node.getParameters();
        params.forEach((p: any) => {
            paramsText += `\n * @param ${p.getName()} - The ${p.getName()} parameter`;
        });
    }

    let returnText = "\n * @returns The expected return value based on function logic";
    if (node.getReturnTypeNode) {
        returnText = `\n * @returns {${node.getReturnTypeNode()?.getText() || 'any'}} The expected output`;
    }

    node.addJsDoc({
        description: `${description}\n * \n * **Side Effects:** Interacts with Supabase or external APIs.${paramsText}${returnText}`
    });
}

function processFile(pathToken: string, expectedFns: string[]) {
    const file = project.getSourceFiles().find(f => f.getFilePath().includes(pathToken));
    if (!file) return;

    // Functions
    file.getFunctions().forEach(fn => {
        const name = fn.getName();
        if (name && expectedFns.includes(name)) {
            ensureJSDoc(fn, `Core function: ${name}`);
        }
    });

    // Object literals (like aiGateway methods and hooks return objects)
    const objectLiterals = file.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
    for (const obj of objectLiterals) {
        obj.getProperties().forEach((prop: any) => {
            if (prop.getKind() === SyntaxKind.MethodDeclaration || prop.getKind() === SyntaxKind.PropertyAssignment) {
                const name = prop.getName();
                if (name && expectedFns.includes(name)) {
                    // For property assignments wrapping arrows
                    if (prop.getKind() === SyntaxKind.PropertyAssignment) {
                        const init = prop.getInitializer();
                        if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
                            // Can't directly add jsdoc to prop assignment safely in all ts-morph versions
                            // but we can add it to the statement if applicable
                        }
                    } else {
                        ensureJSDoc(prop, `Core method: ${name}`);
                    }
                }
            }
        });
    }

    // Inside hooks (Variable Declarations initialized with arrow functions that match)
    file.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(vd => {
        const name = vd.getName();
        if (name && expectedFns.includes(name)) {
            const stmt = vd.getFirstAncestorByKind(SyntaxKind.VariableStatement);
            if (stmt) {
                ensureJSDoc(stmt, `Hook utility or function: ${name}`);
            }
        }
    });
}

for (const target of targets) {
    processFile(target.file, target.exps);
}

// Special case for useFlashcards, useQuiz returns
// We want to document the returned methods too.
for (const file of project.getSourceFiles()) {
    file.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(vd => {
        const name = vd.getName();
        // Check if it's one of the internal hooks methods
        if (name && ["fetchCards", "fetchDueCards", "fetchStats", "createCard", "createFromQuizMistakes", "reviewCard", "deleteCard", "selectAnswer", "toggleFlag", "goToQuestion", "requestHint", "resetQuiz"].includes(name)) {
            const stmt = vd.getFirstAncestorByKind(SyntaxKind.VariableStatement);
            if (stmt) {
                ensureJSDoc(stmt, `Action handler: ${name}`);
            }
        }
    });
}

project.saveSync();
console.log("JSDocs injected successfully.");
