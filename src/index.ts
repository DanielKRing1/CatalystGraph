import { CGEdge, CGNode, Dict, GraphEntity, RatingMode } from './types/graph';
import { SaveNode, SaveEdge, GetNode, GetEdge, GenEdgeId, UpdateNode, UpdateEdge, CGSetup, RateReturn } from './types/methods';
import { round } from './utils/rounding';

export * from './types';
export { RatingMode } from './types';

// NAMING NODE/EDGE PROPERTIES

export const GRAPH_ENTITY_ID_KEY: string = 'id';
export const EDGE_IDS_KEY: string = 'edgeIds';
export const SUFFIX_DELIM: string = '-';
const SINGLE_SUFFIX: string = 'SINGLE';
const COLLECTIVE_SUFFIX: string = 'COLLECTIVE';
const AVERAGE_SUFFIX: string = 'AVG';
const TALLY_SUFFIX: string = 'TALLY';

const genSinglePropertyName = (rawName: string): string => `${rawName}${SUFFIX_DELIM}${SINGLE_SUFFIX}`;
const genCollectivePropertyName = (rawName: string): string => `${rawName}${SUFFIX_DELIM}${COLLECTIVE_SUFFIX}`;

export const genCollectiveAverageName = (rawName: string): string => `${genCollectivePropertyName(rawName)}${SUFFIX_DELIM}${AVERAGE_SUFFIX}`;
export const genCollectiveTallyName = (): string => `${COLLECTIVE_SUFFIX}${SUFFIX_DELIM}${TALLY_SUFFIX}`;

export const genSingleAverageName = (rawName: string): string => `${genSinglePropertyName(rawName)}${SUFFIX_DELIM}${AVERAGE_SUFFIX}`;
export const genSingleTallyName = (rawName: string): string => `${genSinglePropertyName(rawName)}${SUFFIX_DELIM}${TALLY_SUFFIX}`;

// BUILDING BASE NODE/EDGE

export const genPropertiesObj = (properties: string[]): Dict<number> => {
    const propertiesObj: Dict<number> = {};

    // 1. Add each property's single average and tally
    //      and its collective average
    for (const rawName of properties) {
        const singleAvgName: string = genSingleAverageName(rawName);
        propertiesObj[singleAvgName] = 0;

        const singleTallyName: string = genSingleTallyName(rawName);
        propertiesObj[singleTallyName] = 0;

        const collectiveAvgName: string = genCollectiveAverageName(rawName);
        propertiesObj[collectiveAvgName] = 0;
    }

    // 2. Add a single collective tally
    const collectiveTallyName: string = genCollectiveTallyName();
    propertiesObj[collectiveTallyName] = 0;

    return propertiesObj;
};

export default class CatalystGraph {
    propertyPrecision: number;
    propertyNames: string[];

    _saveNode: SaveNode;
    _saveEdge: SaveEdge;

    _getNode: GetNode;
    _getEdge: GetEdge;

    genEdgeId: GenEdgeId;

    updateNode: UpdateNode;
    updateEdge: UpdateEdge;

    constructor(args: CGSetup) {
        const { propertyPrecision = 5, propertyNames, saveNode, saveEdge, getNode, getEdge, genEdgeId, updateNode, updateEdge } = args;

        this.propertyPrecision = propertyPrecision;
        this.propertyNames = propertyNames;

        this._saveNode = saveNode;
        this._saveEdge = saveEdge;

        this._getNode = getNode;
        this._getEdge = getEdge;
        this.genEdgeId = genEdgeId;

        this.updateNode = updateNode;
        this.updateEdge = updateEdge;
    }

    genNode(id: any, propertyNames: string[]): CGNode {
        const propertiesObj: Dict<number> = genPropertiesObj(propertyNames);

        return {
            id,
            edgeIds: [],
            ...propertiesObj,
        };
    }

    genEdge(nodeId1: any, nodeId2: any, propertyNames: string[]): CGEdge {
        const propertiesObj: Dict<number> = genPropertiesObj(propertyNames);

        const edgeId: any = this.genEdgeId(nodeId1, nodeId2);
        return {
            id: edgeId,
            nodeId1,
            nodeId2,
            ...propertiesObj,
        };
    }

    /**
     *  1 id for CGNodes
     *  2 ids for CGEdges
     *
     * @param ids
     * @param entityType
     * @returns
     */
    genGraphEntity(ids: any[], entityType: GraphEntity): CGNode | CGEdge {
        let graphEntity: CGNode | CGEdge;

        switch (entityType) {
            case GraphEntity.CGNode:
                const nodeId: any = ids[0];
                graphEntity = this.genNode(nodeId, this.propertyNames);
                break;

            case GraphEntity.CGEdge:
            default:
                const nodeId1: any = ids[0];
                const nodeId2: any = ids[1];
                graphEntity = this.genEdge(nodeId1, nodeId2, this.propertyNames);
                break;
        }

        return graphEntity;
    }

