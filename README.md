# CatalystGraph

## What is this?

A tool for relating nodes by a predefined set of properties.

## What kind of graph?

This tool produces a graph tracking the weight of each node and of each pair of nodes (edge) to produce some output property:

Properties = [ 'happy', 'sad', 'bored' ]

```
Eating Node {                             Eating-Basketball Edge {                    Basketball Node {
  happyWeight: 0.5,         linked to       happyWeight: 0.85,          linked to       happyWeight: 0.75,
  sadWeight: 0.5,             <----         sadWeight: 0.25,              ---->         sadWeight: 0.25,
  boredWeight: 0.25,                        boredWeight: 0.25,                          boredWeight: 0.1,
}                                         }                                           }
```

## How it works

1. The user rates a set of activities (nodes) by providing the output (property) that the set produced, as well as an 'intensity rating' of the produced output:
      nodes = [ 'eating', basketball' ]
      produced output = 'happy'
      intensity rating = 8
      
2. CatalystGraph updates each individual node's weight for producing the given output:
```
      Eating Node {                       Eating Node {
        happyWeight: *0.5*,    becomes      happyWeight: *0.6*,
        sadWeight: 0.5,         ---->       sadWeight: 0.5,
        boredWeight: 0.25,                  boredWeight: 0.25,
      }                                   }
      
      Basketball Node {                   Basketball Node {
        happyWeight: *0.75*,   becomes      happyWeight: *0.775*,
        sadWeight: 0.25,        ---->       sadWeight: 0.25,
        boredWeight: 0.1,                   boredWeight: 0.1,
      }                                   }
```
      
3. CatalystGraph then updates each pair of nodes's (each edge) weight for producing the given output:
```
      Eating-Basketball Edge {            Eating-Basketball Edge {
        happyWeight: *0.85*,   becomes      happyWeight: *0.825*,
        sadWeight: 0.25,        ---->       sadWeight: 0.25,
        boredWeight: 0.25,                  boredWeight: 0.25,
      }                                   }
```
      
4. CatalystGraph now has an up-to-date weight of each node (and of each edge) to produce some output.
    This graph can then be traversed to find relations between nodes

*Notice that the Eating-Basketball edge can have a 'happyRating' weight greater than the weight of either individual Eating or Basketball node. This is bcus the edge's 'happyRating' weight is only ever updated when the user rates the pair of Eating and Basketball together.
*In short, individual Nodes and Edges can tell vastly different stories.
