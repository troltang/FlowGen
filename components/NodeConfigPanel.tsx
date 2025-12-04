import React, { useState, useEffect, useMemo } from 'react';
import { AppNode, NodeType, Variable, Library } from '../types';
import { Copy, Settings2, CheckCircle2, AlertCircle, FileCode, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { VariableInput } from './VariableInput';
import { DraggablePanel } from './DraggablePanel';
import { CodeEditor } from './CodeEditor';

interface NodeConfigPanelProps {
  node: AppNode | null;
  onClose: () => void;
  onChange: (id: string, data: Partial<AppNode['data']>) => void;
  variables: Variable[];
  libraries?: Library[];
  zIndex?: number;
  onInteract?: () => void;
  initialPosition?: { x: number; y: number };
}

const CODE_TEMPLATES = [
  { label: '基础运算', description: '简单的数值加法', value: 'int result = count + 1;\nreturn result;' },
  { label: '随机数', description: '生成 1-100 的随机数', value: 'Random rnd = new Random();\nint val = rnd.Next(1, 100);\nreturn val;' },
  { label: '字符串拼接', description: '格式化输出信息', value: 'string msg = $"User: {name}, Date: {DateTime.Now}";\nreturn msg;' },
  { label: '条件分支', description: '基于值的 If-Else', value: 'if (score >= 60) \n    return "Pass";\nelse \n    return "Fail";' },
  { label: '获取时间', description: '当前格式化时间', value: 'return DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");' },
  { label: 'JSON 处理', description: '模拟 JSON 数据提取', value: '// 假定 input 是 JSON 字符串\n// dynamic data = JsonConvert.DeserializeObject(input);\nreturn "processed_json";' }
];

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ 
  node, 
  onClose, 
  onChange, 
  variables,
  libraries = [],
  zIndex,
  onInteract,
  initialPosition 
}) => {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [duration, setDuration] = useState(1000);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFullscreenEditor, setShowFullscreenEditor] = useState(false);

  useEffect(() => {
    if (node) {
      setLabel(node.data.label);
      setDescription(node.data.description || '');
      setCode(node.data.code || '');
      setDuration(node.data.duration || 1000);
    }
  }, [node]);

  // Detect used variables in the current configuration
  const usedVariables = useMemo(() => {
    const foundNames = new Set<string>();

    // 1. Scan text fields for {variable} syntax
    const textFields = [label, description];
    textFields.forEach(text => {
      if (!text) return;
      const matches = text.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
      if (matches) {
        matches.forEach(m => foundNames.add(m.slice(1, -1)));
      }
    });

    // 2. If Code node, scan for variable names directly (if they match defined vars) or {variable} syntax
    if (node?.type === NodeType.CODE && code) {
       // Check for usage of existing global variables in code
       variables.forEach(v => {
         // Simple regex to check for whole word match to avoid partial matches
         const escapedName = v.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
         const regex = new RegExp(`\\b${escapedName}\\b`);
         if (regex.test(code)) {
           foundNames.add(v.name);
         }
       });
       
       // Also check for explicit {variable} interpolation in code strings/comments
       const matches = code.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
       if (matches) {
         matches.forEach(m => foundNames.add(m.slice(1, -1)));
       }
    }

    // Map to object with status
    return Array.from(foundNames).map(name => {
      const def = variables.find(v => v.name === name);
      return {
        name,
        isDefined: !!def,
        value: def?.value ?? 'N/A',
        type: def?.type ?? 'unknown'
      };
    });
  }, [label, description, code, node?.type, variables]);

  if (!node) return null;

  const handleSave = () => {
    onChange(node.id, {
      label,
      description,
      code,
      duration,
      // Clear error on save
      error: undefined
    });
    onClose(); // Close the panel after saving
  };

  const getTypeLabel = (type?: string) => {
    switch(type) {
      case NodeType.START: return '开始节点';
      case NodeType.END: return '结束节点';
      case NodeType.PROCESS: return '处理节点';
      case NodeType.DECISION: return '判断节点';
      case NodeType.AI_TASK: return 'AI 任务';
      case NodeType.CODE: return 'C# 代码';
      case NodeType.DELAY: return '延时';
      case NodeType.LOG: return '日志';
      case NodeType.GROUP: return '节点组';
      default: return '未知节点';
    }
  };

  return (
    <>
      <DraggablePanel
        title={`配置: ${label || '未命名节点'}`}
        icon={Settings2}
        initialPosition={initialPosition || { x: window.innerWidth - 350, y: 100 }}
        initialSize={{ width: 400, height: 500 }}
        onClose={onClose}
        zIndex={zIndex}
        onInteract={onInteract}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono bg-slate-200 px-1.5 py-0.5 rounded truncate max-w-[200px]" title={node.id}>
                 ID: {node.id}
              </span>
              <div className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-medium border border-indigo-100">
                {getTypeLabel(node.type)}
              </div>
            </div>
          </div>
          
          <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-white">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                标签名称 <span className="text-red-500">*</span>
              </label>
              <VariableInput
                 value={label}
                 onChange={setLabel}
                 variables={variables}
                 placeholder="输入节点名称..."
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all"
              />
            </div>

            {/* C# Code Editor */}
            {node.type === NodeType.CODE && (
              <div>
                 <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      C# 代码逻辑 <span className="text-red-500">*</span>
                    </label>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowFullscreenEditor(true)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="全屏编辑"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="relative">
                        <button
                          onClick={() => setShowTemplates(!showTemplates)}
                          className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors"
                        >
                          <FileCode className="w-3 h-3" />
                          <span>插入模板</span>
                          <ChevronDown className="w-3 h-3 opacity-50" />
                        </button>

                        {showTemplates && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setShowTemplates(false)} />
                            <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 shadow-xl rounded-lg py-1 z-30 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                               <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 font-semibold uppercase">选择代码模板</div>
                               {CODE_TEMPLATES.map((t, i) => (
                                 <button
                                   key={i}
                                   onClick={() => {
                                     setCode(prev => prev ? `${prev}\n\n${t.value}` : t.value);
                                     setShowTemplates(false);
                                   }}
                                   className="text-left px-3 py-2 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0 group"
                                 >
                                   <div className="text-xs font-medium text-slate-700 group-hover:text-indigo-700">{t.label}</div>
                                   <div className="text-[10px] text-slate-400 truncate mt-0.5">{t.description}</div>
                                 </button>
                               ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                 </div>
                 
                 <CodeEditor 
                   value={code} 
                   onChange={setCode} 
                   variables={variables} 
                   libraries={libraries}
                   className="h-[200px]"
                 />
                 <p className="text-[10px] text-slate-400 mt-1">
                   输入 <code>{"{"}</code> 触发变量联想。支持基础语法高亮和括号检查。
                 </p>
              </div>
            )}

            {/* Delay Config */}
            {node.type === NodeType.DELAY && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  延时时长 (毫秒)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                />
              </div>
            )}

            {(node.type === NodeType.PROCESS || node.type === NodeType.AI_TASK || node.type === NodeType.LOG || node.type === NodeType.DECISION) && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {node.type === NodeType.AI_TASK ? 'Prompt / 指令' : node.type === NodeType.DECISION ? '判断条件' : '描述/内容'} <span className="text-red-500">*</span>
                </label>
                 <VariableInput
                    isTextArea={true}
                    value={description}
                    onChange={setDescription}
                    variables={variables}
                    placeholder={node.type === NodeType.AI_TASK ? "描述AI需要做什么..." : node.type === NodeType.DECISION ? "例如: {count} > 5" : "描述此步骤的功能..."}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm min-h-[100px] resize-none transition-all"
                 />
                 {node.type === NodeType.DECISION && (
                   <p className="text-[10px] text-slate-400 mt-1">支持变量比较，如 {`{variable} > 10`}</p>
                 )}
              </div>
            )}

            {/* Used Variables Display */}
            {usedVariables.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>引用的变量 ({usedVariables.length})</span>
                  <span className="text-[10px] font-normal normal-case text-slate-400">自动检测</span>
                </label>
                <div className="space-y-2">
                  {usedVariables.map(uv => (
                    <div key={uv.name} className={`flex items-center justify-between text-xs p-2 rounded border ${uv.isDefined ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-center gap-2">
                        {uv.isDefined ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        <span className={`font-mono font-medium ${uv.isDefined ? 'text-slate-700' : 'text-amber-700'}`}>
                          {uv.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                         {uv.isDefined && (
                           <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 rounded text-slate-500">
                             {uv.type}
                           </span>
                         )}
                         <span className="text-slate-400 max-w-[80px] truncate" title={String(uv.value)}>
                           {uv.isDefined ? (uv.value === '' ? '(空)' : String(uv.value)) : '未定义'}
                         </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-slate-100 flex-shrink-0 bg-slate-50">
             <button
              onClick={handleSave}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              应用更改
            </button>
          </div>
        </div>
      </DraggablePanel>

      {/* Fullscreen Code Editor Modal */}
      {showFullscreenEditor && node.type === NodeType.CODE && (
        <DraggablePanel
          title={`编辑代码: ${label}`}
          icon={FileCode}
          initialPosition={{ x: 50, y: 50 }}
          initialSize={{ width: Math.min(window.innerWidth * 0.8, 1000), height: Math.min(window.innerHeight * 0.8, 800) }}
          minSize={{ width: 400, height: 400 }}
          onClose={() => setShowFullscreenEditor(false)}
          zIndex={(zIndex || 50) + 10}
          onInteract={onInteract}
          headerColor="bg-slate-800 text-slate-200 border-slate-700"
          className="max-h-[90vh] max-w-[95vw]"
        >
          <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
            <div className="flex-1 min-h-0 relative">
              <CodeEditor 
                value={code} 
                onChange={setCode} 
                variables={variables} 
                libraries={libraries}
                className="absolute inset-0 h-full w-full border-0 rounded-none"
                isFullscreen={true}
              />
            </div>
            <div className="p-3 bg-slate-800 border-t border-slate-700 flex justify-end gap-2 shrink-0 z-10 relative">
               <button 
                 onClick={() => setShowFullscreenEditor(false)}
                 className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors text-sm"
               >
                 关闭
               </button>
               <button 
                 onClick={() => { handleSave(); setShowFullscreenEditor(false); }}
                 className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition-colors text-sm shadow-md"
               >
                 保存并关闭
               </button>
            </div>
          </div>
        </DraggablePanel>
      )}
    </>
  );
};