/**
 * @fileoverview 知识图谱可视化组件
 *
 * 本模块提供基于 Cosmos.gl 的交互式图谱可视化功能，用于展示笔记之间的链接关系。
 *
 * @module components/GraphView
 *
 * @features
 * - WebGL 高性能渲染
 * - 力导向图布局
 * - 节点点击导航到编辑器
 * - 缩放时显示节点标签
 * - Mac 触控板手势支持
 * - 动态节点大小（基于连接度）
 *
 * @example
 * ```tsx
 * import { GraphView } from './components/GraphView';
 *
 * <GraphView />
 * ```
 *
 * @exports GraphView - 图谱可视化组件
 */

import { createEffect, createSignal, onMount, onCleanup, For } from 'solid-js';
import { Graph } from '@cosmos.gl/graph';
import { appStore } from '../stores/appStore';
import { settingsStore } from '../stores/settingsStore';
/* 样式：GraphView.css - 图谱容器、控制面板和标签样式 */
import './GraphView.css';
import { GraphConfigInterface } from '@cosmos.gl/graph/dist/config';

/**
 * 标签位置接口
 *
 * 用于在图谱上显示节点标签
 */
interface LabelPosition {
  /** 标签的屏幕 X 坐标 */
  x: number;
  /** 标签的屏幕 Y 坐标 */
  y: number;
  /** 节点标题文本 */
  title: string;
  /** 是否可见 */
  visible: boolean;
  /** 透明度 (0-1) */
  opacity: number;
}

/**
 * 图谱可视化组件
 *
 * 使用 Cosmos.gl 渲染交互式知识图谱，支持：
 * - 力导向布局模拟
 * - 节点拖拽和缩放
 * - 点击节点跳转到编辑器
 * - 动态标签显示
 *
 * @returns 图谱视图 JSX
 */
