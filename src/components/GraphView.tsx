import { createEffect, createSignal, onMount, onCleanup, For } from 'solid-js';
import { Graph } from '@cosmos.gl/graph';
import { appStore } from '../stores/appStore';
import { settingsStore } from '../stores/settingsStore';
import './GraphView.css';
import { GraphConfigInterface } from '@cosmos.gl/graph/dist/config';

interface LabelPosition {
  x: number;
  y: number;
  title: string;
  visible: boolean;
  opacity: number;
}

export function GraphView() {
  let containerRef: HTMLDivElement | undefined;
  let graph: Graph | null = null;

  const [labels, setLabels] = createSignal<LabelPosition[]>([]);

  // Zoom threshold for labels to appear (adjust as needed)
  const LABEL_ZOOM_THRESHOLD = 0.8;  // Labels start appearing at this zoom
  const LABEL_ZOOM_FULL = 1.5;       // Labels fully visible at this zoom

  let nodeData: { uuid: string; title: string }[] = [];
  let nodeDegrees: Uint32Array = new Uint32Array(0);
  // Size scaling parameters:
  // - LOG_SCALE: controls the maximum growth factor
  // - DEGREE_THRESHOLD: edges below this have minimal size increase
  const LOG_SCALE = 0.4;
  const DEGREE_THRESHOLD = 5;

  const updateLabels = () => {
    if (!graph || nodeData.length === 0) return;

    // Get current zoom level from graph
    const currentZoom = graph.getZoomLevel();

    // Calculate opacity based on zoom level
    let labelOpacity = 0;
    if (currentZoom >= LABEL_ZOOM_THRESHOLD) {
      if (currentZoom >= LABEL_ZOOM_FULL) {
        labelOpacity = 1;
      } else {
        // Linear interpolation between threshold and full
        labelOpacity = (currentZoom - LABEL_ZOOM_THRESHOLD) / (LABEL_ZOOM_FULL - LABEL_ZOOM_THRESHOLD);
      }
    }

    // Don't update labels if they're not visible (optimization)
    if (labelOpacity === 0) {
      setLabels([]);
      return;
    }

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
          opacity: labelOpacity,
        });
      }
    });

    setLabels(newLabels);
  };

  onMount(() => {
    if (!containerRef) return;

    const gs = settingsStore.graphSettings();

    const graphConfig: GraphConfigInterface = {
      // Space and background
      spaceSize: 8192,
      backgroundColor: '#2d313a',

      // Rendering quality - higher pixelRatio reduces aliasing on edges
      pixelRatio: window.devicePixelRatio * 2,

      // Point styling
      pointDefaultSize: gs.pointSize,
      pointDefaultColor: '#4B5BBF',
      scalePointsOnZoom: true,
      renderHoveredPointRing: true,
      hoveredPointRingColor: '#4B5BBF',

      // Link styling
      linkDefaultWidth: gs.linkWidth,
      linkDefaultColor: '#5F74C2',
      linkDefaultArrows: gs.showArrows,
      linkArrowsSizeScale: gs.arrowSize,
      linkGreyoutOpacity: 0,
      curvedLinks: gs.curvedLinks,

      // Physics simulation
      simulationLinkDistance: gs.linkDistance,
      simulationLinkSpring: gs.linkSpring,
      simulationRepulsion: gs.repulsion,
      simulationGravity: gs.gravity,
      simulationFriction: gs.friction,
      simulationDecay: gs.decay,
      simulationCenter: gs.center,
      simulationRepulsionTheta: gs.repulsionTheta,
      simulationCluster: gs.cluster,

      // Interaction
      enableDrag: true,
      enableSimulationDuringZoom: true, // Keep simulation running during zoom/pan

      // View
      fitViewOnInit: true,
      fitViewDelay: 300,
      fitViewPadding: 0.1,

      // Labels
      pointSamplingDistance: 60,

      // Attribution
      attribution: '',

      // Callbacks
      onPointClick: (index: number) => {
        if (graph) {
          graph.selectPointByIndex(index);
          graph.zoomToPointByIndex(index);
          console.log('Clicked point index:', index);

          // Navigate to the note in editor
          const graphData = appStore.graphData();
          if (graphData && index < graphData.nodes.length) {
            const node = graphData.nodes[index];
            appStore.setSelectedFile(node.path);
            appStore.setViewMode('editor');
          }
        }
      },
      onBackgroundClick: () => {
        if (graph) {
          graph.unselectPoints();
        }
      },
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
      onDrag: () => {
        updateLabels();
      },
      onDragEnd: () => {
        updateLabels();
      },
    }

    graph = new Graph(containerRef, graphConfig);

    // Mac trackpad: make two-finger scroll pan instead of zoom
    // Pinch-to-zoom sends wheel events with ctrlKey=true (handled by d3-zoom as zoom)
    // Two-finger scroll sends wheel events without ctrlKey (we convert to pan)
    const canvas = containerRef.querySelector('canvas');
    if (canvas) {
      // Access the internal zoom instance (private but accessible at runtime)
      const graphAny = graph as any;
      const zoomBehavior = graphAny.zoomInstance?.behavior;
      const canvasSelection = graphAny.canvasD3Selection;

      if (zoomBehavior && canvasSelection) {
        canvas.addEventListener('wheel', (e: WheelEvent) => {
          // Only intercept non-pinch wheel events (two-finger scroll on Mac trackpad)
          // ctrlKey is true for pinch-to-zoom on Mac
          if (!e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();

            // Get current transform and apply translation
            const currentTransform = canvasSelection.node().__zoom;
            if (currentTransform) {
              const newTransform = currentTransform.translate(-e.deltaX / currentTransform.k, -e.deltaY / currentTransform.k);
              zoomBehavior.transform(canvasSelection, newTransform);
            }
          }
        }, { passive: false, capture: true });
      }
    }
  });

  onCleanup(() => {
    if (graph) {
      graph.destroy();
      graph = null;
    }
  });

  // React to settings changes
  createEffect(() => {
    if (!graph) return;
    const gs = settingsStore.graphSettings();
    const graphData = appStore.graphData();

    // Update physics simulation settings
    graph.setConfig({
      simulationGravity: gs.gravity,
      simulationLinkDistance: gs.linkDistance,
      simulationLinkSpring: gs.linkSpring,
      simulationRepulsion: gs.repulsion,
      simulationFriction: gs.friction,
      simulationDecay: gs.decay,
      simulationCenter: gs.center,
      simulationRepulsionTheta: gs.repulsionTheta,
      simulationCluster: gs.cluster,
      pointDefaultSize: gs.pointSize,
      linkDefaultWidth: gs.linkWidth,
      linkDefaultArrows: gs.showArrows,
      linkArrowsSizeScale: gs.arrowSize,
      curvedLinks: gs.curvedLinks,
    });

    // Update point sizes with degree-based scaling
    const numNodes = nodeData.length;
    if (numNodes > 0 && nodeDegrees.length === numNodes) {
      const baseSize = gs.pointSize;
      const sizes = new Float32Array(numNodes);
      for (let i = 0; i < numNodes; i++) {
        const degree = nodeDegrees[i];
        // Formula: size = baseSize * (1 + scale * log(1 + degree/threshold))
        // Low degree nodes barely grow, high degree nodes grow but plateau
        sizes[i] = baseSize * (1 + LOG_SCALE * Math.log(1 + degree / DEGREE_THRESHOLD));
      }
      graph.setPointSizes(sizes);
    }

    // Update arrows
    if (graphData) {
      const numLinks = graphData.edges.length;
      const arrowsArray = new Array(numLinks).fill(gs.showArrows);
      graph.setLinkArrows(arrowsArray);
    }

    graph.restart();
  });

  createEffect(() => {
    const graphData = appStore.graphData();
    if (!graph || !graphData || graphData.nodes.length === 0) return;

    console.log('Setting cosmos data:', graphData.nodes.length, 'nodes,', graphData.edges.length, 'edges');

    const numNodes = graphData.nodes.length;

    // Store node data for labels
    nodeData = graphData.nodes.map(node => {
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
    const centerPos = spaceSize / 2;
    const baseRadius = Math.min(200, 50 + numNodes * 5);
    const radius = Math.min(baseRadius, spaceSize * 0.1);

    for (let i = 0; i < numNodes; i++) {
      const angle = (i / numNodes) * 2 * Math.PI;
      const jitter = (Math.random() - 0.5) * 20;
      positions[i * 2] = centerPos + Math.cos(angle) * radius + jitter;
      positions[i * 2 + 1] = centerPos + Math.sin(angle) * radius + jitter;
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

    // Calculate node degrees (in + out edges) for size scaling
    nodeDegrees = new Uint32Array(numNodes);
    graphData.edges.forEach((edge) => {
      const srcIdx = uuidToIndex.get(edge.src_uuid);
      const dstIdx = uuidToIndex.get(edge.dst_uuid);
      if (srcIdx !== undefined) nodeDegrees[srcIdx]++;
      if (dstIdx !== undefined) nodeDegrees[dstIdx]++;
    });

    // Set point sizes with logarithmic scaling based on degree
    // Formula: size = baseSize * (1 + scaleFactor * log(1 + degree))
    // This prevents size explosion while still showing relative importance
    const gs = settingsStore.graphSettings();
    const baseSize = gs.pointSize;
    const sizes = new Float32Array(numNodes);
    for (let i = 0; i < numNodes; i++) {
      const degree = nodeDegrees[i];
      sizes[i] = baseSize * (1 + LOG_SCALE * Math.log(1 + degree / DEGREE_THRESHOLD));
    }

    // Set point colors (RGBA format, values 0-255) - #4B5BBF
    const colors = new Float32Array(numNodes * 4);
    for (let i = 0; i < numNodes; i++) {
      colors[i * 4] = 75;      // R
      colors[i * 4 + 1] = 91;  // G
      colors[i * 4 + 2] = 191; // B
      colors[i * 4 + 3] = 255; // A
    }

    // Set link colors - #5F74C2
    const numLinks = validLinks.length / 2;
    const linkColors = new Float32Array(numLinks * 4);
    for (let i = 0; i < numLinks; i++) {
      linkColors[i * 4] = 95;      // R
      linkColors[i * 4 + 1] = 116; // G
      linkColors[i * 4 + 2] = 194; // B
      linkColors[i * 4 + 3] = 200; // A
    }

    // Set link widths
    const linkWidthsArray = new Float32Array(numLinks).fill(gs.linkWidth);

    // Set link arrows
    const arrowsArray = new Array(numLinks).fill(gs.showArrows);

    console.log('Positions:', positions.length / 2, 'Links:', numLinks);

    // Set data - order matters!
    graph.setPointPositions(positions);
    graph.setPointSizes(sizes);
    graph.setPointColors(colors);
    graph.setLinks(links);
    graph.setLinkColors(linkColors);
    graph.setLinkWidths(linkWidthsArray);
    graph.setLinkArrows(arrowsArray);

    // Render and start simulation
    graph.zoom(0.9);
    graph.render();
  });

  return (
    <div class="graph-view">
      <div class="graph-info">
        <span>Nodes: {appStore.graphData()?.nodes.length || 0}</span>
        <span>Edges: {appStore.graphData()?.edges.length || 0}</span>
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
                opacity: label.opacity,
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
