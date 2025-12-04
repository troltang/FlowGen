
import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  useReactFlow,
  SelectionMode
} from 'reactflow';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Console } from './Console';
import { NodeConfigPanel } from './NodeConfigPanel';
import { VariablePanel } from './VariablePanel';
import { ProjectSidebar } from './ProjectSidebar';
import { AICopilot } from './AICopilot';
import { CompilerPanel } from './CompilerPanel';
import { DraggablePanel } from './DraggablePanel';
import { NodeType, AppNode, ExecutionLog, Variable, GeneratedFlowData, Library, FlowData, ValidationIssue, StructDefinition } from '../types';
import { INITIAL_NODES, INITIAL_EDGES, INITIAL_VARIABLES } from '../constants';
import { executeFlowWithGemini } from '../services/geminiService';
import { getLayoutedElements } from '../services/layoutService';
import { StartNode, EndNode, ProcessNode, DecisionNode, AITaskNode, CodeNode, DelayNode, LogNode, GroupNode, HttpNode, DbNode, LoopNode, SubFlowNode } from './nodes/CustomNodes';
import { LanguageContext, translations, Language } from '../utils/i18n';
import { Play, Languages, CheckSquare, Crosshair, ArrowRight } from 'lucide-react';

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
  [NodeType.HTTP]: HttpNode,
  [NodeType.DB]: DbNode,
  [NodeType.LOOP]: LoopNode,
  [NodeType.SUB_FLOW]: SubFlowNode,
};

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface ReferenceResult {
    flowId: string;
    flowName: string;
    nodeId: string;
    nodeLabel: string;
}