export function GraphView() {
  /** 图谱容器 DOM 引用 */
  let containerRef: HTMLDivElement | undefined;
  /** Cosmos Graph 实例 */
  let graph: Graph | null = null;

  /** 节点标签位置列表 */
  const [labels, setLabels] = createSignal<LabelPosition[]>([]);

  /* 标签可见性阈值
   * LABEL_ZOOM_THRESHOLD: 标签开始出现的缩放级别
   * LABEL_ZOOM_FULL: 标签完全可见的缩放级别
   */
  const LABEL_ZOOM_THRESHOLD = 0.8;
  const LABEL_ZOOM_FULL = 1.5;

  /** 节点数据缓存 (uuid -> title 映射) */
  let nodeData: { uuid: string; title: string }[] = [];
  /** 节点连接度数组 */
  let nodeDegrees: Uint32Array = new Uint32Array(0);

  /* 节点大小缩放参数
   * LOG_SCALE: 对数缩放因子，控制最大增长
   * DEGREE_THRESHOLD: 低于此连接度的节点大小几乎不变
   */
  const LOG_SCALE = 0.4;
  const DEGREE_THRESHOLD = 5;

  /**
   * 更新节点标签位置
   *
   * 根据当前缩放级别计算标签透明度，并将图谱空间坐标转换为屏幕坐标
   *
   * @internal
   */
  const updateLabels = () => {
    if (!graph || nodeData.length === 0) return;

    /* 获取当前缩放级别 */
    const currentZoom = graph.getZoomLevel();

    /* 根据缩放级别计算标签透明度 */
    let labelOpacity = 0;
    if (currentZoom >= LABEL_ZOOM_THRESHOLD) {
      if (currentZoom >= LABEL_ZOOM_FULL) {
        labelOpacity = 1;
      } else {
        /* 线性插值计算透明度 */
        labelOpacity = (currentZoom - LABEL_ZOOM_THRESHOLD) / (LABEL_ZOOM_FULL - LABEL_ZOOM_THRESHOLD);
      }
    }

    /* 透明度为 0 时不更新标签（性能优化） */
    if (labelOpacity === 0) {
      setLabels([]);
      return;
    }

    /* 获取采样点位置（避免标签重叠） */
    const sampledPoints = graph.getSampledPointPositionsMap();

    const newLabels: LabelPosition[] = [];

    /* 为采样的可见节点创建标签 */
    sampledPoints.forEach((pos, index) => {
      if (index < nodeData.length) {
        /* 将图谱空间坐标转换为屏幕坐标 */
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

  /**
   * 组件挂载时初始化 Cosmos 图谱
   */
  onMount(() => {
    if (!containerRef) return;

    const gs = settingsStore.graphSettings();

    /** Cosmos 图谱配置 */
    const graphConfig: GraphConfigInterface = {
      /* 空间和背景设置 */
      spaceSize: 8192,
      backgroundColor: '#2d313a',

      /* 渲染质量 - 提高 pixelRatio 减少边缘锯齿 */
      pixelRatio: window.devicePixelRatio * 2,

      /* 节点样式 */
      pointDefaultSize: gs.pointSize,
      pointDefaultColor: '#4B5BBF',
      scalePointsOnZoom: true,
      renderHoveredPointRing: true,
      hoveredPointRingColor: '#4B5BBF',

      /* 链接样式 */
      linkDefaultWidth: gs.linkWidth,
      linkDefaultColor: '#5F74C2',
      linkDefaultArrows: gs.showArrows,
      linkArrowsSizeScale: gs.arrowSize,
      linkGreyoutOpacity: 0,
      curvedLinks: gs.curvedLinks,

      /* 物理模拟参数 */
      simulationLinkDistance: gs.linkDistance,
      simulationLinkSpring: gs.linkSpring,
      simulationRepulsion: gs.repulsion,
      simulationGravity: gs.gravity,
      simulationFriction: gs.friction,
      simulationDecay: gs.decay,
      simulationCenter: gs.center,
      simulationRepulsionTheta: gs.repulsionTheta,
      simulationCluster: gs.cluster,

      /* 交互设置 */
      enableDrag: true,
      enableSimulationDuringZoom: true, /* 缩放/平移时保持模拟运行 */

      /* 视图设置 */
      fitViewOnInit: true,
      fitViewDelay: 300,
      fitViewPadding: 0.1,

      /* 标签采样距离 */
      pointSamplingDistance: 60,

      /* 归属信息 */
      attribution: '',

      /* 回调函数 */
      onPointClick: (index: number) => {
        if (graph) {
          graph.selectPointByIndex(index);
          graph.zoomToPointByIndex(index);
          console.log('Clicked point index:', index);

          /* 导航到编辑器 */
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
      /* 模拟和视图变化时更新标签 */
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

    /* Mac 触控板支持
     * 双指滚动发送不带 ctrlKey 的 wheel 事件，转换为平移
     * 捏合缩放发送带 ctrlKey 的 wheel 事件，由 d3-zoom 处理为缩放
     */
    const canvas = containerRef.querySelector('canvas');
    if (canvas) {
      /* 访问内部 zoom 实例（私有但可访问） */
      const graphAny = graph as any;
      const zoomBehavior = graphAny.zoomInstance?.behavior;
      const canvasSelection = graphAny.canvasD3Selection;

      if (zoomBehavior && canvasSelection) {
        canvas.addEventListener('wheel', (e: WheelEvent) => {
          /* 仅拦截非捏合的 wheel 事件（Mac 双指滚动） */
          if (!e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();

            /* 获取当前变换并应用平移 */
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

  /**
   * 组件卸载时销毁图谱实例
   */
  onCleanup(() => {
    if (graph) {
      graph.destroy();
      graph = null;
    }
  });

  /**
   * 响应设置变化，更新图谱配置
   */
  createEffect(() => {
    if (!graph) return;
    const gs = settingsStore.graphSettings();
    const graphData = appStore.graphData();

    /* 更新物理模拟和样式设置 */
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

    /* 根据节点连接度更新节点大小 */
    const numNodes = nodeData.length;
    if (numNodes > 0 && nodeDegrees.length === numNodes) {
      const baseSize = gs.pointSize;
      const sizes = new Float32Array(numNodes);
      for (let i = 0; i < numNodes; i++) {
        const degree = nodeDegrees[i];
        /* 公式: size = baseSize * (1 + scale * log(1 + degree/threshold))
         * 低连接度节点几乎不增长，高连接度节点增长但有上限
         */
        sizes[i] = baseSize * (1 + LOG_SCALE * Math.log(1 + degree / DEGREE_THRESHOLD));
      }
      graph.setPointSizes(sizes);
    }

    /* 更新箭头显示 */
    if (graphData) {
      const numLinks = graphData.edges.length;
      const arrowsArray = new Array(numLinks).fill(gs.showArrows);
      graph.setLinkArrows(arrowsArray);
    }

    graph.restart();
  });

  /**
   * 响应图谱数据变化，重新渲染图谱
   */
  createEffect(() => {
    const graphData = appStore.graphData();
    if (!graph || !graphData || graphData.nodes.length === 0) return;

    console.log('Setting cosmos data:', graphData.nodes.length, 'nodes,', graphData.edges.length, 'edges');

    const numNodes = graphData.nodes.length;

    /* 缓存节点数据用于标签显示 */
    nodeData = graphData.nodes.map(node => {
      const filename = node.path.split('/').pop()?.replace('.md', '') || 'Untitled';
      return {
        uuid: node.uuid,
        title: filename,
      };
    });

    /* 构建 UUID -> 索引映射 */
    const uuidToIndex = new Map<string, number>();
    graphData.nodes.forEach((node, i) => {
      uuidToIndex.set(node.uuid, i);
    });

    /* 生成圆形初始布局 */
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

    /* 构建链接数组 */
    const validLinks: number[] = [];
    graphData.edges.forEach((edge) => {
      const srcIdx = uuidToIndex.get(edge.src_uuid);
      const dstIdx = uuidToIndex.get(edge.dst_uuid);
      if (srcIdx !== undefined && dstIdx !== undefined) {
        validLinks.push(srcIdx, dstIdx);
      }
    });
    const links = new Float32Array(validLinks);

    /* 计算节点连接度（入度 + 出度）用于大小缩放 */
    nodeDegrees = new Uint32Array(numNodes);
    graphData.edges.forEach((edge) => {
      const srcIdx = uuidToIndex.get(edge.src_uuid);
      const dstIdx = uuidToIndex.get(edge.dst_uuid);
      if (srcIdx !== undefined) nodeDegrees[srcIdx]++;
      if (dstIdx !== undefined) nodeDegrees[dstIdx]++;
    });

    /* 使用对数缩放设置节点大小
     * 公式: size = baseSize * (1 + scaleFactor * log(1 + degree))
     * 防止大小爆炸同时仍显示相对重要性
     */
    const gs = settingsStore.graphSettings();
    const baseSize = gs.pointSize;
    const sizes = new Float32Array(numNodes);
    for (let i = 0; i < numNodes; i++) {
      const degree = nodeDegrees[i];
      sizes[i] = baseSize * (1 + LOG_SCALE * Math.log(1 + degree / DEGREE_THRESHOLD));
    }

    /* 设置节点颜色 (RGBA 格式, 0-255) - #4B5BBF */
    const colors = new Float32Array(numNodes * 4);
    for (let i = 0; i < numNodes; i++) {
      colors[i * 4] = 75;      // R
      colors[i * 4 + 1] = 91;  // G
      colors[i * 4 + 2] = 191; // B
      colors[i * 4 + 3] = 255; // A
    }

    /* 设置链接颜色 - #5F74C2 */
    const numLinks = validLinks.length / 2;
    const linkColors = new Float32Array(numLinks * 4);
    for (let i = 0; i < numLinks; i++) {
      linkColors[i * 4] = 95;      // R
      linkColors[i * 4 + 1] = 116; // G
      linkColors[i * 4 + 2] = 194; // B
      linkColors[i * 4 + 3] = 200; // A
    }

    /* 设置链接宽度 */
    const linkWidthsArray = new Float32Array(numLinks).fill(gs.linkWidth);

    /* 设置链接箭头 */
    const arrowsArray = new Array(numLinks).fill(gs.showArrows);

    console.log('Positions:', positions.length / 2, 'Links:', numLinks);

    /* 设置数据 - 顺序很重要！ */
    graph.setPointPositions(positions);
    graph.setPointSizes(sizes);
    graph.setPointColors(colors);
    graph.setLinks(links);
    graph.setLinkColors(linkColors);
    graph.setLinkWidths(linkWidthsArray);
    graph.setLinkArrows(arrowsArray);

    /* 渲染并启动模拟 */
    graph.zoom(0.9);
    graph.render();
  });

  return (
    /* graph-view: 图谱视图根容器 */
    <div class="graph-view">
      {/* graph-info: 节点和边数量信息面板 */}
      <div class="graph-info">
        <span>Nodes: {appStore.graphData()?.nodes.length || 0}</span>
        <span>Edges: {appStore.graphData()?.edges.length || 0}</span>
      </div>

      {/* graph-container: Cosmos 图谱挂载点 */}
      <div ref={containerRef} class="graph-container"></div>

      {/* graph-labels: 节点标签容器 */}
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
