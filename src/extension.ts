import { ExtensionContext, Position, Range, TextDocumentChangeEvent, window, workspace, WorkspaceConfiguration } from 'vscode';

interface ReplacePattern {
    from: RegExp,
    to: string,
    removeFirstCount?: number
    removeLastCount?: number
}

const replacePatterns: Array<ReplacePattern> = [
    { from: /^БЮ$/, to: "<>" },
    { from: /^\!\=$/, to: "<>" },
    { from: /^б$/, to: ",", removeFirstCount: 1 },
    { from: /^Б$/, to: "<" },
    { from: /^Ю$/, to: ">" },
    { from: /^х$/, to: "[]", removeFirstCount: 1, removeLastCount: 1 },
    { from: /^ъ$/, to: "]", removeLastCount: 1 },
    { from: /^Х$/, to: "{}", removeFirstCount: 1, removeLastCount: 1 },
    { from: /^Ъ$/, to: "}", removeLastCount: 1 },
    { from: /^ж$/, to: ";", removeFirstCount: 1, removeLastCount: 1 },
    { from: /^\?$/, to: "&", removeLastCount: 1 },
    { from: /^Э$/, to: "\"" },
    { from: /^\/$/, to: "|" },
    { from: /^№[Оо]бласть$/, to: "#Область" }
];

export function activate(_context: ExtensionContext) {
    workspace.onDidChangeTextDocument(event => {
        correctTheWord(event);
    });
}

export function deactivate() { }

function correctTheWord(event: TextDocumentChangeEvent): void {
    if (!event.contentChanges.length) {
        return;
    }

    if (!/[\s]/.test(event.contentChanges[0].text)) {
        return;
    }

    const editor = window.activeTextEditor;
    if (!editor) {
        return;
    }

    const { selection } = editor;
    const originalPosition = selection.start.translate(0, 1);
    const text = editor.document.getText(
        new Range(new Position(originalPosition.line, 0), originalPosition)
    );

    const match = /(?<=\s+|^)[^\s]+(?=\s+$)/.exec(text);
    if (!match) {
        return;
    }

    const startPositionIndex = match.index;
    const startPosition = new Position(originalPosition.line, startPositionIndex);
    const endPosition = new Position(originalPosition.line, startPositionIndex + match[0].length);

    replacePatterns.forEach(p => {
        if (!p.from.test(match[0])) {
            return;
        }

        editor.edit(builder => {
            const contentChangeRange = new Range(p.removeFirstCount ? startPosition.translate(0, -p.removeFirstCount) : startPosition,
                p.removeLastCount ? endPosition.translate(0, p.removeLastCount) : endPosition);
            builder.replace(contentChangeRange, p.to);
        })
    });
}

