import type {
    CancellationToken,
    DocumentFormattingEditProvider,
    FormattingOptions,
    ProviderResult,
    TextDocument,
} from "vscode";

import { Position as VscPosition, TextEdit } from "vscode";

import type { BslParserRuleContext, BslRegionsTree } from "bsl-parser";

import { createParser, BslListener as BslListenerBase, TerminalNode, BslModule, BslSyntaxError } from "bsl-parser";

import type {
    FileCodeBlockContext,
    RegionStartContext,
    RegionEndContext,
    PreprocessorContext,
} from "bsl-parser/out/src/antlr/generated/BSLParser";

import { FileContext, RegionNameContext } from "bsl-parser/out/src/antlr/generated/BSLParser";

interface ActiveContext {
    ctx: BslParserRuleContext;
    innerIndex: number;
    isActive: boolean;
    isRegionStart?: boolean;
    endCtx?: BslParserRuleContext | null;
    childrenCtx?: Array<ActiveContext> | null;
    parentCtx?: ActiveContext | null;
}

class BslListener extends BslListenerBase {
    private _module: BslModule | null = null;

    private _regions = new Array<BslRegionsTree>();

    private readonly _activeContext: Array<ActiveContext> = [];

    private _syntaxErrors: Array<BslSyntaxError> | null = null;

    public override enterFile = (ctx: FileContext) => {
        this._module = new BslModule();
        this._activeContext.push({ ctx, innerIndex: 0, isActive: false });
    };

    public override exitFile = (ctx: FileContext) => {
        console.assert(this._activeContext.length > 0 && this._activeContext[0].isActive);

        const openedActiveCtx = this._activeContext.find(
            (activeCtx) => activeCtx.isActive && activeCtx.ctx instanceof FileContext,
        );
        if (!openedActiveCtx) {
            return;
        }
        openedActiveCtx.isActive = false;

        ctx.root = this._buildRegionsTree();
    };

    public override enterFileCodeBlock = (ctx: FileCodeBlockContext) => {
        console.debug({ ctx });
    };

    public override exitFileCodeBlock = (ctx: FileCodeBlockContext) => {
        console.debug({ ctx });
    };

    public override exitRegionStart = (ctx: RegionStartContext) => {
        const terminalNode: TerminalNode | null =
            ctx.children && ctx.children.length >= 2
                ? (ctx.children?.find((childCtx) => {
                    return (
                        childCtx instanceof TerminalNode &&
                        (childCtx as TerminalNode).symbol.text?.match(/^Область$/i)
                    );
                }) as TerminalNode | null)
                : null;

        if (terminalNode) {
            const innerIndex = this._activeContext.reduce<number>((res, cur) => {
                res += cur.isActive && cur.isRegionStart ? 1 : 0;
                return res;
            }, 0);

            const newActiveCtx: ActiveContext = { ctx, innerIndex, isActive: true, isRegionStart: true };
            this._activeContext.push(newActiveCtx);

            const parentCtx =
                innerIndex > 0
                    ? this._activeContext.findLast((activeCtx) => {
                        return (
                            activeCtx.isRegionStart && activeCtx.innerIndex === innerIndex - 1 && activeCtx.isActive
                        );
                    })
                    : null;

            if (parentCtx) {
                newActiveCtx.parentCtx = parentCtx;
                parentCtx.childrenCtx = parentCtx.childrenCtx ?? [];
                parentCtx.childrenCtx.push(newActiveCtx);
            }
        }
    };

    public override exitRegionEnd = (ctx: RegionEndContext) => {
        console.debug({ ctx });
        const terminalNode: TerminalNode | null = ctx.children?.find((childCtx) => {
            return childCtx instanceof TerminalNode && (childCtx as TerminalNode).symbol.text?.match(/^КонецОбласти$/i);
        }) as TerminalNode | null;

        if (!terminalNode) {
            return;
        }

        const openedActiveCtx = this._activeContext.findLast(
            (activeCtx) => activeCtx.isActive && activeCtx.isRegionStart,
        );
        if (!openedActiveCtx) {
            this._syntaxErrors = this._syntaxErrors ?? [new BslSyntaxError("Closing not opened region", ctx)];
            return;
        }

        openedActiveCtx.isActive = false;
        openedActiveCtx.endCtx = ctx;
    };

    public override exitPreprocessor = (ctx: PreprocessorContext) => {
        console.debug({ ctx });
    };

    private _buildRegionsTree() {
        return this._activeContext.filter((curr) => !curr.parentCtx);
    }
}

export class FormattingProvider implements DocumentFormattingEditProvider {
    provideDocumentFormattingEdits(
        document: TextDocument,
        options: FormattingOptions,
        token: CancellationToken,
    ): ProviderResult<TextEdit[]> {
        // throw new Error("Method not implemented.");

        const documentText = document.getText();
        let initialIndentLevel: number;
        let value: string;
        let rangeOffset: number;
        let indexValue: number;
        const editOperations: TextEdit[] = [];

        const parser = createParser(documentText);
        parser.addParseListener(new BslListener());

        const processEx = () => {
            const file = parser.file();
            const regions =
                file
                    .findAllNodes<RegionNameContext>((ctx) => {
                        return ctx instanceof RegionNameContext;
                    })
                    ?.map((item) => {
                        const region = item.parent?.parent;
                        console.assert(region);

                        const startPosition = new VscPosition(region?.start?.line ?? 0, region?.start?.column ?? 0);
                        const endPosition = new VscPosition(region?.stop?.line ?? 0, region?.stop?.column ?? 0);

                        console.assert(endPosition.character > 0);
                        console.assert(
                            endPosition.line === startPosition.line
                                ? endPosition.character > startPosition.character
                                : endPosition.line > startPosition.line,
                        );

                        return {
                            region,
                            startPosition,
                            endPosition,
                        };
                    }) ?? null;

            if (!regions) {
                return null;
            }

            const indentLevel = 1;
            const indentValue: string = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";

            const result: Array<TextEdit> = [];

            regions.forEach((region) => {
                for (let line = region.startPosition.line + 1; line < region.endPosition.line; ++line) {
                    result.push(TextEdit.insert(new VscPosition(line, 0), indentValue.repeat(indentLevel)));
                }
            });
            return result;
        };

        return processEx();
    }

    format() { }
}
