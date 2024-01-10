import type { ExtensionContext } from "vscode";
import { languages, workspace } from "vscode";
import { SymbolReplacer } from "./features/replaceSymbols/symbolReplacer.js";
import { LanguageConfig } from "./config.js";
import { FormattingProvider } from "./features/formatting/formattingProvider.js";

export const activate = (context: ExtensionContext) => {
    const replacer = new SymbolReplacer();

    workspace.onDidChangeTextDocument((event) => {
        replacer.replaceSpecSymbols(event);
    });

    context.subscriptions.push(
        languages.registerDocumentFormattingEditProvider(LanguageConfig.bslDocumentSelector, new FormattingProvider()),
    );
};

export const deactivate = () => {};
