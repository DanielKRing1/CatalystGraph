import { CGEdge, CGNode, Dict, GraphEntity, RatingMode } from "./types/graph";
import { SaveNode, SaveEdge, GetNode, GetEdge, GetEdgeId, UpdateNode, UpdateEdge, CGSetup, RateReturn } from "./types/methods";

// NAMING NODE/EDGE PROPERTIES

const SINGLE_SUFFIX: string = 'SINGLE';
const COLLECTIVE_SUFFIX: string = 'COLLECTIVE';
const AVERAGE_SUFFIX: string = 'AVG';
const TALLY_SUFFIX: string = 'TALLY';

const getSinglePropertyName = (rawName: string): string => `${rawName}_${SINGLE_SUFFIX}`;
const getCollectivePropertyName = (rawName: string): string => `${rawName}_${COLLECTIVE_SUFFIX}`;

const getCollectiveAverageName = (rawName: string): string => `${getCollectivePropertyName(rawName)}_${AVERAGE_SUFFIX}`;
const getCollectiveTallyName = (): string => `${COLLECTIVE_SUFFIX}_${TALLY_SUFFIX}`;

const getSingleAverageName = (rawName: string): string => `${getSinglePropertyName(rawName)}_${AVERAGE_SUFFIX}`;
const getSingleTallyName = (rawName: string): string => `${getSinglePropertyName(rawName)}_${TALLY_SUFFIX}`;

// BUILDING BASE NODE/EDGE

const genPropertiesObj = (properties: string[]): Dict<number> => {
    const propertiesObj: Dict<number> = {};

    // 1. Add each property's single average and tally
    //      and its collective average
    for(const rawName of properties) {
        const singleAvgName: string = getSingleAverageName(rawName);
        propertiesObj[singleAvgName] = 0;

        const singleTallyName: string = getSingleTallyName(rawName);
        propertiesObj[singleTallyName] = 0;

        const collectiveAvgName: string = getCollectiveAverageName(rawName);
        propertiesObj[collectiveAvgName] = 0;
    }

    // 2. Add a single collective tally
    const collectiveTallyName: string = getCollectiveTallyName();
    propertiesObj[collectiveTallyName] = 0;

    return propertiesObj;
}

export class CatalystGraph {
    propertyNames: string[];

    _saveNode: SaveNode;
    _saveEdge: SaveEdge;

    _getNode: GetNode;
    _getEdge: GetEdge;

    getEdgeId: GetEdgeId;

    updateNode: UpdateNode;
    updateEdge: UpdateEdge;

    constructor(args: CGSetup) {
        const { propertyNames, saveNode, saveEdge, getNode, getEdge, getEdgeId, updateNode, updateEdge } = args;

        this.propertyNames = propertyNames;

        this._saveNode = saveNode;
        this._saveEdge = saveEdge;

        this._getNode = getNode;
        this._getEdge = getEdge;
        this.getEdgeId = getEdgeId;

        this.updateNode = updateNode;
        this.updateEdge = updateEdge;
    }

    genNode(id: any, propertyNames: string[]): CGNode {
        const propertiesObj: Dict<number> = genPropertiesObj(propertyNames);
    
        return {
            id,
            ...propertiesObj,
        }
    }
    
