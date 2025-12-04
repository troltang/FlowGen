import React, { useState, useRef, useCallback } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
  BackgroundVariant,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  getRectOfNodes,
  useReactFlow
} from 'reactflow';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Console } from './Console';
import { NodeConfigPanel } from './NodeConfigPanel';
import { VariablePanel } from './VariablePanel';
import { ProjectSidebar } from './ProjectSidebar';
import { AICopilot } from './AICopilot';
import { NodeType, AppNode, ExecutionLog, Variable, GeneratedFlowData, Library } from '../types';
import { INITIAL_NODES, INITIAL_EDGES, INITIAL_VARIABLES } from '../constants';
import { executeFlowWithGemini } from '../services/geminiService';
import { getLayoutedElements } from '../services/layoutService';
import { StartNode, EndNode, ProcessNode, DecisionNode, AITaskNode, CodeNode, DelayNode, LogNode, GroupNode } from './nodes/CustomNodes';

// Register custom node types
const nodeTypes = {
  [NodeType.START]: StartNode,
  [NodeType.END]: EndNode,
  [NodeType.PROCESS]: ProcessNode,
  [NodeType.DECISION]: DecisionNode,
  [NodeType.AI_TASK]: AITaskNode,
  [NodeType.CODE]: CodeNode,
  [NodeType.DELAY]: DelayNode,
  [NodeType.LOG]: LogNode,
  [NodeType.GROUP]: GroupNode,
};

// History type
interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