const FlowEditorInner = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView, getNodes, getEdges } = useReactFlow();
  
  // -- State --
  const [lang, setLang] = useState<Language>('zh');
  
  // Project State
  const [flows, setFlows] = useState<Record<string, FlowData>>({
    'main': { id: 'main', name: 'Main Flow', nodes: INITIAL_NODES, edges: INITIAL_EDGES, variables: INITIAL_VARIABLES }
  });
  const [activeFlowId, setActiveFlowId] = useState<string>('main');
  const [projectVariables, setProjectVariables] = useState<Variable[]>([]); // Global vars
  const [structs, setStructs] = useState<StructDefinition[]>([]);
  const [libraries, setLibraries] = useState<Library[]>([]);

  // Current View State (derived/synced with React Flow)
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<AppNode | null>(null);
  const [editingNode, setEditingNode] = useState<AppNode | null>(null);
  
  const [selectionMode, setSelectionMode] = useState<'select' | 'pan'>('pan');

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  
  // Panels
  const [showVariablePanel, setShowVariablePanel] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);
  const [showCompilerPanel, setShowCompilerPanel] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  
  // Reference Search
  const [referenceResults, setReferenceResults] = useState<ReferenceResult[]>([]);
  const [showReferencePanel, setShowReferencePanel] = useState(false);

  // History
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

  // Clipboard
  const [clipboard, setClipboard] = useState<AppNode[]>([]);

  // Helpers
  const t = (key: string) => translations[lang][key] || key;

  // Sync ReactFlow state back to Flows store when switching or autosaving
  const saveCurrentFlowState = useCallback(() => {
    setFlows(prev => ({
      ...prev,
      [activeFlowId]: {
        ...prev[activeFlowId],
        nodes: getNodes() as AppNode[],
        edges: getEdges(),
        // Variables are stored in flows[id].variables, updated by VariablePanel directly
      }
    }));
  }, [activeFlowId, getNodes, getEdges]);

  // Handle Flow Switching
  const handleSwitchFlow = (flowId: string) => {
    saveCurrentFlowState();
    const targetFlow = flows[flowId];
    if (targetFlow) {
      setNodes(targetFlow.nodes);
      setEdges(targetFlow.edges);
      setActiveFlowId(flowId);
      setPast([]);
      setFuture([]);
      setTimeout(() => fitView({ duration: 300 }), 50);
    }
  };

  const handleAddFlow = () => {
    const newId = `flow-${Date.now()}`;
    const newFlow: FlowData = {
      id: newId,
      name: `Flow ${Object.keys(flows).length + 1}`,
      nodes: [],
      edges: [],
      variables: []
    };
    setFlows(prev => ({ ...prev, [newId]: newFlow }));
    handleSwitchFlow(newId);
  };

  const handleRenameFlow = (id: string, name: string) => {
    setFlows(prev => ({
      ...prev,
      [id]: { ...prev[id], name }
    }));
  };

  const handleDeleteFlow = (id: string) => {
    if (id === 'main') return;
    const newFlows = { ...flows };
    delete newFlows[id];
    setFlows(newFlows);
    if (activeFlowId === id) handleSwitchFlow('main');
  };

  const handleFindReferences = (targetFlowId: string) => {
      saveCurrentFlowState();
      
      const results: ReferenceResult[] = [];
      
      (Object.values(flows) as FlowData[]).forEach(flow => {
          flow.nodes.forEach(node => {
              if (node.type === NodeType.SUB_FLOW && node.data.subFlowId === targetFlowId) {
                  results.push({
                      flowId: flow.id,
                      flowName: flow.name,
                      nodeId: node.id,
                      nodeLabel: node.data.label
                  });
              }
          });
      });
      
      setReferenceResults(results);
      setShowReferencePanel(true);
  };

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLogs([{
      step: 0,
      nodeId: 'system',
      nodeLabel: 'System',
      message: '开始执行流程...',
      status: 'info',
      timestamp: new Date().toISOString()
    }]);

    // Combine global and local variables
    const currentFlow = flows[activeFlowId];
    const allVariables = [...projectVariables, ...currentFlow.variables];

    try {
      const result = await executeFlowWithGemini(nodes, edges, allVariables);
      setLogs(prev => [...prev, ...result.logs]);
      
      if (result.success) {
         setLogs(prev => [...prev, {
            step: 999,
            nodeId: 'system',
            nodeLabel: 'System',
            message: `流程执行成功完成。结果: ${result.finalOutput || '无输出'}`,
            status: 'success',
            timestamp: new Date().toISOString()
         }]);
      } else {
         // If gemini returns success: false but no logs?
         if (!result.logs.some(l => l.status === 'error')) {
             setLogs(prev => [...prev, {
                step: 999,
                nodeId: 'system',
                nodeLabel: 'System',
                message: '流程执行结束 (Status: Failed).',
                status: 'error',
                timestamp: new Date().toISOString()
             }]);
         }
      }

    } catch (e) {
      console.error(e);
      setLogs(prev => [...prev, {
        step: 0,
        nodeId: 'system',
        nodeLabel: 'System',
        message: '执行过程中发生异常: ' + (e instanceof Error ? e.message : String(e)),
        status: 'error',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  // Compiler Logic
  const handleCompile = () => {
    saveCurrentFlowState();
    const issues: ValidationIssue[] = [];
    
    // Validate all flows
    (Object.values(flows) as FlowData[]).forEach(flow => {
      // 1. Check unconnected nodes (simplified)
      // 2. Check required fields
      flow.nodes.forEach(node => {
        if (node.type === NodeType.SUB_FLOW && !node.data.subFlowId) {
          issues.push({ id: `err-${node.id}`, flowId: flow.id, nodeId: node.id, type: 'error', message: 'Sub-flow target not selected.', timestamp: new Date().toISOString() });
        }
        if (node.type === NodeType.CODE && !node.data.code) {
          issues.push({ id: `err-${node.id}`, flowId: flow.id, nodeId: node.id, type: 'error', message: 'Code block is empty.', timestamp: new Date().toISOString() });
        }
        if (node.data.error) {
             issues.push({ id: `err-${node.id}`, flowId: flow.id, nodeId: node.id, type: 'error', message: node.data.error, timestamp: new Date().toISOString() });
        }
        // ... other validations
      });
    });

    setValidationIssues(issues);
    setShowCompilerPanel(true);
  };

  const handleNavigateToIssue = (flowId: string, nodeId?: string) => {
    if (flowId !== activeFlowId) {
      handleSwitchFlow(flowId);
    }
    if (nodeId) {
      setTimeout(() => {
        fitView({ nodes: [{ id: nodeId }], duration: 800, padding: 0.5 });
        setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeId })));
      }, 100);
    }
  };

  // -- Standard React Flow Handlers (recordHistory, onConnect, etc.) --
  const recordHistory = useCallback(() => {
    setPast(prev => [...prev.slice(-10), { nodes: getNodes(), edges: getEdges() }]);
    setFuture([]);
  }, [getNodes, getEdges]);

  const onConnect = useCallback((params: Connection) => {
    recordHistory();
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges, recordHistory]);

  // Drag Drop
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      const label = event.dataTransfer.getData('application/label');
      if (typeof type === 'undefined' || !type || !reactFlowInstance) return;
      recordHistory();
      const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode: AppNode = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { label: label || `${type} node` },
      };
      if (type === NodeType.GROUP) newNode.style = { width: 400, height: 300 };
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, recordHistory, setNodes]
  );

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    setEditingNode(node as AppNode);
    setSelectedNode(node as AppNode);
  }, []);

  const updateNodeData = (id: string, data: Partial<AppNode['data']>) => {
    recordHistory();
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
    setEditingNode(prev => prev ? { ...prev, data: { ...prev.data, ...data } } : null);
  };

  // Variables Management (Proxies to update the correct flow or global state)
  const updateVariables = (newVars: Variable[]) => {
    setFlows(prev => ({ ...prev, [activeFlowId]: { ...prev[activeFlowId], variables: newVars } }));
  };

  // Keyboard Shortcuts for Copy/Paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      // Copy: Ctrl+C / Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selected = nodes.filter(n => n.selected);
        if (selected.length > 0) {
          setClipboard(selected);
        }
      }

      // Paste: Ctrl+V / Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboard.length > 0) {
          recordHistory();
          const pasteOffset = 50; // Offset to avoid perfect overlap
          const newNodes = clipboard.map(node => {
            // Generate a cleaner ID
            const id = `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            return {
              ...node,
              id,
              position: { 
                x: node.position.x + pasteOffset, 
                y: node.position.y + pasteOffset 
              },
              selected: true, // Select the new nodes
              data: { ...node.data } // Deep copy data
            };
          });
          
          // Deselect existing nodes and add new ones
          setNodes(nds => nds.map(n => ({...n, selected: false})).concat(newNodes));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, clipboard, setNodes, recordHistory]);

  const handleAutoLayout = () => {
    recordHistory();
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    
    // Check if there's a selection
    const selectedNodes = currentNodes.filter(n => n.selected);
    const hasSelection = selectedNodes.length > 1; // Needs at least 2 nodes to layout

    if (hasSelection) {
      // Partial Layout: Layout only selected nodes
      const selectedIds = new Set(selectedNodes.map(n => n.id));
      
      // Filter edges that are completely within the selection
      const edgesToLayout = currentEdges.filter(e => 
        selectedIds.has(e.source) && selectedIds.has(e.target)
      );

      // Calculate initial center of the selected group to maintain position
      const initialCenterX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
      const initialCenterY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;

      // Get layouted elements for the subset
      const layouted = getLayoutedElements(selectedNodes, edgesToLayout);
      
      // Calculate new center
      const newCenterX = layouted.nodes.reduce((sum, n) => sum + n.position.x, 0) / layouted.nodes.length;
      const newCenterY = layouted.nodes.reduce((sum, n) => sum + n.position.y, 0) / layouted.nodes.length;

      // Offset needed to keep the group in roughly the same place
      const offsetX = initialCenterX - newCenterX;
      const offsetY = initialCenterY - newCenterY;

      // Merge back into the main state
      setNodes(nds => nds.map(node => {
        const layoutedNode = layouted.nodes.find(ln => ln.id === node.id);
        if (layoutedNode) {
          return {
            ...node,
            position: {
              x: layoutedNode.position.x + offsetX,
              y: layoutedNode.position.y + offsetY
            },
            targetPosition: layoutedNode.targetPosition,
            sourcePosition: layoutedNode.sourcePosition
          };
        }
        return node;
      }));
    } else {
      // Full Layout
      const layouted = getLayoutedElements(currentNodes, currentEdges);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      <div className="flex h-full w-full overflow-hidden">
        <ProjectSidebar 
          onLoadProject={() => {}} 
          onLibraryUpload={lib => setLibraries(prev => [...prev, lib])}
          libraries={libraries}
          flows={flows}
          activeFlowId={activeFlowId}
          onAddFlow={handleAddFlow}
          onDeleteFlow={handleDeleteFlow}
          onSwitchFlow={handleSwitchFlow}
          onRenameFlow={handleRenameFlow}
          onFindReferences={handleFindReferences}
        />

        <div className="flex-1 flex flex-col relative h-full">
          <TopBar 
            onRun={handleRun} 
            isRunning={isRunning} 
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            onUndo={() => {}}
            onRedo={() => {}}
            onToggleVariables={() => setShowVariablePanel(!showVariablePanel)}
            onToggleAICopilot={() => setShowAICopilot(!showAICopilot)}
            onGroupSelected={() => {}}
            onAutoLayout={handleAutoLayout}
            onCompile={handleCompile}
            onToggleLanguage={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            currentLanguage={lang}
            selectionMode={selectionMode}
            onSetSelectionMode={setSelectionMode}
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
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onNodeDoubleClick={onNodeDoubleClick}
                nodeTypes={nodeTypes}
                panOnDrag={selectionMode === 'pan'}
                selectionOnDrag={selectionMode === 'select'}
                selectionMode={SelectionMode.Full}
                fitView
              >
                <Controls className="bg-white shadow-lg border border-slate-100 rounded-md p-1" />
                <Background color="#cbd5e1" variant={BackgroundVariant.Dots} gap={15} size={1} />
              </ReactFlow>
              
              <Sidebar />
              
              <NodeConfigPanel 
                node={editingNode} 
                onClose={() => setEditingNode(null)} 
                onChange={updateNodeData}
                variables={[...(flows[activeFlowId]?.variables || []), ...projectVariables]}
                libraries={libraries}
                structs={structs}
                flows={flows}
              />

              <VariablePanel 
                isOpen={showVariablePanel}
                onClose={() => setShowVariablePanel(false)}
                variables={flows[activeFlowId]?.variables || []}
                globalVariables={projectVariables}
                structs={structs}
                setVariables={updateVariables}
                setGlobalVariables={setProjectVariables}
                setStructs={setStructs}
                nodes={nodes as AppNode[]}
              />

              <CompilerPanel 
                isOpen={showCompilerPanel}
                onClose={() => setShowCompilerPanel(false)}
                issues={validationIssues}
                onNavigate={handleNavigateToIssue}
              />

              {/* Find References Results Panel */}
              {showReferencePanel && (
                  <DraggablePanel
                    title="引用查找结果"
                    icon={Crosshair}
                    initialPosition={{ x: window.innerWidth - 450, y: 100 }}
                    initialSize={{ width: 400, height: 300 }}
                    onClose={() => setShowReferencePanel(false)}
                  >
                    <div className="flex flex-col h-full bg-white">
                        <div className="p-3 border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                            共找到 {referenceResults.length} 处引用
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {referenceResults.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    未找到任何引用。
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {referenceResults.map((res, idx) => (
                                        <li 
                                            key={idx} 
                                            className="p-3 hover:bg-slate-50 cursor-pointer transition-colors group"
                                            onClick={() => handleNavigateToIssue(res.flowId, res.nodeId)}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-sm text-slate-700">{res.flowName}</span>
                                                <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-500" />
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">ID: {res.nodeId}</span>
                                                <span>{res.nodeLabel}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                  </DraggablePanel>
              )}
            </div>
            
            <Console logs={logs} isRunning={isRunning} onClear={() => setLogs([])} />
          </div>
        </div>
      </div>
    </LanguageContext.Provider>
  );
};

export const FlowEditor = () => {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  );
};
