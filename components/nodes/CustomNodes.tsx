import React, { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';
import { Play, Square, GitFork, Sparkles, StopCircle, Code2, Clock, Terminal, Box, AlertTriangle } from 'lucide-react';
import { FlowNodeData } from '../../types';

// Wrapper for common node styling
const NodeWrapper = ({ 
  children, 
  title, 
  colorClass, 
  icon: Icon,
  selected,
  isActive,
  error,
  minWidth = "min-w-[160px]"
}: { 
  children?: React.ReactNode; 
  title: string; 
  colorClass: string; 
  icon: React.ElementType;
  selected?: boolean;
  isActive?: boolean;
  error?: string;
  minWidth?: string;
}) => (
  <div className={`
    shadow-lg rounded-lg border-2 bg-white ${minWidth} transition-all duration-300 relative
    ${error 
      ? 'border-red-500 ring-2 ring-red-200' 
      : isActive 
        ? 'border-emerald-500 ring-4 ring-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-105 z-50' 
        : selected 
          ? 'border-blue-500 ring-2 ring-blue-200' 
          : 'border-slate-200'
    } 
    ${!error && colorClass}
  `}>
    {error && (
      <div className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 shadow-md z-50" title={error}>
        <AlertTriangle className="w-4 h-4" />
      </div>
    )}
    <div className={`flex items-center px-3 py-2 border-b border-gray-100 rounded-t-lg ${error ? 'bg-red-50' : isActive ? 'bg-emerald-50' : 'bg-gray-50/50'}`}>
      <Icon className={`w-4 h-4 mr-2 ${error ? 'text-red-500' : isActive ? 'text-emerald-600 animate-pulse' : 'opacity-70'}`} />
      <span className={`text-xs font-bold uppercase tracking-wider ${error ? 'text-red-700' : isActive ? 'text-emerald-700' : ''}`}>{title}</span>
      {isActive && (
        <span className="ml-auto flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      )}
    </div>
    <div className="p-3">
      {children}
    </div>
  </div>
);

export const StartNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  return (
    <NodeWrapper title="开始" colorClass="border-l-4 border-l-emerald-500" icon={Play} selected={selected} isActive={data.isActive} error={data.error}>
      <div className="text-sm font-medium text-slate-700 text-center">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-3 !h-3" title="输出: 开始执行" />
    </NodeWrapper>
  );
});

export const EndNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  return (
    <NodeWrapper title="结束" colorClass="border-l-4 border-l-red-500" icon={StopCircle} selected={selected} isActive={data.isActive} error={data.error}>
      <div className="text-sm font-medium text-slate-700 text-center">{data.label}</div>
      <Handle type="target" position={Position.Top} className="!bg-red-500 !w-3 !h-3" title="输入: 流程结束" />
    </NodeWrapper>
  );
});

export const ProcessNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  return (
    <NodeWrapper title="处理" colorClass="border-l-4 border-l-blue-500" icon={Square} selected={selected} isActive={data.isActive} error={data.error}>
       <Handle type="target" position={Position.Top} className="!bg-blue-300 !w-3 !h-3" title="输入: 上一步骤" />
      <div className="text-sm text-slate-800">{data.label}</div>
      {data.description && <div className="text-xs text-slate-500 mt-1 truncate max-w-[140px]">{data.description}</div>}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" title="输出: 下一步骤" />
    </NodeWrapper>
  );
});

export const AITaskNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  return (
    <NodeWrapper title="AI 任务" colorClass="border-l-4 border-l-purple-500" icon={Sparkles} selected={selected} isActive={data.isActive} error={data.error}>
      <Handle type="target" position={Position.Top} className="!bg-purple-300 !w-3 !h-3" title="输入: 触发AI任务" />
      <div className="text-sm text-slate-800 font-medium bg-purple-50 p-2 rounded border border-purple-100 mb-1">
        {data.label}
      </div>
      <div className="text-xs text-slate-500 italic">Gemini 2.5 Flash</div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3" title="输出: 任务完成" />
    </NodeWrapper>
  );
});

