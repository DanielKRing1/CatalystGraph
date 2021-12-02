import { CGEdge, CGNode } from "./graph";

// USER-DEFINED METHODS
export type SaveNode = (node: CGNode) => void;
export type SaveEdge = (edge: CGEdge) => void;

export type GetNode = (nodeId: any) => CGNode;
export type GetEdge = (edgeId: any) => CGEdge;
export type GenEdgeId = (nodeId1: any, nodeId2: any) => any;

export type UpdateNode = (newNode: CGNode) => void;
export type UpdateEdge = (newEdge: CGEdge) => void;

// CLASS METHODS
export type CGSetup = {
    propertyNames: string[];
    saveNode: SaveNode;
    saveEdge: SaveEdge;
    getNode: GetNode;
    getEdge: GetEdge;
    genEdgeId: GenEdgeId;
    updateNode: UpdateNode;
    updateEdge: UpdateEdge
}
export type RateReturn = {
    nodes: CGNode[];
    edges: CGEdge[];
}