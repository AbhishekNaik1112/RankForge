from __future__ import annotations

from collections.abc import Mapping


def compute_pagerank(
    graph: Mapping[str, list[str]],
    *,
    damping: float = 0.85,
    iterations: int = 30,
) -> dict[str, float]:
    # Ensure all nodes exist in node set (including nodes that only appear as targets)
    nodes: set[str] = set(graph.keys())
    for outs in graph.values():
        nodes.update(outs)

    node_list = list(nodes)
    n = len(node_list)
    if n == 0:
        return {}

    pr = {node: 1.0 / n for node in node_list}

    # Precompute outlinks (ensure every node is present)
    outlinks: dict[str, list[str]] = {node: [] for node in node_list}
    for src, outs in graph.items():
        outlinks[src] = list(outs)

    for _ in range(iterations):
        new_pr = {node: (1.0 - damping) / n for node in node_list}

        # Total PageRank mass from dangling nodes
        dangling_mass = sum(pr[node] for node in node_list if len(outlinks[node]) == 0)
        dangling_share = damping * dangling_mass / n

        # Distribute dangling share uniformly
        for node in node_list:
            new_pr[node] += dangling_share

        # Distribute rank through links
        for src in node_list:
            outs = outlinks[src]
            if not outs:
                continue
            share = damping * pr[src] / len(outs)
            for dst in outs:
                new_pr[dst] += share

        pr = new_pr

    return pr