const FlowEditorInner = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  
  // State
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [variables, setVariables] = useState<Variable[]>(INITIAL_VARIABLES);
  const [libraries, setLibraries] = useState<Library[]>([]); // External DLLs
  
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  
  // Track selected node for Context/AI use (single click)
  const [selectedNode, setSelectedNode] = useState<AppNode | null>(null);
  // Track node currently being edited in the panel (double click)
  const [editingNode, setEditingNode] = useState<AppNode | null>(null);
  
  const [configPanelPosition, setConfigPanelPosition] = useState<{ x: number, y: number } | undefined>(undefined);

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  
  // Window Visibility States
  const [showVariablePanel, setShowVariablePanel] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);

  // Undo/Redo Stacks
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

  // Record history helper
  const recordHistory = useCallback(() => {
    setPast(prev => [...prev.slice(-10), { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }]);
    setFuture([]);
  }, [nodes, edges]);

  // Handle changes with history
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    if (changes.some(c => c.type === 'remove')) {
      recordHistory();
    }
  }, [recordHistory]);

  const onConnect = useCallback((params: Connection) => {
    recordHistory();
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges, recordHistory]);

  const onNodeDragStart = useCallback(() => {
    recordHistory();
  }, [recordHistory]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      const label = event.dataTransfer.getData('application/label');

      if (typeof type === 'undefined' || !type) return;

      recordHistory(); // Save before adding

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: AppNode = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label: label || `${type} node` },
      };

      if (type === NodeType.GROUP) {
        newNode.style = { width: 400, height: 300 };
      }

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, recordHistory]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Single click only selects the node for context, doesn't open panel
    setSelectedNode(node as AppNode);
    // If we click a different node, close the editor
    if (editingNode && editingNode.id !== node.id) {
      setEditingNode(null);
    }
  }, [editingNode]);

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    const appNode = node as AppNode;
    setEditingNode(appNode);
    setSelectedNode(appNode);
    
    // Calculate smart position for config panel (to the right of the clicked position)
    const offset = 20;
    let x = event.clientX + offset;
    let y = event.clientY - 50;
    
    // Boundary check is handled by DraggablePanel, but a good start helps
    setConfigPanelPosition({ x, y });
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setEditingNode(null);
  }, []);

  const updateNodeData = (id: string, data: Partial<AppNode['data']>) => {
    recordHistory();
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...data } };
        }
        return node;
      })
    );
    // Update local state references
    setEditingNode(prev => prev ? { ...prev, data: { ...prev.data, ...data } } : null);
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, ...data } } : null);
  };

  const handleGroupSelected = () => {
    if (!reactFlowInstance) return;
    const selectedNodes = nodes.filter(n => n.selected && n.type !== NodeType.GROUP);
    if (selectedNodes.length < 2) return;

    recordHistory();

    const rect = getRectOfNodes(selectedNodes);
    const groupId = `group-${Date.now()}`;
    const padding = 20;

    const groupNode: AppNode = {
      id: groupId,
      type: NodeType.GROUP,
      position: { x: rect.x - padding, y: rect.y - padding },
      style: { width: rect.width + padding * 2, height: rect.height + padding * 2 },
      data: { label: '新建分组' },
    };

    // Calculate relative positions for children
    const newChildren = selectedNodes.map(node => ({
      ...node,
      parentNode: groupId,
      extent: 'parent' as const,
      position: {
        x: node.position.x - (rect.x - padding),
        y: node.position.y - (rect.y - padding)
      },
      selected: false
    }));
    
    // Keep non-selected nodes
    const otherNodes = nodes.filter(n => !n.selected);

    setNodes([...otherNodes, groupNode, ...newChildren]);
  };

  const handleAutoLayout = useCallback(() => {
    recordHistory();
    const layouted = getLayoutedElements(nodes, edges);
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);
    setTimeout(() => {
      fitView({ duration: 800 });
    }, 10);
  }, [nodes, edges, recordHistory, fitView]);

  const handleFocusNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.map((n) => ({
      ...n,
      selected: n.id === nodeId
    })));
    
    // Defer to allow React Flow to process selection state
    setTimeout(() => {
      reactFlowInstance?.fitView({ 
        nodes: [{ id: nodeId }], 
        duration: 800, 
        padding: 0.5 
      });
    }, 50);
  }, [reactFlowInstance, setNodes]);

  const validateFlow = (): boolean => {
    let isValid = true;
    const newNodes = nodes.map(node => {
      let error = undefined;
      const data = node.data as any;

      switch(node.type) {
        case NodeType.DECISION:
          if (!data.description && !data.label.includes('?')) { // Check if label looks like condition if no desc
             if(!data.description || data.description.trim() === '') error = "必须配置判断条件";
          }
          break;
        case NodeType.CODE:
          if (!data.code || data.code.trim() === '') error = "代码内容不能为空";
          break;
        case NodeType.AI_TASK:
          if (!data.description || data.description.trim() === '') error = "必须填写Prompt/指令";
          break;
        case NodeType.PROCESS:
          if (!data.label || data.label.trim() === '') error = "标签不能为空";
          break;
      }

      if (error) isValid = false;
      return { ...node, data: { ...node.data, error } };
    });

    if (!isValid) {
      setNodes(newNodes);
      setLogs(prev => [...prev, {
        step: 0,
        nodeId: 'system',
        nodeLabel: 'Validation',
        message: '流程校验失败，请检查标红节点。',
        status: 'error',
        timestamp: new Date().toISOString()
      }]);
    }
    return isValid;
  };

  const handleRun = async () => {
    // 1. Clear previous logs and errors
    setLogs([]);
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isActive: false, error: undefined } })));

    // 2. Validate
    if (!validateFlow()) return;

    setIsRunning(true);
    setLogs([{ 
      step: 0, 
      nodeId: 'init', 
      nodeLabel: 'System', 
      message: '正在启动 Gemini 引擎...', 
      status: 'info',
      timestamp: new Date().toISOString() 
    }]);

    const result = await executeFlowWithGemini(nodes as AppNode[], edges, variables);

    if (result.logs && Array.isArray(result.logs) && result.logs.length > 0) {
      let currentLogIndex = 0;
      
      const interval = setInterval(() => {
        // Stop condition
        if (!result.logs || currentLogIndex >= result.logs.length) {
          clearInterval(interval);
          setIsRunning(false);
          
          // Clear active states at end
          setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isActive: false } })));
          
          if (result.finalOutput) {
             setLogs(prev => [...prev, {
               step: 999,
               nodeId: 'end',
               nodeLabel: 'Output',
               message: `最终结果: ${result.finalOutput}`,
               status: 'success',
               timestamp: new Date().toISOString()
             }]);
          }
          if (result.finalVariables) {
             // Optional: Update global variables with result?
          }
          return;
        }
        
        const nextLog = result.logs[currentLogIndex];
        
        if (nextLog) {
          // Add log
          setLogs(prev => [...prev, nextLog]);
          
          // Highlight Node logic
          if (nextLog.nodeId && nextLog.nodeId !== 'unknown' && nextLog.nodeId !== 'system') {
             setNodes(nds => nds.map(n => {
               if (n.id === nextLog.nodeId) {
                 return { ...n, data: { ...n.data, isActive: true } };
               }
               // Deactivate others to show single step flow? Or keep trail? 
               // Single step active is cleaner for "current execution point"
               return { ...n, data: { ...n.data, isActive: false } };
             }));
          }
        }
        currentLogIndex++;
      }, 800); // Slightly slower for better visual tracking
    } else {
      setIsRunning(false);
      setLogs(prev => [...prev, {
        step: 0,
        nodeId: 'error',
        nodeLabel: 'Result',
        message: '流程结束，但未返回日志。',
        status: 'warning',
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const handleClearLogs = () => setLogs([]);

  const handleUndo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setFuture([{ nodes, edges }, ...future]);
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setPast(newPast);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setPast([...past, { nodes, edges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
    setFuture(newFuture);
  };

  // AI Flow Integration
  const handleApplyFlow = (generatedData: GeneratedFlowData) => {
    recordHistory();
    
    // 1. Merge Variables (deduplicate by name)
    const newVars = [...variables];
    generatedData.variables.forEach(gv => {
      if (!newVars.some(v => v.name === gv.name)) {
        newVars.push(gv);
      }
    });
    setVariables(newVars);

    // 2. Prepare nodes and edges for merging
    let finalNodes = [...nodes];
    let finalEdges = [...edges];
    let addedNodes = generatedData.nodes;
    let addedEdges = [...generatedData.edges];
    
    // For appending, we use the selected node as the anchor point
    if (selectedNode) {
      // Append mode logic (initial connection)
      if (addedNodes.length > 0) {
        const firstGeneratedNode = addedNodes[0];
        const connectionEdge: Edge = {
          id: `e-auto-connect-${Date.now()}`,
          source: selectedNode.id,
          target: firstGeneratedNode.id,
          label: '自动连接',
          animated: true,
          type: 'smoothstep'
        };
        if (selectedNode.type === NodeType.DECISION) {
           connectionEdge.sourceHandle = 'true'; // Default to YES path
        }
        addedEdges.push(connectionEdge);
      }
    }

    finalNodes = [...finalNodes, ...addedNodes];
    finalEdges = [...finalEdges, ...addedEdges];

    // 3. APPLY AUTO LAYOUT
    // This ensures AI generated nodes are beautifully arranged and don't overlap
    const layouted = getLayoutedElements(finalNodes, finalEdges, 'TB');
    
    setNodes([...layouted.nodes]);
    setEdges([...layouted.edges]);

    // Close Copilot and Fit View
    setShowAICopilot(false);
    setTimeout(() => fitView({ duration: 800 }), 100);
  };

  const handleLoadProject = (projectId: string) => {
    console.log("Loading project:", projectId);
    // Placeholder for loading logic
  };

  const handleLibraryUpload = (lib: Library) => {
    setLibraries(prev => [...prev, lib]);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* 1. Project Management Sidebar (Left) */}
      <ProjectSidebar 
        onLoadProject={handleLoadProject} 
        onLibraryUpload={handleLibraryUpload}
        libraries={libraries}
      />

      {/* 2. Main Editor Area */}
      <div className="flex-1 flex flex-col relative h-full">
        <TopBar 
          onRun={handleRun} 
          isRunning={isRunning} 
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onToggleVariables={() => setShowVariablePanel(!showVariablePanel)}
          onToggleAICopilot={() => setShowAICopilot(!showAICopilot)}
          onGroupSelected={handleGroupSelected}
          onAutoLayout={handleAutoLayout}
        />
        
        <div className="flex-1 relative flex flex-col overflow-hidden">
           <div className="flex-1 relative bg-slate-50" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeDragStart={onNodeDragStart}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-right"
              // Performance & Alignment Props
              snapToGrid={true}
              snapGrid={[15, 15]}
              onlyRenderVisibleElements={true}
              minZoom={0.1}
              maxZoom={2}
              defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
            >
              <Controls className="bg-white shadow-lg border border-slate-100 rounded-md p-1" />
              <Background color="#cbd5e1" variant={BackgroundVariant.Dots} gap={15} size={1} />
            </ReactFlow>
            
            {/* Floating Toolbox (Draggable) */}
            <Sidebar />
            
            {/* Floating AI Copilot Window - Center Left */}
            <AICopilot 
              isOpen={showAICopilot} 
              onClose={() => setShowAICopilot(false)}
              currentNodes={nodes as AppNode[]}
              onApplyFlow={handleApplyFlow}
              selectedNodeId={selectedNode?.id}
              initialPosition={selectedNode && configPanelPosition ? { x: configPanelPosition.x - 550, y: configPanelPosition.y } : { x: 300, y: 80 }}
              variables={variables}
            />

            {/* Floating Node Config Panel - Right side (Controlled by editingNode) */}
            <NodeConfigPanel 
              node={editingNode} 
              onClose={() => setEditingNode(null)} 
              onChange={updateNodeData}
              variables={variables}
              libraries={libraries}
              initialPosition={configPanelPosition || { x: window.innerWidth - 350, y: 80 }}
            />

            {/* Floating Variable Panel - Center Right */}
            <VariablePanel 
              isOpen={showVariablePanel}
              onClose={() => setShowVariablePanel(false)}
              variables={variables}
              setVariables={setVariables}
              nodes={nodes as AppNode[]}
              initialPosition={selectedNode && configPanelPosition ? { x: configPanelPosition.x - 450, y: configPanelPosition.y } : { x: window.innerWidth - 750, y: 80 }}
              onFocusNode={handleFocusNode}
            />
          </div>
          
          <Console logs={logs} isRunning={isRunning} onClear={handleClearLogs} />
        </div>
      </div>
    </div>
  );
};

export const FlowEditor = () => (
  <ReactFlowProvider>
    <FlowEditorInner />
  </ReactFlowProvider>
);