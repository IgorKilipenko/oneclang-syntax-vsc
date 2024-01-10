import type { DocumentSelector } from "vscode";

export class LanguageConfig {
    static get bslDocumentSelector() {
        return "bsl" as DocumentSelector;
    }
}
