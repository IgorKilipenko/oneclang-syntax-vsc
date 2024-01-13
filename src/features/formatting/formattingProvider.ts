import type {
    CancellationToken,
    DocumentFormattingEditProvider,
    FormattingOptions,
    ProviderResult,
    TextDocument,
} from "vscode";

import { Position as VscPosition, TextEdit } from "vscode";

import type { BslParserRuleContext} from "bsl-parser";
import { createParser, BslListener as BslListenerBase, TerminalNode, BslModule, BslSyntaxError, BslRawRegion } from "bsl-parser";

import type {
    RegionStartContext,
    RegionEndContext,
} from "bsl-parser/out/src/antlr/generated/BSLParser";

import { FileContext, RegionNameContext } from "bsl-parser/out/src/antlr/generated/BSLParser";

interface ActiveContext {
    ctx: BslParserRuleContext;
    innerIndex: number;
    isActive: boolean;
    isRegion?: boolean;
    endCtx?: BslParserRuleContext | null;
    childrenCtx?: Array<ActiveContext> | null;
    parentCtx?: ActiveContext | null;
}

class BslListener extends BslListenerBase {
    private _module: BslModule | null = null;

    private readonly _regions = new Array<BslRawRegion>();

    private readonly _activeContext: Array<ActiveContext> = [];

    private _syntaxErrors: Array<BslSyntaxError> | null = null;

    public override enterFile = (ctx: FileContext) => {
        this._module = new BslModule();
        this._activeContext.push({ ctx, innerIndex: 0, isActive: true } as ActiveContext);
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

        ctx.regions = this._buildRegionsTree();
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
                res += cur.isActive && cur.isRegion ? 1 : 0;
                return res;
            }, 0);

            const newActiveCtx: ActiveContext = { ctx, innerIndex, isActive: true, isRegion: true };
            this._activeContext.push(newActiveCtx);

            const parentCtx =
                innerIndex > 0
                    ? this._activeContext.findLast((activeCtx) => {
                          return activeCtx.isRegion && activeCtx.innerIndex === innerIndex - 1 && activeCtx.isActive;
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

        const openedActiveCtx = this._activeContext.findLast((activeCtx) => activeCtx.isActive && activeCtx.isRegion);
        if (!openedActiveCtx) {
            this._syntaxErrors = this._syntaxErrors ?? [new BslSyntaxError("Closing not opened region", ctx)];
            return;
        }

        openedActiveCtx.isActive = false;
        openedActiveCtx.endCtx = ctx;
    };

    private _buildRegionsTree() {
        const convertToRawRegion = (ctx: ActiveContext, parent: BslRawRegion | null = null): BslRawRegion => {
            const start = ctx.ctx as RegionStartContext;
            const end = ctx.endCtx as RegionEndContext;
            const name =
                ctx.ctx && ctx.ctx.children && ctx.ctx.children.length >= 2
                    ? (ctx.ctx.children.find((c) => c instanceof RegionNameContext) as RegionNameContext) ?? null
                    : null;
            const innerIndex = ctx.innerIndex;

            const region = new BslRawRegion({
                start,
                end,
                name,
                innerIndex,
                parent,
                regions: ctx.childrenCtx?.length ? [] : null,
            });

            region.regions &&
                ctx.childrenCtx?.forEach((c) => {
                    region.regions?.push(convertToRawRegion(c, region));
                });

            return region;
        };

        //return this._activeContext.filter((curr) => !curr.parentCtx).map((reg) => {});
        return this._activeContext
            .filter((ctx) => ctx.isRegion && !ctx.parentCtx)
            .map((ctx) => convertToRawRegion(ctx));
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
                file.regions?.map((region) => {
                    const startPosition = new VscPosition(
                        region.start?.start?.line ?? 0,
                        region.start?.start?.column ?? 0,
                    );
                    const endPosition = new VscPosition(region.end?.start?.line ?? 0, 0);

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
                for (let line = region.startPosition.line + 1; line < region.endPosition.line - 1; ++line) {
                    result.push(TextEdit.insert(new VscPosition(line, 0), indentValue.repeat(indentLevel)));
                }
            });
            return result;
        };

        return processEx();
    }

    format() {}
}
