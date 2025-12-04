import { Edge, Node } from 'reactflow';
import { NodeType, FlowNodeData, Variable, SystemKeyword } from './types';

export const INITIAL_VARIABLES: Variable[] = [
  { id: 'v1', name: 'userCount', type: 'number', value: '0' },
  { id: 'v2', name: 'status', type: 'string', value: 'active' }
];

export const INITIAL_NODES: Node<FlowNodeData>[] = [
  {
    id: '1',
    type: NodeType.START,
    position: { x: 250, y: 50 },
    data: { label: '开始流程' },
  },
  {
    id: '2',
    type: NodeType.CODE,
    position: { x: 250, y: 150 },
    data: { 
      label: '初始化数据 (C#)', 
      code: 'int userCount = 10;\nreturn userCount;' 
    },
  },
  {
    id: '3',
    type: NodeType.DELAY,
    position: { x: 250, y: 300 },
    data: { label: '等待响应', duration: 2000 },
  },
  {
    id: '4',
    type: NodeType.DECISION,
    position: { x: 250, y: 450 },
    data: { label: '用户 > 5?' },
  },
  {
    id: '5',
    type: NodeType.LOG,
    position: { x: 100, y: 600 },
    data: { label: '记录高流量', description: '检测到高并发用户' },
  },
  {
    id: '6',
    type: NodeType.END,
    position: { x: 275, y: 750 },
    data: { label: '结束' },
  }
];

export const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e3-4', source: '3', target: '4' },
  { id: 'e4-5', source: '4', target: '5', sourceHandle: 'true', label: '是' },
  { id: 'e4-6', source: '4', target: '6', sourceHandle: 'false', label: '否' },
  { id: 'e5-6', source: '5', target: '6' },
];

export const SYSTEM_KEYWORDS: SystemKeyword[] = [
  { label: '时间戳', value: '@TIMESTAMP', description: '当前时间的毫秒时间戳' },
  { label: '日期', value: '@DATE', description: '当前日期 YYYY-MM-DD' },
  { label: 'UUID', value: '@UUID', description: '生成唯一的 UUID' },
  { label: '用户ID', value: '@USER_ID', description: '当前执行用户的 ID' },
  { label: '系统版本', value: '@SYS_VERSION', description: '当前系统版本号' },
];