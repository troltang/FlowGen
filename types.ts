
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
  GROUP = 'group',
  HTTP = 'http',
  DB = 'db',
  LOOP = 'loop',
  SUB_FLOW = 'subflow',
  FUNCTION_CALL = 'functionCall'
}

export type VariableType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'integer' 
  | 'float' 
  | 'datetime' 
  | 'object' 
  | string; // For Struct names

export interface StructField {
  name: string;
  type: VariableType;
  isArray?: boolean;
}

export interface StructDefinition {
  id: string;
  name: string;
  fields: StructField[];
}

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  value: string;
  isArray?: boolean;
  isGlobal?: boolean;
}

// --- DLL / Library Types ---

export interface LibraryMethod {
  name: string;
  returnType: string;
  parameters: { name: string; type: string }[];
  description?: string;
  isStatic?: boolean;
}

export interface LibraryProperty {
  name: string;
  type: string;
  description?: string;
}

export interface LibraryClass {
  name: string;
  description?: string;
  methods: LibraryMethod[];
  properties: LibraryProperty[];
}

export interface LibraryNamespace {
  name: string;
  classes: LibraryClass[];
}

export interface Library {
  id: string;
  name: string; // filename.dll
  namespaces: LibraryNamespace[];
  uploadDate: string;
}

// --- Code Function Types ---

export interface FunctionParameter {
  name: string;
  type: string;
}

export interface FunctionDefinition {
  name: string;
  returnType: string;
  parameters: FunctionParameter[];
  description?: string; // Extracted from comments
}

export interface CodeFile {
  id: string;
  name: string;
  content: string;
  functions: FunctionDefinition[];
  updatedAt: string;
  refs?: string[]; // IDs of referenced CodeFiles
}

// ---------------------------

export interface FlowNodeData {
  label: string;
  description?: string;
  code?: string;
  duration?: number;
  variableName?: string;
  isActive?: boolean;
  error?: string;
  onConfigChange?: (newLabel: string, newDesc: string) => void;
  
  // HTTP Node Data
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string;
  httpBody?: string;

  // DB Node Data
  dbOperation?: 'connect' | 'insert' | 'update' | 'delete' | 'select' | 'execute';
  connectionString?: string;
  sql?: string;

  // Loop Node Data
  loopCondition?: string;

  // Sub Flow Data
  subFlowId?: string;

  // Function Call Data
  codeFileId?: string;
  functionName?: string;
  parameterValues?: Record<string, string>; // paramName -> variable expression or value
}

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

// Multi-flow support
export interface FlowData {
  id: string;
  name: string;
  nodes: AppNode[];
  edges: Edge[];
  variables: Variable[]; // Local variables
}

// Compiler/Validation
export interface ValidationIssue {
  id: string;
  flowId: string;
  nodeId?: string;
  type: 'error' | 'warning';
  message: string;
  timestamp: string;
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
