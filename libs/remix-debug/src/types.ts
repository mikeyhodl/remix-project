import type { CompilationSource, SourcesCode } from '@remix-project/remix-solidity' // eslint-disable-line

export interface LineColumnLocation {
    start: {
        line: number, column: number
    },
    end: {
        line: number, column: number
    }
}

export interface RawLocation {
    start: number, length: number
}

export interface Asts {
    [fileName: string] : CompilationSource // ast
}

export interface TransactionReceipt {
    blockHash: string
    blockNumber: number
    transactionHash: string
    transactionIndex: number
    from: string
    to: string
    contractAddress: string | null
  }

export type OffsetToLineColumnConverterFn = { offsetToLineColumn: (sourceLocation: RawLocation, file: number, contents: SourcesCode, asts: Asts) => Promise<LineColumnLocation> }
