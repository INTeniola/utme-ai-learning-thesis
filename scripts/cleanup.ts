import { Project, SyntaxKind, Node } from "ts-morph";
import * as fs from "fs";

const project = new Project({
    tsConfigFilePath: "tsconfig.json",
});

// Since some files might be linked in tsconfig.app or node, let's just add all src files
project.addSourceFilesAtPaths("src/**/*.ts");
project.addSourceFilesAtPaths("src/**/*.tsx");
project.addSourceFilesAtPaths("supabase/**/*.ts");

const unimportedComponents: string[] = [];

for (const sourceFile of project.getSourceFiles()) {
    // 1. Remove unused imports
    // ts-morph format & organizeImports removes unused imports
    sourceFile.organizeImports();
    
    // 2. Remove console.logs not in catch blocks
    if (!sourceFile.getFilePath().includes("logger.ts")) {
        const statementsToRemove = new Set<Node>();
        const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
        for (const call of calls) {
            // Check if call hasn't been removed (just in case)
            if (call.wasForgotten()) continue;
            
            const exp = call.getExpression();
            if (exp.getText() === "console.log") {
                // Check if any ancestor is a CatchClause
                let isCatch = false;
                let current: Node | undefined = call;
                while (current) {
                    if (current.getKind() === SyntaxKind.CatchClause) {
                        isCatch = true;
                        break;
                    }
                    current = current.getParent();
                }
                if (!isCatch) {
                    const stmt = call.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
                    if (stmt) statementsToRemove.add(stmt);
                }
            }
        }
        for (const stmt of statementsToRemove) {
            if (!stmt.wasForgotten()) stmt.remove();
        }
    }

    // 3. Find unimported component files
    // Heuristic: If it's in src/components, and the file's exports have 0 references 
    // outside this file, it might be unimported. We can just list them for the report.
    if (sourceFile.getFilePath().includes("src/components/")) {
        let hasExternalReference = false;
        
        // Find exported declarations
        const exportedDeclarations = sourceFile.getExportedDeclarations();
        for (const [name, declarations] of exportedDeclarations.entries()) {
            for (const dec of declarations) {
                if (Node.isReferenceFindable(dec)) {
                    const referencedSymbols = dec.findReferences();
                    for (const symbol of referencedSymbols) {
                        for (const ref of symbol.getReferences()) {
                            if (ref.getSourceFile().getFilePath() !== sourceFile.getFilePath()) {
                                hasExternalReference = true;
                            }
                        }
                    }
                }
            }
        }
        
        // If no named exports have external references, check default export
        if (!hasExternalReference && exportedDeclarations.size > 0) {
            unimportedComponents.push(sourceFile.getFilePath());
        }
    }
}

// Save all changes
project.saveSync();

// Output the list of unimported components
fs.writeFileSync("unimported_components.txt", unimportedComponents.join("\n"));
console.log("Cleanup complete. Unimported components saved to unimported_components.txt");
