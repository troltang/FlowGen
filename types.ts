import { Node, Edge } from 'reactflow';

export enum NodeType {
  START = 'start',
  PROCESS = 'process',
  DECISION = 'decision',
  AI_TASK = 'aiTask',
  END = 'end',
  DELAY = 'delay',
  CODE = 'code',
  LOG = 'log',
  GROUP = 'group'
}

export interface Variable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean';
  value: string;
}

export interface LibraryMethod {
  name: string;
  returnType: string;
  description?: string;
  parameters: string[];
}

export interface Library {
  id: string;
  name: string; // e.g., "MyHelper.dll"
  namespace: string; // e.g., "MyHelper.Utils"
  methods: LibraryMethod[];
}

export interface FlowNodeData {
  label: string;
  description?: string;
  code?: string; // For C# code
  duration?: number; // For delay
  variableName?: string; // For binding to variables
  isActive?: boolean; // For execution highlighting
  error?: string; // For validation errors
  onConfigChange?: (newLabel: string, newDesc: string) => void;
}

// Extension of the standard Node type to include our specific data
export type AppNode = Node<FlowNodeData>;

export interface ExecutionLog {
  step: number;
  nodeId: string;
  nodeLabel: string;
  message: string;
  timestamp: string;
  status: 'info' | 'success' | 'warning' | 'error';
}

export interface ExecutionResult {
  success: boolean;
  logs: ExecutionLog[];
  finalOutput?: string;
  finalVariables?: Record<string, any>;
}

// Project Management Types
export interface ProjectFile {
  id: string;
  name: string;
  updatedAt: string;
}

export interface ProjectFolder {
  id: string;
  name: string;
  files: ProjectFile[];
  folders: ProjectFolder[];
  isOpen?: boolean;
}

export interface SystemKeyword {
  label: string;
  value: string;
  description: string;
}

export interface GeneratedFlowData {
  nodes: AppNode[];
  edges: Edge[];
  variables: Variable[];
}