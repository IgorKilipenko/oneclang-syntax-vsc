import type {
    CancellationToken,
    DocumentFormattingEditProvider,
    FormattingOptions,
    Position,
    ProviderResult,
    TextDocument,
    TextEdit,
} from "vscode";

import { createParser } from "bsl-parser";

//const BslParser = require("bsl-parser");

class BslParser1 {
    private readonly exportKeyword = "Экспорт";

    private readonly funcDefKeywords = {
        beginBlockWord: "Функция",
        endBlockWord: "КонецФункции",
    };

    //private readonly funcParamsPattern = /[\w\s,_-\(\)\*,]*/;

    //private readonly _beginPattern = new RegExp(
    //    /(?<funcType>Функция|Процедура)\s(?<funcName>[_$[:alpha:]][_$[:alnum:]]*\b)(?:\s*)(?:\(\s*)/.source +
    //        this.funcParamsPattern.source,
    //);

    //isFunctionDefinition(text: string): Position | null {
    //    return null;
    //};
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

        const parser = createParser(`
            Процедура Тест1() Экспорт
                переменная1 = Истина;
                Если переменная1 Тогда
                    Сообщить("Сообщение");
                КонецЕсли;
            КонецПроцедуры
        `);

        const file = parser.procedure();

        return null;
    }
}
