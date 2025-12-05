
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
  SelectionMode,
  MarkerType,
  useReactFlow
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
import { CodeEditor } from './CodeEditor'; 
import { NodeType, AppNode, ExecutionLog, Variable, GeneratedFlowData, Library, FlowData, ValidationIssue, StructDefinition, CodeFile, FunctionDefinition } from '../types';
import { INITIAL_NODES, INITIAL_EDGES, INITIAL_VARIABLES } from '../constants';
import { executeFlowWithGemini } from '../services/geminiService';
import { getLayoutedElements } from '../services/layoutService';
import { StartNode, EndNode, ProcessNode, DecisionNode, AITaskNode, CodeNode, DelayNode, LogNode, GroupNode, HttpNode, DbNode, LoopNode, SubFlowNode, FunctionCallNode } from './nodes/CustomNodes';
import { LanguageContext, translations, Language } from '../utils/i18n';
import { FileCode, X, Workflow, FileJson, Link2, AlertTriangle } from 'lucide-react';

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
  [NodeType.FUNCTION_CALL]: FunctionCallNode,
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
    context: 'SubFlow' | 'FunctionCall';
}

interface Tab {
    id: string;
    type: 'flow' | 'code';
    title: string;
}

// Improved regex to parse C# functions and comments
const parseCodeFunctions = (code: string): FunctionDefinition[] => {
    const functions: FunctionDefinition[] = [];
    const lines = code.split('\n');
    let currentComments: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Collect comments
        if (line.startsWith('///') || line.startsWith('//')) {
            const comment = line.replace(/^\/{2,3}\s*/, '').replace(/<[^>]*>/g, '').trim();
            if (comment) currentComments.push(comment);
            continue;
        }

        // Ignore attributes or empty lines but keep comments for next line
        if (line.startsWith('[') || line === '') {
             if (line === '') {
                 // Only clear comments on double empty lines or if separated significantly
             }
             continue;
        }

        // Try match function definition
        // Matches: public [static] returnType MethodName(params)
        const regex = /^public\s+(?:static\s+)?(?<returnType>[\w<>\[\]]+)\s+(?<name>\w+)\s*\((?<params>[^)]*)\)/;
        const match = line.match(regex);
        
        if (match && match.groups) {
            const { returnType, name, params } = match.groups;
            const parameters = params.split(',').map(p => p.trim()).filter(p => p).map(p => {
                const parts = p.split(/\s+/);
                return { 
                    type: parts.length > 1 ? parts[parts.length - 2] : 'object', 
                    name: parts[parts.length - 1] 
                };
            });
            
            functions.push({ 
                name, 
                returnType, 
                parameters,
                description: currentComments.join(' ') 
            });
            currentComments = []; // Reset after attaching to function
        } else {
            // Found a line that is code but not a function signature, reset comments
            if (!line.startsWith('using') && !line.startsWith('namespace') && !line.startsWith('class') && !line.startsWith('{') && !line.startsWith('}')) {
                 currentComments = []; 
            }
        }
    }
    return functions;
};