    /**
     * Provide:
     *  1 id for CGNodes
     *  2 ids for CGEdges
     *
     * @param ids
     * @param entityType
     * @returns
     */
    createAndSaveGraphEntity(ids: any[], entityType: GraphEntity): CGNode | CGEdge {
        const graphEntity: CGNode | CGEdge = this.genGraphEntity(ids, entityType);

        switch (entityType) {
            case GraphEntity.CGNode:
                this._saveNode(graphEntity as CGNode);
                break;

            case GraphEntity.CGEdge:
                this._saveEdge(graphEntity as CGEdge);
                break;
        }

        return graphEntity;
    }

    /**
     * Provide:
     *  1 id for CGNodes
     *  2 ids for CGEdges
     *
     * @param ids
     * @param entityType
     * @returns
     */
    getGraphEntity(ids: any[], entityType: GraphEntity): CGNode | CGEdge {
        let graphEntity: CGNode | CGEdge;

        switch (entityType) {
            case GraphEntity.CGNode:
                const nodeId: any = ids[0];
                graphEntity = this._getNode(nodeId);
                if (!graphEntity || Object.keys(graphEntity).length === 0) graphEntity = this.createAndSaveGraphEntity(ids, GraphEntity.CGNode);
                break;

            case GraphEntity.CGEdge:
            default:
                const edgeId: any = this.genEdgeId(ids[0], ids[1]);
                graphEntity = this._getEdge(edgeId);
                if (!graphEntity || Object.keys(graphEntity).length === 0) graphEntity = this.createAndSaveGraphEntity(ids, GraphEntity.CGEdge);
                break;
        }

        return graphEntity;
    }

    rate(propertyName: string, nodeIds: any[], rating: number, weights: number[], ratingMode: RatingMode): RateReturn {
        // EDGES

        // 1. Get all CGEdge combos
        const edgesInitial: CGEdge[] = [];
        const edgeWeights: number[] = [];
        // Map from each nodeId to all updated, connected edges
        const nodeUpdatedEdgeMap: Dict<string[]> = {};
        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                const nodeId1: any = nodeIds[i];
                const nodeId2: any = nodeIds[j];

                // 1.1. Track edge
                const edge: CGEdge = this.getGraphEntity([nodeId1, nodeId2], GraphEntity.CGEdge) as CGEdge;
                edgesInitial.push(edge);

                // 1.2. Track edge's weight
                const edgeWeight: number = (weights[i] + weights[j]) / 2;
                edgeWeights.push(edgeWeight);

                const edgeId: string = this.genEdgeId(nodeId1, nodeId2);
                // 1.3. Track edge associated with node1 and node2
                if (!nodeUpdatedEdgeMap[nodeId1]) nodeUpdatedEdgeMap[nodeId1] = [];
                if (!nodeUpdatedEdgeMap[nodeId2]) nodeUpdatedEdgeMap[nodeId2] = [];
                nodeUpdatedEdgeMap[nodeId1].push(edgeId);
                nodeUpdatedEdgeMap[nodeId2].push(edgeId);
            }
        }
        // 2.1. Update edge object properties
        // const totalEdgeWeight: number = edgeWeights.reduce((sum: number, cur: number) => sum + cur, 0);
        // const edgeWeightPercent: number[] = edgeWeights.map((edgeWeight: number) => edgeWeight / totalEdgeWeight);
        const edgesUpdated: CGEdge[] = (
            ratingMode == RatingMode.Single ? this._rateSingle(propertyName, edgesInitial, rating, edgeWeights) : this._rateCollective(propertyName, edgesInitial, rating, edgeWeights)
        ) as CGEdge[];
        // 2.2. Apply edges updates
        edgesUpdated.forEach((edge: CGEdge) => this.updateEdge(edge));

        // NODES

        // 3. Get CGNodes
        const nodesInitial: CGNode[] = nodeIds.map((id: any) => this.getGraphEntity([id], GraphEntity.CGNode)) as CGNode[];

        // 4. Update node's list of connected edge ids
        nodesInitial.forEach((node: CGNode) => {
            // 4.1. Get set of existing edge ids
            const allEdgeIds: Set<string> = new Set(node.edgeIds);

            // 4.2. Get set of updated edge ids
            const updatedEdgeIds: string[] = nodeUpdatedEdgeMap[node.id];

            // 4.3. Merge sets
            updatedEdgeIds.forEach((id: string) => allEdgeIds.add(id));
            // 4.4. Overwrite node's edgeIds with full, merged set
            node.edgeIds = Array.from(allEdgeIds);
        });

        // 5.1. Update node object properties
        const nodesUpdated: CGNode[] = (
            ratingMode === RatingMode.Single ? this._rateSingle(propertyName, nodesInitial, rating, weights) : this._rateCollective(propertyName, nodesInitial, rating, weights)
        ) as CGNode[];
        // 5.2. Apply node updates
        nodesUpdated.forEach((node: CGNode) => this.updateNode(node));

        // Return graph entities with new state
        return {
            nodes: nodesUpdated,
            edges: edgesUpdated,
        };
    }

    _rateSingle(propertyName: string, graphEntities: CGNode[] | CGEdge[], rating: number, weights: number[]): CGNode[] | CGEdge[] {
        // 1. Get property names
        const propertyAvgName: string = genSingleAverageName(propertyName);
        const propertyTallyName: string = genSingleTallyName(propertyName);

        graphEntities.forEach((graphEntity: CGNode | CGEdge, index: number) => {
            // 2. Get initial state
            const avg: number = graphEntity[propertyAvgName];
            const tally: number = graphEntity[propertyTallyName];

            // 3. Factor in weight
            const weight: number = weights[index];
            const weightedRating: number = rating * weight;

            // 4. Update state
            const newTally: number = round(tally + weight, this.propertyPrecision);
            //      If undoing a rating, newTally may equal 0; do not divide by 0
            if(newTally === 0) graphEntity[propertyAvgName] = 0
            else graphEntity[propertyAvgName] = round((avg * tally + weightedRating) / (tally + weight), this.propertyPrecision);
            graphEntity[propertyTallyName] = newTally;
        });

        // Return graph entities with new state
        return graphEntities;
    }

    _rateCollective(propertyName: string, graphEntities: CGNode[] | CGEdge[], rating: number, weights: number[]) {
        // 1. Get property names
        const targetCollectiveAvgName: string = genCollectiveAverageName(propertyName);
        const allCollectiveAvgNames: string[] = this.propertyNames.map((propertyName) => genCollectiveAverageName(propertyName));
        const collectiveTallyName: string = genCollectiveTallyName();

        // For each graph entity
        graphEntities.forEach((graphEntity: CGNode | CGEdge, index: number) => {
            const weight: number = weights[index];

            // 2.1. Get initial state
            const tally: number = graphEntity[collectiveTallyName];
            const newTally: number = round(tally + weight, this.propertyPrecision);

            // For each collective property
            allCollectiveAvgNames.forEach((collectiveAvgName: string) => {
                // 2.2. Get initial state
                const avg: number = graphEntity[collectiveAvgName];

                // 3. Factor in weight
                const weightedRating: number = collectiveAvgName == targetCollectiveAvgName ? weight * rating : 0;

                // 4.1. Update state
                //      If undoing a rating, newTally may equal 0; do not divide by 0
                if(newTally === 0) graphEntity[collectiveAvgName] = 0
                else graphEntity[collectiveAvgName] = round((avg * tally + weightedRating) / newTally, this.propertyPrecision);
            });

            // 4.2. Update state
            graphEntity[collectiveTallyName] = newTally;
        });

        // Return graph entities with new state
        return graphEntities;
    }
}

