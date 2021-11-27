export type Dict<T> = Record<string, T>;

export type CGNode = {
    id: any;
} & Dict<any>;
export type CGEdge = {
    id: any;
    nodeId1: any;
    nodeId2: any;
} & Dict<any>;