const FlowEditorInner = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView, getNodes, getEdges } = useReactFlow();
  
  // -- State --
  const [lang, setLang] = useState<Language>('zh');
  
  // Project State
  const [flows, setFlows] = useState<Record<string, FlowData>>({
    'main': { id: 'main', name: 'Main Flow', nodes: INITIAL_NODES, edges: INITIAL_EDGES, variables: INITIAL_VARIABLES }
  });
  
  // Tab System State
  const [tabs, setTabs] = useState<Tab[]>([{ id: 'main', type: 'flow', title: 'Main Flow' }]);
  const [activeTabId, setActiveTabId] = useState<string>('main');
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number, y: number, id: string } | null>(null);
  
  // Active Flow (for React Flow execution/context) - synced when tab switches to flow
  const [activeFlowId, setActiveFlowId] = useState<string>('main'); 

  const [projectVariables, setProjectVariables] = useState<Variable[]>([]); // Global vars
  const [structs, setStructs] = useState<StructDefinition[]>([]);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [codeFiles, setCodeFiles] = useState<CodeFile[]>([]);
  
  // Code Editor State
  const [codeCursorIndex, setCodeCursorIndex] = useState(0);

  // Current View State (derived/synced with React Flow)
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<AppNode | null>(null);
  const [editingNode, setEditingNode] = useState<AppNode | null>(null);
  const [configPanelPosition, setConfigPanelPosition] = useState({ x: 0, y: 0 });
  
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

  // Abort Controller for stopping execution
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helpers
  const t = (key: string) => translations[lang][key] || key;

  // Sync ReactFlow state back to Flows store
  const saveCurrentFlowState = useCallback((targetFlowId: string) => {
    setFlows(prev => ({
      ...prev,
      [targetFlowId]: {
        ...prev[targetFlowId],
        nodes: getNodes() as AppNode[],
        edges: getEdges(),
        // Variables are stored in flows[id].variables, updated by VariablePanel directly
      }
    }));
  }, [getNodes, getEdges]);

  // Handle Tab Logic
  const handleOpenTab = (id: string, type: 'flow' | 'code', title: string) => {
      const existingTab = tabs.find(t => t.id === id);
      if (existingTab) {
          handleSwitchTab(id, type);
          return;
      }

      if (tabs.length >= 10) {
          alert("Maximum 10 tabs allowed. Please close a tab first.");
          return;
      }

      setTabs(prev => [...prev, { id, type, title }]);
      handleSwitchTab(id, type);
  };

  const handleCloseTab = (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (tabs.length === 1 && id === 'main') return; 

      const tabIndex = tabs.findIndex(t => t.id === id);
      const newTabs = tabs.filter(t => t.id !== id);
      setTabs(newTabs);

      if (activeTabId === id) {
          if (newTabs.length > 0) {
              const nextTab = newTabs[tabIndex] || newTabs[tabIndex - 1];
              handleSwitchTab(nextTab.id, nextTab.type);
          } else {
              setActiveTabId('');
          }
      }
  };

  const handleSwitchTab = (id: string, type: 'flow' | 'code') => {
      if (activeFlowId && activeTabId !== id) {
          const activeTab = tabs.find(t => t.id === activeTabId);
          if (activeTab && activeTab.type === 'flow') {
              saveCurrentFlowState(activeTab.id);
          }
      }

      setActiveTabId(id);

      if (type === 'flow') {
          const targetFlow = flows[id];
          if (targetFlow) {
              setActiveFlowId(id);
              setNodes(targetFlow.nodes);
              setEdges(targetFlow.edges);
              setPast([]);
              setFuture([]);
              setTimeout(() => fitView({ duration: 300 }), 50);
          }
      }
  };

  const handleTabContextMenu = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      setTabContextMenu({ x: e.clientX, y: e.clientY, id });
  };

  const handleCloseOtherTabs = () => {
      if (!tabContextMenu) return;
      const targetId = tabContextMenu.id;
      const newTabs = tabs.filter(t => t.id === targetId);
      setTabs(newTabs);
      if (activeTabId !== targetId) {
          const target = tabs.find(t => t.id === targetId);
          if (target) handleSwitchTab(targetId, target.type);
      }
      setTabContextMenu(null);
  };

  useEffect(() => {
      const handleClick = () => setTabContextMenu(null);
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleAddFlow = () => {
    const name = `Flow ${Object.keys(flows).length + 1}`;
    // Check global uniqueness
    if ([...Object.values(flows), ...codeFiles].some(f => f.name === name)) {
        // Simple increment logic could be better but basic unique check
        const timestamp = Date.now().toString().slice(-4);
        const newName = `Flow ${timestamp}`;
        handleAddFlowWithName(newName);
    } else {
        handleAddFlowWithName(name);
    }
  };

  const handleAddFlowWithName = (name: string) => {
    const newId = `flow-${Date.now()}`;
    const newFlow: FlowData = {
      id: newId,
      name: name,
      nodes: [],
      edges: [],
      variables: []
    };
    setFlows(prev => ({ ...prev, [newId]: newFlow }));
    handleOpenTab(newId, 'flow', name);
  }

  const handleRenameFlow = (id: string, name: string) => {
    setFlows(prev => ({
      ...prev,
      [id]: { ...prev[id], name }
    }));
    setTabs(prev => prev.map(t => t.id === id ? { ...t, title: name } : t));
  };

  const handleDeleteFlow = (id: string) => {
    if (id === 'main') return;
    const newFlows = { ...flows };
    delete newFlows[id];
    setFlows(newFlows);
    if (tabs.find(t => t.id === id)) {
        handleCloseTab(id);
    }
  };

  // Code File Management
  const handleAddCodeFile = () => {
      const idStr = Date.now().toString().slice(-4);
      const name = `Script${idStr}.cs`;
      const className = `Script${idStr}`;
      const newId = `code-${Date.now()}`;
      
      const newFile: CodeFile = {
          id: newId,
          name: name,
          content: `using System;
using System.Collections.Generic;

namespace Project.Functions
{
    /// <summary>
    /// Description for ${className}
    /// </summary>
    public class ${className}
    {
        /// <summary>
        /// Execute main logic
        /// </summary>
        public void Execute()
        {
            // Your code here
        }
    }
}`,
          functions: [],
          updatedAt: new Date().toISOString(),
          refs: []
      };
      
      newFile.functions = parseCodeFunctions(newFile.content);
      setCodeFiles([...codeFiles, newFile]);
      handleOpenTab(newId, 'code', name);
  };

  const handleDeleteCodeFile = (id: string) => {
      setCodeFiles(prev => prev.filter(f => f.id !== id));
      if (tabs.find(t => t.id === id)) {
          handleCloseTab(id);
      }
  };

  const handleRenameCodeFile = (id: string, name: string) => {
      setCodeFiles(prev => prev.map(f => f.id === id ? { ...f, name } : f));
      setTabs(prev => prev.map(t => t.id === id ? { ...t, title: name } : t));
  };

  const handleUpdateCodeFile = (id: string, content: string) => {
      const parsedFunctions = parseCodeFunctions(content);
      const updated = { 
          ...codeFiles.find(f => f.id === id)!, 
          content, 
          functions: parsedFunctions, 
          updatedAt: new Date().toISOString() 
      };
      setCodeFiles(prev => prev.map(f => f.id === id ? updated : f));
  };

  const handleUpdateCodeRefs = (id: string, refs: string[]) => {
      setCodeFiles(prev => prev.map(f => f.id === id ? { ...f, refs } : f));
  };

  const handleFindReferences = (targetId: string, type: 'flow' | 'code') => {
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab && activeTab.type === 'flow') {
          saveCurrentFlowState(activeTab.id);
      }
      
      const results: ReferenceResult[] = [];
      
      (Object.values(flows) as FlowData[]).forEach(flow => {
          flow.nodes.forEach(node => {
              if (type === 'flow' && node.type === NodeType.SUB_FLOW && node.data.subFlowId === targetId) {
                  results.push({
                      flowId: flow.id,
                      flowName: flow.name,
                      nodeId: node.id,
                      nodeLabel: node.data.label,
                      context: 'SubFlow'
                  });
              }
              if (type === 'code' && node.type === NodeType.FUNCTION_CALL && node.data.codeFileId === targetId) {
                  results.push({
                      flowId: flow.id,
                      flowName: flow.name,
                      nodeId: node.id,
                      nodeLabel: node.data.label,
                      context: 'FunctionCall'
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
    abortControllerRef.current = new AbortController();

    setLogs([{
      step: 0,
      nodeId: 'system',
      nodeLabel: 'System',
      message: '开始执行流程...',
      status: 'info',
      timestamp: new Date().toISOString()
    }]);

    if (activeFlowId && activeTabId === activeFlowId) {
        saveCurrentFlowState(activeFlowId);
    }

    const flowToRun = flows[activeFlowId] || flows['main'];
    const allVariables = [...projectVariables, ...flowToRun.variables];

    try {
      const result = await executeFlowWithGemini(
          flowToRun.nodes, 
          flowToRun.edges, 
          allVariables, 
          codeFiles
      );
      
      if (abortControllerRef.current?.signal.aborted) return;

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
      if (abortControllerRef.current?.signal.aborted) return;
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
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
      }
      setIsRunning(false);
      setLogs(prev => [...prev, {
          step: 999,
          nodeId: 'system',
          nodeLabel: 'System',
          message: '用户手动停止了流程。',
          status: 'warning',
          timestamp: new Date().toISOString()
      }]);
  };

  const handleCompile = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.type === 'flow') {
        saveCurrentFlowState(activeTab.id);
    }

    const issues: ValidationIssue[] = [];
    
    (Object.values(flows) as FlowData[]).forEach(flow => {
      flow.nodes.forEach(node => {
        if (node.type === NodeType.SUB_FLOW && !node.data.subFlowId) {
          issues.push({ id: `err-${node.id}`, flowId: flow.id, nodeId: node.id, type: 'error', message: 'Sub-flow target not selected.', timestamp: new Date().toISOString() });
        }
        if (node.type === NodeType.CODE && !node.data.code) {
          issues.push({ id: `err-${node.id}`, flowId: flow.id, nodeId: node.id, type: 'error', message: 'Code block is empty.', timestamp: new Date().toISOString() });
        }
        if (node.type === NodeType.FUNCTION_CALL && (!node.data.codeFileId || !node.data.functionName)) {
            issues.push({ id: `err-${node.id}`, flowId: flow.id, nodeId: node.id, type: 'error', message: 'Function call not configured.', timestamp: new Date().toISOString() });
        }
        if (node.data.error) {
             issues.push({ id: `err-${node.id}`, flowId: flow.id, nodeId: node.id, type: 'error', message: node.data.error, timestamp: new Date().toISOString() });
        }
      });
    });

    // Check Code Files Structure
    codeFiles.forEach(f => {
        const hasNamespace = /namespace\s+[\w.]+/.test(f.content);
        const hasClass = /public\s+class\s+\w+/.test(f.content);
        if (!hasNamespace || !hasClass) {
            issues.push({ 
                id: `code-struct-${f.id}`, 
                flowId: 'code-files', 
                nodeId: f.id, 
                type: 'error', 
                message: `File '${f.name}' missing namespace or class definition.`, 
                timestamp: new Date().toISOString() 
            });
        }
    });

    setValidationIssues(issues);
    setShowCompilerPanel(true);
  };

  const handleNavigateToIssue = (flowId: string, nodeId?: string) => {
    if (flowId === 'code-files' && nodeId) {
        // Navigate to code file
        const file = codeFiles.find(f => f.id === nodeId);
        if (file) handleOpenTab(file.id, 'code', file.name);
    } else {
        // Navigate to flow
        handleOpenTab(flowId, 'flow', flows[flowId].name);
        if (nodeId) {
          setTimeout(() => {
            fitView({ nodes: [{ id: nodeId }], duration: 800, padding: 0.5 });
            setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeId })));
          }, 100);
        }
    }
  };

  const recordHistory = useCallback(() => {
    setPast(prev => [...prev.slice(-10), { nodes: getNodes(), edges: getEdges() }]);
    setFuture([]);
  }, [getNodes, getEdges]);

  const onConnect = useCallback((params: Connection) => {
    recordHistory();
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges, recordHistory]);

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
    setConfigPanelPosition({ x: event.clientX + 20, y: event.clientY - 20 });
  }, []);

  const updateNodeData = (id: string, data: Partial<AppNode['data']>) => {
    recordHistory();
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));
  };

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    if (nodes.length === 1) {
      setSelectedNode(nodes[0] as AppNode);
    } else {
      setSelectedNode(null);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setEditingNode(null);
  }, []);

  const onAutoLayout = () => {
    recordHistory();
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      getNodes(),
      getEdges()
    );
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
    setTimeout(() => fitView({ duration: 800 }), 10);
  };

  // Resolve current active tab object
  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeCodeFile = activeTab?.type === 'code' ? codeFiles.find(f => f.id === activeTabId) : null;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      <div className="flex h-full w-full overflow-hidden">
        <ProjectSidebar 
          onLoadProject={() => {}}
          onLibraryUpload={(lib) => setLibraries([...libraries, lib])}
          libraries={libraries}
          flows={flows}
          codeFiles={codeFiles}
          activeTabId={activeTabId}
          onAddFlow={handleAddFlow}
          onDeleteFlow={handleDeleteFlow}
          onRenameFlow={handleRenameFlow}
          onFindReferences={(id) => handleFindReferences(id, 'flow')}
          onAddCodeFile={handleAddCodeFile}
          onDeleteCodeFile={handleDeleteCodeFile}
          onRenameCodeFile={handleRenameCodeFile}
          onOpenTab={handleOpenTab}
          onFindCodeReferences={(id) => handleFindReferences(id, 'code')}
        />
        
        <div className="flex-1 flex flex-col relative h-full">
          <TopBar 
            onRun={handleRun}
            onStop={handleStop}
            isRunning={isRunning}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            onUndo={() => {
              if (past.length === 0) return;
              const newPast = [...past];
              const previous = newPast.pop();
              setPast(newPast);
              setFuture([ { nodes: getNodes(), edges: getEdges() }, ...future ]);
              if(previous) {
                  setNodes(previous.nodes);
                  setEdges(previous.edges);
              }
            }}
            onRedo={() => {
              if (future.length === 0) return;
              const newFuture = [...future];
              const next = newFuture.shift();
              setFuture(newFuture);
              setPast([ ...past, { nodes: getNodes(), edges: getEdges() } ]);
              if(next) {
                  setNodes(next.nodes);
                  setEdges(next.edges);
              }
            }}
            onToggleVariables={() => setShowVariablePanel(!showVariablePanel)}
            onToggleAICopilot={() => setShowAICopilot(!showAICopilot)}
            onGroupSelected={() => {}}
            onAutoLayout={onAutoLayout}
            onCompile={handleCompile}
            onToggleLanguage={() => setLang(prev => prev === 'zh' ? 'en' : 'zh')}
            currentLanguage={lang}
            selectionMode={selectionMode}
            onSetSelectionMode={setSelectionMode}
          />

          {/* Tab Bar */}
          <div className="flex items-center bg-slate-100 border-b border-slate-200 px-2 pt-2 gap-1 overflow-x-auto shrink-0 h-10 select-none">
              {tabs.map(tab => (
                  <div 
                      key={tab.id}
                      className={`
                          group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-all border-t border-x border-transparent relative min-w-[100px] max-w-[180px]
                          ${activeTabId === tab.id 
                              ? 'bg-white text-indigo-600 border-slate-200 border-b-white z-10 shadow-sm' 
                              : 'bg-slate-200/50 text-slate-500 hover:bg-slate-200 hover:text-slate-700 border-b-slate-200'}
                      `}
                      onClick={() => handleSwitchTab(tab.id, tab.type)}
                      onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
                  >
                      {tab.type === 'flow' ? <Workflow className="w-3.5 h-3.5 shrink-0" /> : <FileCode className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate flex-1" title={tab.title}>{tab.title}</span>
                      <button 
                          onClick={(e) => handleCloseTab(tab.id, e)}
                          className="p-0.5 rounded-full hover:bg-slate-300/50 text-slate-400 group-hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                          <X className="w-3 h-3" />
                      </button>
                      {activeTabId === tab.id && <div className="absolute bottom-[-1px] left-0 right-0 h-1 bg-white"></div>}
                  </div>
              ))}
          </div>

          {/* Tab Context Menu */}
          {tabContextMenu && (
              <div 
                  className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 w-40 py-1 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                  style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
              >
                  <button 
                      onClick={() => {
                          handleCloseTab(tabContextMenu.id);
                          setTabContextMenu(null);
                      }}
                      className="px-3 py-2 text-xs text-slate-700 hover:bg-red-50 hover:text-red-600 text-left w-full transition-colors"
                  >
                      关闭标签
                  </button>
                  <button 
                      onClick={handleCloseOtherTabs}
                      className="px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 text-left w-full transition-colors"
                  >
                      关闭其他标签
                  </button>
              </div>
          )}

          <div className="flex-1 relative flex flex-col overflow-hidden">
            {/* Conditional Rendering based on Active Tab Type */}
            {activeTab?.type === 'flow' ? (
                <div className="flex-1 relative bg-slate-50" ref={reactFlowWrapper}>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                    onNodeDoubleClick={onNodeDoubleClick}
                    onPaneClick={onPaneClick}
                    onSelectionChange={onSelectionChange}
                    nodeTypes={nodeTypes}
                    fitView
                    panOnDrag={selectionMode === 'pan'}
                    selectionMode={selectionMode === 'select' ? SelectionMode.Partial : undefined}
                    selectNodesOnDrag={selectionMode === 'select'}
                    attributionPosition="bottom-right"
                    defaultEdgeOptions={{ type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed } }}
                  >
                    <Controls className="bg-white shadow-lg border border-slate-100 rounded-md p-1" />
                    <Background color="#cbd5e1" gap={15} size={1} variant={BackgroundVariant.Dots} />
                  </ReactFlow>
                  
                  <Sidebar isRunning={isRunning} />
                  
                  <AICopilot 
                    isOpen={showAICopilot} 
                    onClose={() => setShowAICopilot(false)} 
                    currentNodes={nodes}
                    onApplyFlow={(data) => {
                        recordHistory();
                        setNodes(prev => [...prev, ...data.nodes]);
                        setEdges(prev => [...prev, ...data.edges]);
                        if (data.variables) {
                            setFlows(prev => ({
                                ...prev, 
                                [activeFlowId]: {
                                    ...prev[activeFlowId],
                                    variables: [...prev[activeFlowId].variables, ...data.variables]
                                }
                            }));
                        }
                    }}
                    selectedNodeId={selectedNode?.id}
                    variables={[...projectVariables, ...flows[activeFlowId].variables]}
                    mode="flow"
                  />

                  <NodeConfigPanel 
                    node={editingNode} 
                    onClose={() => setEditingNode(null)} 
                    onChange={updateNodeData}
                    variables={[...projectVariables, ...flows[activeFlowId].variables]}
                    libraries={libraries}
                    structs={structs}
                    codeFiles={codeFiles}
                    initialPosition={configPanelPosition}
                    flows={flows}
                  />

                  <VariablePanel 
                    isOpen={showVariablePanel} 
                    onClose={() => setShowVariablePanel(false)}
                    variables={flows[activeFlowId].variables}
                    globalVariables={projectVariables}
                    structs={structs}
                    setVariables={(vars) => setFlows(prev => ({...prev, [activeFlowId]: {...prev[activeFlowId], variables: vars}}))}
                    setGlobalVariables={setProjectVariables}
                    setStructs={setStructs}
                    nodes={nodes}
                  />

                  <CompilerPanel
                      isOpen={showCompilerPanel}
                      onClose={() => setShowCompilerPanel(false)}
                      issues={validationIssues}
                      onNavigate={handleNavigateToIssue}
                  />

                  {showReferencePanel && (
                      <DraggablePanel title="References" onClose={() => setShowReferencePanel(false)}>
                          <div className="p-4 bg-white h-full overflow-y-auto">
                              {referenceResults.length === 0 ? <div className="text-slate-500 text-sm">No references found.</div> : (
                                  referenceResults.map((res, i) => (
                                      <div key={i} className="cursor-pointer hover:bg-slate-100 p-2 border-b border-slate-100" onClick={() => handleNavigateToIssue(res.flowId, res.nodeId)}>
                                          <div className="font-medium text-sm text-indigo-600">{res.flowName} <span className="text-xs text-slate-400">({res.context})</span></div>
                                          <div className="text-xs text-slate-500">Node: {res.nodeLabel}</div>
                                      </div>
                                  ))
                              )}
                          </div>
                      </DraggablePanel>
                  )}
                </div>
            ) : activeTab?.type === 'code' && activeCodeFile ? (
                <div className="flex-1 relative bg-slate-900 overflow-hidden flex flex-col">
                    <div className="bg-slate-800 text-slate-400 px-4 py-2 text-xs border-b border-slate-700 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200">{activeCodeFile.name}</span>
                            <span className="text-[10px] opacity-50 bg-slate-700 px-1 rounded">C#</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {/* Simple Reference Selector */}
                            <div className="relative group">
                                <button className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                                    <Link2 className="w-3 h-3" />
                                    <span>引用 ({activeCodeFile.refs?.length || 0})</span>
                                </button>
                                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-600 rounded shadow-xl hidden group-hover:block z-50 p-1">
                                    {codeFiles.filter(f => f.id !== activeCodeFile.id).length === 0 ? (
                                        <div className="p-2 text-slate-500 italic">无其他代码文件</div>
                                    ) : (
                                        codeFiles.filter(f => f.id !== activeCodeFile.id).map(f => {
                                            const isRef = activeCodeFile.refs?.includes(f.id);
                                            return (
                                                <button 
                                                    key={f.id}
                                                    onClick={() => {
                                                        const newRefs = isRef 
                                                            ? (activeCodeFile.refs || []).filter(r => r !== f.id)
                                                            : [...(activeCodeFile.refs || []), f.id];
                                                        handleUpdateCodeRefs(activeCodeFile.id, newRefs);
                                                    }}
                                                    className={`flex items-center justify-between w-full px-2 py-1 text-left hover:bg-slate-700 rounded ${isRef ? 'text-indigo-400' : 'text-slate-400'}`}
                                                >
                                                    <span className="truncate">{f.name}</span>
                                                    {isRef && <span className="text-[10px]">✓</span>}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            
                            <div className="h-4 w-px bg-slate-700 mx-2"></div>
                            
                            {/* Validation Status Indicator */}
                            {(!/namespace\s+[\w.]+/.test(activeCodeFile.content) || !/public\s+class\s+\w+/.test(activeCodeFile.content)) && (
                                <div className="flex items-center gap-1 text-amber-500 text-[10px] mr-2" title="Missing namespace or class">
                                    <AlertTriangle className="w-3 h-3" />
                                    结构不完整
                                </div>
                            )}

                            <span className="text-[10px] opacity-50">Last updated: {new Date(activeCodeFile.updatedAt).toLocaleTimeString()}</span>
                        </div>
                    </div>
                    <CodeEditor 
                        value={activeCodeFile.content} 
                        onChange={(val) => handleUpdateCodeFile(activeCodeFile.id, val)} 
                        variables={[]} // Global vars could be passed here if needed for autocomplete in C# context
                        isFullscreen={true}
                        className="flex-1 border-0 rounded-none"
                        onCursorChange={setCodeCursorIndex}
                    />
                    
                    <AICopilot 
                        isOpen={showAICopilot} 
                        onClose={() => setShowAICopilot(false)} 
                        currentNodes={[]}
                        onApplyFlow={() => {}}
                        onApplyCode={(code) => {
                            // Insert code at the specific cursor position
                            let currentContent = activeCodeFile.content;
                            let insertPos = codeCursorIndex;

                            // Safety check: if cursor is out of bounds or default (0), try to find a smart place
                            if (insertPos < 0 || insertPos > currentContent.length) {
                                // Fallback: try to insert before the last closing brace of class or namespace
                                const lastBrace = currentContent.lastIndexOf('}');
                                if (lastBrace > -1) {
                                    insertPos = lastBrace;
                                } else {
                                    insertPos = currentContent.length;
                                }
                            }

                            const before = currentContent.slice(0, insertPos);
                            const after = currentContent.slice(insertPos);
                            // Ensure proper spacing if needed
                            const newContent = before + '\n' + code + '\n' + after;
                            
                            handleUpdateCodeFile(activeCodeFile.id, newContent);
                        }}
                        variables={projectVariables}
                        mode="code"
                        activeCodeContent={activeCodeFile.content}
                        initialPosition={{ x: window.innerWidth - 520, y: 100 }}
                    />
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
                    <div className="text-center">
                        <Workflow className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>No active tab selected.</p>
                        <button onClick={handleAddFlow} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
                            Create New Flow
                        </button>
                    </div>
                </div>
            )}
            
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