// const allNodes: Dict<CGNode> = {};
// const allEdges: Dict<CGEdge> = {};

// const params: CGSetup = {
//     propertyNames: [ 'fulfilled', 'depressed', 'bored' ],

//     saveNode: (newNode: CGNode) => allNodes[newNode.id] = newNode,
//     saveEdge: (newEdge: CGEdge) => allEdges[newEdge.id] = newEdge,

//     getNode: (nodeId: string) => allNodes[nodeId],
//     getEdge: (edgeId: string) => allEdges[edgeId],
//     genEdgeId: (nodeId1: string, nodeId2) => [nodeId1, nodeId2].sort().join('-'),

//     updateNode: (newNode: CGNode) => allNodes[newNode.id] = newNode,
//     updateEdge: (newEdge: CGEdge) => allEdges[newEdge.id] = newEdge,
// };
// const graph: CatalystGraph = new CatalystGraph(params);

// graph.rate('fulfilled', ['eating', 'sleeping', 'basketball', 'tv'], 8, [1,1,1,1], RatingMode.Single);
// graph.rate('fulfilled', ['eating', 'sleeping', 'basketball', 'tv'], 8, [1,1,1,1], RatingMode.Collective);

// graph.rate('depressed', ['eating', 'sleeping', 'tv'], 8, [1,1,1], RatingMode.Single);
// graph.rate('depressed', ['eating', 'sleeping', 'tv'], 8, [1,1,1], RatingMode.Collective);

// graph.rate('bored', ['eating', 'tv'], 5, [1,1], RatingMode.Single);
// graph.rate('bored', ['eating', 'tv'], 5, [1,1], RatingMode.Collective);

// graph.rate('fulfilled', ['sleeping', 'basketball', 'tv'], 6, [1,1,1], RatingMode.Single);
// graph.rate('fulfilled', ['sleeping', 'basketball', 'tv'], 6, [1,1,1], RatingMode.Collective);

// console.log(allNodes);
// console.log(allEdges);
