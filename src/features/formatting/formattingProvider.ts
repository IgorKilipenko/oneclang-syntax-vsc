import type {
    CancellationToken,
    DocumentFormattingEditProvider,
    FormattingOptions,
    ProviderResult,
    TextDocument,
} from "vscode";
import { Position as VscPosition, TextEdit, Range } from "vscode";
import type { BslRawFunction, IActiveContext } from "bsl-parser";
import { createParser, BslListener } from "bsl-parser";

export class FormattingProvider implements DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken,
    ): ProviderResult<TextEdit[]> {
        const documentText = document.getText();
        const parser = createParser(documentText);
        parser.addParseListener(new BslListener());

        const process = () => {
            const { parsingInfo } = parser.parseModule();

            const indentLevel = 1;
            const indentValue: string = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";

            const result: Array<TextEdit> = [];

            const formatFunction = (func: BslRawFunction) => {
                const result = { edits: new Array<TextEdit>(), lines: new Set<number>() };
                const start = func.parseContext.subCodeBlock().start;
                const stop = func.parseContext.subCodeBlock().stop;

                if (start === null || stop === null) {
                    return result;
                }

                start.line -= 1;
                stop.line -= 1;

                for (let line = start.line; line <= stop.line; ++line) {
                    result.lines.add(line);

                    const docLine = document.lineAt(line);
                    if (docLine.isEmptyOrWhitespace) {
                        continue;
                    }

                    const currIndents = docLine.firstNonWhitespaceCharacterIndex;

                    result.edits.push(
                        TextEdit.replace(
                            new Range(new VscPosition(line, 0), new VscPosition(line, currIndents)),
                            indentValue.repeat(indentLevel + (func.parseContext.indentIndex ?? 0)),
                        ),
                    );
                }

                return result;
            };

            const getRegionIgnoreLines = (region: IActiveContext): Set<number> => {
                return region.children?.reduce((res, curr) => {
                        const start = curr.regionStartContext.start?.line ?? null;
                        const stop = curr.regionEndContext?.start?.line ?? null;
                        if (start === null || stop === null) {
                            return res;
                        }

                        for (let line = start + 1; line < stop; ++line) {
                            res.add(line - 1);
                        }

                        return res;
                    }, new Set<number>()) ?? new Set<number>();
            };

            const formatRegion = (region: IActiveContext) => {
                const startPosition = new VscPosition(
                    (region.regionStartContext.start?.line ?? 1) - 1,
                    region.regionStartContext?.start?.column ?? 0,
                );
                const endPosition = new VscPosition(
                    (region.regionEndContext?.start?.line ?? 1) - 1,
                    region.regionEndContext?.start?.column ?? 0,
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

                const ignoreLines = getRegionIgnoreLines(region);

                if (region.innerIndex === 0) {
                    region.subs.forEach((func) => {
                        const formatResult = formatFunction(func);
                        result.push(...formatResult.edits);
                        formatResult.lines.forEach((line) => {
                            ignoreLines.add(line);
                        });
                    });
                }

                for (let line = startPosition.line + 1; line < endPosition.line; ++line) {
                    if (ignoreLines.has(line)) {
                        continue;
                    }

                    const docLine = document.lineAt(line);
                    const currIndents = docLine.firstNonWhitespaceCharacterIndex;
                    if (docLine.isEmptyOrWhitespace && currIndents > 0) {
                        result.push(TextEdit.replace(docLine.range, ""));
                        continue;
                    }

                    result.push(
                        TextEdit.replace(
                            new Range(new VscPosition(line, 0), new VscPosition(line, currIndents)),
                            indentValue.repeat(indentLevel + region.innerIndex),
                        ),
                    );
                }
            };

            parsingInfo.activeContextQueue.forEach((region) => {
                region.isRegion && formatRegion(region);
            });
            return result;
        };

        return process();
    }

    format() {}
}
