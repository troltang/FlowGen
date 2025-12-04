import React, { useState } from 'react';
import { Sparkles, Send, Bot, Loader2 } from 'lucide-react';
import { AppNode, GeneratedFlowData, Variable } from '../types';
import { generateFlowFromDescription } from '../services/geminiService';
import { DraggablePanel } from './DraggablePanel';
import { VariableInput } from './VariableInput';

interface AICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  currentNodes: AppNode[];
  onApplyFlow: (data: GeneratedFlowData) => void;
  selectedNodeId?: string;
  zIndex?: number;
  onInteract?: () => void;
  initialPosition?: { x: number; y: number };
  variables?: Variable[];
}

export const AICopilot: React.FC<AICopilotProps> = ({ 
  isOpen, 
  onClose, 
  currentNodes, 
  onApplyFlow,
  selectedNodeId,
  zIndex,
  onInteract,
  initialPosition,
  variables = []
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    const result = await generateFlowFromDescription(input, currentNodes, selectedNodeId);
    setLoading(false);
    
    if (result.nodes.length > 0) {
      onApplyFlow(result);
      setInput(''); // Clear input on success
    }
  };

  return (
    <DraggablePanel
      title="AI 流程编程助手"
      icon={Bot}
      initialPosition={initialPosition || { x: window.innerWidth / 2 - 250, y: 100 }}
      initialSize={{ width: 500, height: 450 }}
      onClose={onClose}
      headerColor="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
      zIndex={zIndex}
      onInteract={onInteract}
    >
      <div className="flex flex-col h-full bg-slate-50">
        <div className="flex-1 p-4 overflow-y-auto">
          {selectedNodeId ? (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-4 text-xs text-indigo-700 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              <span>模式: <strong>追加生成</strong> (将在 ID: {selectedNodeId} 后添加流程)</span>
            </div>
          ) : (
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 mb-4 text-xs text-slate-600 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              <span>模式: <strong>新流程生成</strong> (将清空或创建独立流程)</span>
            </div>
          )}

          <label className="block text-sm font-semibold text-slate-700 mb-2">
            描述您想要实现的逻辑:
          </label>
          <VariableInput
            value={input}
            onChange={setInput}
            variables={variables}
            isTextArea={true}
            placeholder={selectedNodeId 
              ? "例如: 如果 {userAge} 大于18，发送欢迎邮件，否则结束流程..." 
              : "例如: 创建一个用户登录检查流程，包含输入验证、数据库查询和日志记录..."
            }
            className="w-full h-32 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-sm mb-4"
          />
          <p className="text-[10px] text-slate-400 mt-1">
             提示: 使用 <code>{`{`}</code> 引用变量，使用 <code>@</code> 引用系统参数。
          </p>
        </div>

        <div className="p-4 bg-white border-t border-slate-100 shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">Powered by Gemini 2.5</span>
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
              ${loading || !input.trim()
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg active:scale-95'}
            `}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在生成...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                开始生成
              </>
            )}
          </button>
        </div>
      </div>
    </DraggablePanel>
  );
};