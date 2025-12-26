import { createEffect, createSignal, onMount, onCleanup, For } from 'solid-js';
import { Graph } from '@cosmos.gl/graph';
import { appStore } from '../stores/appStore';
import './GraphView.css';

interface LabelPosition {
  x: number;
  y: number;
  title: string;
  visible: boolean;
}

export function GraphView() {
  let containerRef: HTMLDivElement | undefined;
  let graph: Graph | null = null;

  const [gravity, setGravity] = createSignal(0.25);
  const [linkDistance, setLinkDistance] = createSignal(10);
  const [linkWidth, setLinkWidth] = createSignal(1);
  const [labels, setLabels] = createSignal<LabelPosition[]>([]);

  let nodeData: { uuid: string; title: string }[] = [];

  const updateLabels = () => {
    if (!graph || nodeData.length === 0) return;

    const sampledPoints = graph.getSampledPointPositionsMap();

    const newLabels: LabelPosition[] = [];

    // Show labels for sampled points (visible ones that are not too close)
    sampledPoints.forEach((pos, index) => {
      if (index < nodeData.length) {
        const screenPos = graph!.spaceToScreenPosition(pos);
        newLabels.push({
          x: screenPos[0],
          y: screenPos[1],
          title: nodeData[index].title,
          visible: true,
        });
      }
    });

    setLabels(newLabels);
  };

  onMount(() => {
    if (!containerRef) return;

    graph = new Graph(containerRef, {
      backgroundColor: '#1e1e1e',
      pointColor: '#007acc',
      pointSize: 8,
      linkColor: '#888888',
      linkWidth: 2,
      renderLinks: true,
      linkVisibilityDistanceRange: [0, 10000],
      linkVisibilityMinTransparency: 1,
      simulationGravity: gravity(),
      simulationRepulsion: 0.5,
      simulationLinkSpring: 1.0,
      simulationLinkDistance: linkDistance(),
      simulationFriction: 0.85,
      fitViewOnInit: true,
      fitViewDelay: 500,
      fitViewPadding: 0.2,
      renderHoveredPointRing: true,
      hoveredPointRingColor: '#ffffff',
      disableAttribution: true,
      pointSamplingDistance: 80,
      onSimulationTick: () => {
        updateLabels();
      },
      onSimulationEnd: () => {
        console.log('Simulation ended');
        updateLabels();
      },
      onZoom: () => {
        updateLabels();
      },
      onZoomEnd: () => {
        updateLabels();
      },
    });
  });

  onCleanup(() => {
    if (graph) {
      graph.destroy();
      graph = null;
    }
  });

  const handleGravityChange = (e: Event) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    setGravity(value);
    if (graph) {
      graph.setConfig({ simulationGravity: value });
      graph.restart();
    }
  };

  const handleLinkDistanceChange = (e: Event) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    setLinkDistance(value);
    if (graph) {
      graph.setConfig({ simulationLinkDistance: value });
      graph.restart();
    }
  };

  const handleLinkWidthChange = (e: Event) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    setLinkWidth(value);
    if (graph) {
      graph.setConfig({ linkWidth: value });
      // Also update link widths array
      const graphData = appStore.graphData();
      if (graphData && graphData.edges.length > 0) {
        const numLinks = graphData.edges.length;
        const linkWidthsArray = new Float32Array(numLinks).fill(value);
        graph.setLinkWidths(linkWidthsArray);
      }
    }
  };

  createEffect(() => {
    const graphData = appStore.graphData();
    if (!graph || !graphData || graphData.nodes.length === 0) return;

    console.log('Setting cosmos data:', graphData.nodes.length, 'nodes,', graphData.edges.length, 'edges');

    const numNodes = graphData.nodes.length;

    // Store node data for labels - use filename instead of parsed title
    nodeData = graphData.nodes.map(node => {
      // Extract filename from path (e.g., "folder/note.md" -> "note")
      const filename = node.path.split('/').pop()?.replace('.md', '') || 'Untitled';
      return {
        uuid: node.uuid,
        title: filename,
      };
    });

    // Build UUID to index map
    const uuidToIndex = new Map<string, number>();
    graphData.nodes.forEach((node, i) => {
      uuidToIndex.set(node.uuid, i);
    });

    // Generate initial positions in a circle
    const positions = new Float32Array(numNodes * 2);
    const spaceSize = 8192;
    const center = spaceSize / 2;
    const radius = spaceSize * 0.3;

    for (let i = 0; i < numNodes; i++) {
      const angle = (i / numNodes) * 2 * Math.PI;
      positions[i * 2] = center + Math.cos(angle) * radius;
      positions[i * 2 + 1] = center + Math.sin(angle) * radius;
    }

    // Build links as Float32Array of indices
    const validLinks: number[] = [];
    graphData.edges.forEach((edge) => {
      const srcIdx = uuidToIndex.get(edge.src_uuid);
      const dstIdx = uuidToIndex.get(edge.dst_uuid);
      if (srcIdx !== undefined && dstIdx !== undefined) {
        validLinks.push(srcIdx, dstIdx);
      }
    });
    const links = new Float32Array(validLinks);

    // Set point sizes
    const sizes = new Float32Array(numNodes).fill(8);

    // Set point colors (RGBA format, values 0-255)
    const colors = new Float32Array(numNodes * 4);
    for (let i = 0; i < numNodes; i++) {
      colors[i * 4] = 0;       // R
      colors[i * 4 + 1] = 122; // G
      colors[i * 4 + 2] = 204; // B
      colors[i * 4 + 3] = 255; // A
    }

    // Set link colors (make them more visible)
    const numLinks = validLinks.length / 2;
    const linkColors = new Float32Array(numLinks * 4);
    for (let i = 0; i < numLinks; i++) {
      linkColors[i * 4] = 120;     // R
      linkColors[i * 4 + 1] = 120; // G
      linkColors[i * 4 + 2] = 120; // B
      linkColors[i * 4 + 3] = 255; // A - full opacity
    }

    // Set link widths
    const linkWidthsArray = new Float32Array(numLinks).fill(linkWidth());

    console.log('Positions:', positions.length / 2, 'Links:', numLinks);

    // Set data - order matters!
    graph.setPointPositions(positions);
    graph.setPointSizes(sizes);
    graph.setPointColors(colors);
    graph.setLinks(links);
    graph.setLinkColors(linkColors);
    graph.setLinkWidths(linkWidthsArray);

    // Render and start simulation
    graph.render(1);
  });

  return (
    <div class="graph-view">
      <div class="graph-info">
        <span>Nodes: {appStore.graphData()?.nodes.length || 0}</span>
        <span>Edges: {appStore.graphData()?.edges.length || 0}</span>
      </div>

      <div class="graph-controls">
        <div class="control-item">
          <label>引力 (Gravity): {gravity().toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={gravity()}
            onInput={handleGravityChange}
          />
        </div>
        <div class="control-item">
          <label>边长度 (Link Distance): {linkDistance()}</label>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={linkDistance()}
            onInput={handleLinkDistanceChange}
          />
        </div>
        <div class="control-item">
          <label>边宽度 (Link Width): {linkWidth().toFixed(1)}</label>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={linkWidth()}
            onInput={handleLinkWidthChange}
          />
        </div>
      </div>

      <div ref={containerRef} class="graph-container"></div>

      <div class="graph-labels">
        <For each={labels()}>
          {(label) => (
            <div
              class="node-label"
              style={{
                left: `${label.x}px`,
                top: `${label.y}px`,
              }}
            >
              {label.title}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
