export type Dict<T> = Record<string, T>;

export type CGNode = {
    id: any;
    edgeIds: string[];
} & Dict<any>;
export type CGEdge = {
    id: any;
    nodeId1: any;
    nodeId2: any;
} & Dict<any>;

export enum GraphEntity {
    CGNode,
    CGEdge,
}

export enum RatingMode {
    Single,
    Collective,
}