    genEdge(nodeId1: any, nodeId2: any, propertyNames: string[]): CGEdge {
        const propertiesObj: Dict<number> = genPropertiesObj(propertyNames);
    
        const edgeId: any = this.getEdgeId(nodeId1, nodeId2);
        return {
            id: edgeId,
            nodeId1,
            nodeId2,
            ...propertiesObj,
        }
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

        switch(entityType) {
            case GraphEntity.CGNode:
                const nodeId: any = ids[0];
                graphEntity = this.genNode(nodeId, this.propertyNames);
            break;

            case GraphEntity.CGEdge:
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

        switch(entityType) {
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

        switch(entityType) {
            case GraphEntity.CGNode:
                const nodeId: any = ids[0];
                graphEntity = this._getNode(nodeId);
                if(!graphEntity) graphEntity = this.createAndSaveGraphEntity(ids, GraphEntity.CGNode);
            break;

            case GraphEntity.CGEdge:
                const edgeId: any = this.getEdgeId(ids[0], ids[1]);
                graphEntity = this._getEdge(edgeId);
                if(!graphEntity) graphEntity = this.createAndSaveGraphEntity(ids, GraphEntity.CGEdge);
            break;
        }

        return graphEntity;
    }

    rate(propertyName: string, nodeIds: any[], rating: number, weights: number[], ratingMode: RatingMode): RateReturn {
        // 1. Get CGNodes
        const nodesInitial: CGNode[] = nodeIds.map((id: any) => this.getGraphEntity([id], GraphEntity.CGNode));

        // 2.1. Update nodes
        const nodesUpdated: CGNode[] = ratingMode === RatingMode.Single ? this._rateSingle(propertyName, nodesInitial, rating, weights) : this._rateCollective(propertyName, nodesInitial, rating, weights);
        // 2.2. Apply node updates
        nodesUpdated.forEach((node: CGNode) => this.updateNode(node));

        // 3. Get all CGEdge combos
        const edgesInitial: CGEdge[] = [];
        const edgeWeights: number[] = [];
        for(let i = 0; i < nodeIds.length; i++) {
            for(let j = i+1; j < nodeIds.length; j++) {
                const nodeId1: any = nodeIds[i];
                const nodeId2: any = nodeIds[j];

                // 3.1. Track edge
                const edge: CGEdge = this.getGraphEntity([nodeId1, nodeId2], GraphEntity.CGEdge) as CGEdge;
                edgesInitial.push(edge);

                // 3.2. Track edge's weight
                const edgeWeight: number = (weights[i] + weights[j]) / 2;
                edgeWeights.push(edgeWeight);
            }
        }
        // 4.1. Update edges
        const edgesUpdated: CGEdge[] = (ratingMode == RatingMode.Single ? this._rateSingle(propertyName, edgesInitial, rating, edgeWeights) : this._rateCollective(propertyName, edgesInitial, rating, edgeWeights)) as CGEdge[];
        // 4.2. Apply edges updates
        edgesUpdated.forEach((edge: CGEdge) => this.updateEdge(edge));

        // Return graph entities with new state
        return {
            nodes: nodesUpdated,
            edges: edgesUpdated,
        };
    }

    _rateSingle(propertyName: string, graphEntities: CGNode[] | CGEdge[], rating: number, weights: number[]): CGNode[] | CGEdge[] {
        // 1. Get property names
        const propertyAvgName: string = getSingleAverageName(propertyName);
        const propertyTallyName: string = getSingleTallyName(propertyName);

        // 2. Sum weights
        const totalWeight: number = weights.reduce((sum: number, cur: number) => sum + cur, 0);

        graphEntities.forEach((graphEntity: CGNode | CGEdge, index: number) => {
            // 3. Get initial state
            const avg: number = graphEntity[propertyAvgName];
            const tally: number = graphEntity[propertyTallyName];

            // 4. Factor in weight
            const weight: number = weights[index] / totalWeight;
            const weightedRating: number = rating * weight;

            // 5. Update state
            graphEntity[propertyAvgName] = (avg * tally + weightedRating) / (tally + weight);
            graphEntity[propertyTallyName] += weight;
        });

        // Return graph entities with new state
        return graphEntities;
    }

    _rateCollective(propertyName: string, graphEntities: CGNode[] | CGEdge[], rating: number, weights: number[]) {
        // 1. Get property names
        const targetCollectiveAvgName: string = getCollectiveAverageName(propertyName);
        const allCollectiveAvgNames: string[] = this.propertyNames.map((propertyName) => getCollectiveAverageName(propertyName));
        const collectiveTallyName: string = getCollectiveTallyName();

        // 2. Sum weights
        const totalWeight: number = weights.reduce((sum: number, cur: number) => sum + cur, 0);

        // For each graph entity
        graphEntities.forEach((graphEntity: CGNode | CGEdge, index: number) => {
            // 3.1. Get initial state
            const tally: number = graphEntity[collectiveTallyName];
                
            const weight: number = weights[index] / totalWeight;

            // For each collective property
            allCollectiveAvgNames.forEach((collectiveAvgName: string) => {
                // 3.2. Get initial state
                const avg: number = graphEntity[collectiveAvgName];

                // 4. Factor in weight
                const weightedRating: number = collectiveAvgName == targetCollectiveAvgName ? weight * rating : 0;

                // 5.1. Update state
                graphEntity[collectiveAvgName] = (avg * tally + weightedRating) / (tally + weight);
            });

            // 5.2. Update state
            graphEntity[collectiveTallyName] += weight;
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
//     getEdgeId: (nodeId1: string, nodeId2) => [nodeId1, nodeId2].sort().join('-'),
    
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
