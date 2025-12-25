import { createEffect, onCleanup, onMount } from 'solid-js';
import { Graph, CosmosInputNode, CosmosInputLink } from '@cosmograph/cosmos';
import { appStore } from '../stores/appStore';
import './GraphView.css';

export function GraphView() {
  let canvasRef: HTMLCanvasElement | undefined;
  let graph: Graph<CosmosInputNode, CosmosInputLink> | undefined;

  onMount(() => {
    if (canvasRef) {
      graph = new Graph(canvasRef, {
        backgroundColor: '#1e1e1e',
        nodeColor: '#007acc',
        nodeSize: 8,
        linkColor: '#4a4a4a',
        linkWidth: 1,
        linkArrows: false,
        simulationGravity: 0.2,
        simulationCenter: 0.5,
        simulationRepulsion: 1,
        simulationLinkSpring: 0.3,
        renderLinks: true,
        spaceSize: 4096,
      });

      // Handle node clicks
      graph.onClick((clickedNode) => {
        if (clickedNode) {
          const graphData = appStore.graphData();
          const node = graphData?.nodes.find((n) => n.uuid === clickedNode.id);
          if (node) {
            appStore.setSelectedFile(node.path);
            appStore.setViewMode('editor');
          }
        }
      });
    }
  });

  onCleanup(() => {
    graph?.destroy();
  });

  createEffect(() => {
    const graphData = appStore.graphData();
    if (graph && graphData) {
      // Convert nodes to Cosmos format
      const nodes: CosmosInputNode[] = graphData.nodes.map((node) => ({
        id: node.uuid,
        label: node.title || node.path,
      }));

      // Convert edges to Cosmos format
      const links: CosmosInputLink[] = graphData.edges.map((edge) => ({
        source: edge.src_uuid,
        target: edge.dst_uuid,
      }));

      graph.setData(nodes, links);
    }
  });

  return (
    <div class="graph-view">
      <div class="graph-info">
        <span>Nodes: {appStore.graphData()?.nodes.length || 0}</span>
        <span>Edges: {appStore.graphData()?.edges.length || 0}</span>
      </div>
      <canvas ref={canvasRef} class="graph-canvas"></canvas>
    </div>
  );
}
