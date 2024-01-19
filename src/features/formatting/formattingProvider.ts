import type {
    CancellationToken,
    DocumentFormattingEditProvider,
    FormattingOptions,
    ProviderResult,
    TextDocument,
} from "vscode";
import { Position as VscPosition, TextEdit, Range } from "vscode";
import { createParser, BslListener } from "bsl-parser";

export class FormattingProvider implements DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken,
    ): ProviderResult<TextEdit[]> {
        //- const detectIntentLevel = (line: string) => {
        //-     return /(?<=^\s+|^)\S/.exec(line)?.index ?? 0;
        //- };

        const documentText = document.getText();
        const parser = createParser(documentText);
        parser.addParseListener(new BslListener());

        const processEx = () => {
            const { parsingInfo } = parser.parseModule();

            const indentLevel = 1;
            const indentValue: string = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";

            const result: Array<TextEdit> = [];

            const formatRegions = (region: (typeof parsingInfo.activeContextQueue)[0]) => {
                const startPosition = new VscPosition(
                    (region.ctx.start?.line ?? 1) - 1,
                    region.ctx?.start?.column ?? 0,
                );
                const endPosition = new VscPosition(
                    (region.endCtx?.start?.line ?? 1) - 1,
                    region.endCtx?.start?.column ?? 0,
                );

                if (endPosition.line - startPosition.line <= 1) {
                    return;
                }

                console.assert(endPosition.character > 0);
                console.assert(
                    endPosition.line === startPosition.line
                        ? endPosition.character > startPosition.character
                        : endPosition.line > startPosition.line,
                );

                for (let line = startPosition.line + 1; line < endPosition.line; ++line) {
                    if (
                        !!region.childrenCtx?.length &&
                        region.childrenCtx.reduce<boolean>((res, curr) => {
                            return res && line > curr.ctx.start!.line - 1 && line < curr.endCtx!.start!.line - 1;
                        }, true)
                    ) {
                        continue;
                    }

                    const currIntents = document.lineAt(line).firstNonWhitespaceCharacterIndex;

                    result.push(
                        TextEdit.replace(
                            new Range(new VscPosition(line, 0), new VscPosition(line, currIntents)),
                            indentValue.repeat(indentLevel + region.innerIndex),
                        ),
                    );
                }
            };

            parsingInfo.activeContextQueue.forEach((region) => {
                region.isRegion && formatRegions(region);
            });
            return result;
        };

        return processEx();
    }

    format() {}
}