export const DecisionNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  return (
    <NodeWrapper title="判断" colorClass="border-l-4 border-l-amber-500" icon={GitFork} selected={selected} isActive={data.isActive} error={data.error}>
      <Handle type="target" position={Position.Top} className="!bg-amber-300 !w-3 !h-3" title="输入: 进行判断" />
      
      <div className="text-sm font-medium text-center my-2">{data.label}</div>
      
      <div className="flex justify-between w-full mt-3 px-1 gap-4">
        <div className="relative">
          <span className="absolute -bottom-6 -left-1 text-[10px] font-bold text-green-600">是</span>
          <Handle type="source" position={Position.Bottom} id="true" className="!bg-green-500 !w-3 !h-3 !left-2" title="输出: 条件为真 (True)" />
        </div>
        <div className="relative">
          <span className="absolute -bottom-6 -right-1 text-[10px] font-bold text-red-600">否</span>
          <Handle type="source" position={Position.Bottom} id="false" className="!bg-red-500 !w-3 !h-3 !left-auto !right-2" title="输出: 条件为假 (False)" />
        </div>
      </div>
    </NodeWrapper>
  );
});

export const CodeNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  return (
    <NodeWrapper 
      title="C# 代码" 
      colorClass="border-l-4 border-l-slate-700" 
      icon={Code2} 
      selected={selected} 
      isActive={data.isActive} 
      error={data.error}
      minWidth="w-[200px]"
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-500 !w-3 !h-3" title="输入: 执行代码" />
      <div className="text-sm text-slate-800 font-mono truncate">{data.label}</div>
      <div className="text-[10px] text-slate-400 mt-1 font-mono bg-slate-100 p-1.5 rounded overflow-hidden h-7 whitespace-nowrap w-full relative">
        {data.code ? (
          <span className="opacity-80">{data.code}</span>
        ) : (
          <span className="italic opacity-50">// 在此输入代码...</span>
        )}
        <div className="absolute top-0 right-0 h-full w-4 bg-gradient-to-l from-slate-100 to-transparent pointer-events-none" />
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-700 !w-3 !h-3" title="输出: 执行完毕" />
    </NodeWrapper>
  );
});

export const DelayNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  return (
    <NodeWrapper title="延时" colorClass="border-l-4 border-l-orange-400" icon={Clock} selected={selected} isActive={data.isActive} error={data.error}>
      <Handle type="target" position={Position.Top} className="!bg-orange-300 !w-3 !h-3" title="输入: 开始计时" />
      <div className="text-sm text-slate-800 text-center">
        {data.label}
      </div>
      <div className="text-xs text-orange-600 font-bold text-center mt-1">
        {data.duration || 1000} ms
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !w-3 !h-3" title="输出: 延时结束" />
    </NodeWrapper>
  );
});

export const LogNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
  return (
    <NodeWrapper title="日志" colorClass="border-l-4 border-l-gray-500" icon={Terminal} selected={selected} isActive={data.isActive} error={data.error}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" title="输入: 记录日志" />
      <div className="text-sm text-slate-800">{data.label}</div>
      <div className="text-xs text-gray-500 mt-1 italic">
        打印至控制台
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-600 !w-3 !h-3" title="输出: 下一步骤" />
    </NodeWrapper>
  );
});

export const GroupNode = memo(({ data, selected, id }: NodeProps<FlowNodeData>) => {
  return (
    <div className={`rounded-lg border-2 border-dashed bg-slate-50/50 w-full h-full transition-colors duration-200 ${selected ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300'}`}>
      <NodeResizer minWidth={200} minHeight={100} isVisible={selected} lineClassName="border-indigo-400" handleClassName="h-3 w-3 bg-indigo-500 border border-white rounded" />
      <div className="absolute -top-3 left-4 px-2 bg-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider rounded border border-slate-300 flex items-center gap-1">
        <Box className="w-3 h-3" />
        {data.label}
      </div>
    </div>
  );
});