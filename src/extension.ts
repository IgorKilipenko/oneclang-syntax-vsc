import type { ExtensionContext } from "vscode";
import { workspace } from "vscode";
import { SymbolReplacer } from "./features/replaceSymbols/symbolReplacer";

export const activate = (context: ExtensionContext) => {
    const replacer = new SymbolReplacer();

    workspace.onDidChangeTextDocument((event) => {
        replacer.replaceSpecSymbols(event);
    });
};

export const deactivate = () => {};
