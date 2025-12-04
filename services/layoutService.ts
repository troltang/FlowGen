import dagre from 'dagre';
import { Node, Edge, Position } from 'reactflow';

// Default node size if not specified (width, height)
const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 80;

/**
 * Auto-layout the graph using Dagre
 * @param nodes Current nodes
 * @param edges Current edges
 * @param direction 'TB' (Top to Bottom) or 'LR' (Left to Right)
 * @returns Layouted nodes and edges
 */
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = 'TB'
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  // Create a set of existing node IDs for safe edge validation
  const nodeIds = new Set(nodes.map(n => n.id));

  nodes.forEach((node) => {
    // Robustly determine width and height
    // React Flow style width might be a string (e.g., "100px") which causes NaN in Dagre if cast directly to Number
    let width = node.width;
    let height = node.height;

    if (!width && node.style?.width) {
      const parsed = parseInt(String(node.style.width), 10);
      if (!isNaN(parsed) && parsed > 0) width = parsed;
    }

    if (!height && node.style?.height) {
      const parsed = parseInt(String(node.style.height), 10);
      if (!isNaN(parsed) && parsed > 0) height = parsed;
    }

    // Fallback to defaults if dimensions are missing or invalid
    width = width || DEFAULT_WIDTH;
    height = height || DEFAULT_HEIGHT;

    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    // Only add edges where both source and target exist to prevent 'Not possible to find intersection' error
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    // If node wasn't in the graph (shouldn't happen due to logic above), return as is
    if (!nodeIds.has(node.id)) return node;

    const nodeWithPosition = dagreGraph.node(node.id);
    
    // Safety check
    if (!nodeWithPosition) return node;

    // Recalculate dimensions for centering (same logic as above)
    let width = node.width;
    let height = node.height;

    if (!width && node.style?.width) {
      const parsed = parseInt(String(node.style.width), 10);
      if (!isNaN(parsed) && parsed > 0) width = parsed;
    }
    if (!height && node.style?.height) {
      const parsed = parseInt(String(node.style.height), 10);
      if (!isNaN(parsed) && parsed > 0) height = parsed;
    }
    
    width = width || DEFAULT_WIDTH;
    height = height || DEFAULT_HEIGHT;

    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};