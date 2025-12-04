
import React, { useState, useEffect, useMemo } from 'react';
import { AppNode, NodeType, Variable, Library, FlowData, StructDefinition } from '../types';
import { Copy, Settings2, CheckCircle2, AlertCircle, FileCode, ChevronDown, Maximize2, Minimize2, Workflow, ArrowRightLeft } from 'lucide-react';
import { VariableInput } from './VariableInput';
import { DraggablePanel } from './DraggablePanel';
import { CodeEditor } from './CodeEditor';
import { useTranslation } from '../utils/i18n';

interface NodeConfigPanelProps {
  node: AppNode | null;
  onClose: () => void;
  onChange: (id: string, data: Partial<AppNode['data']>) => void;
  variables: Variable[];
  libraries?: Library[];
  structs?: StructDefinition[];
  zIndex?: number;
  onInteract?: () => void;
  initialPosition?: { x: number; y: number };
  flows?: Record<string, FlowData>; // All available flows
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
  structs = [],
  zIndex,
  onInteract,
  initialPosition,
  flows = {}
}) => {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [duration, setDuration] = useState(1000);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFullscreenEditor, setShowFullscreenEditor] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // New state fields
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [headers, setHeaders] = useState('');
  const [httpBody, setHttpBody] = useState('');
  const [dbOperation, setDbOperation] = useState<any>('select');
  const [connectionString, setConnectionString] = useState('');
  const [sql, setSql] = useState('');
  const [loopCondition, setLoopCondition] = useState('');
  const [subFlowId, setSubFlowId] = useState('');

  useEffect(() => {
    if (node) {
      setLabel(node.data.label);
      setDescription(node.data.description || '');
      setCode(node.data.code || '');
      setDuration(node.data.duration || 1000);
      
      // Load new fields
      setUrl(node.data.url || '');
      setMethod(node.data.method || 'GET');
      setHeaders(node.data.headers || '');
      setHttpBody(node.data.httpBody || '');
      setDbOperation(node.data.dbOperation || 'select');
      setConnectionString(node.data.connectionString || '');
      setSql(node.data.sql || '');
      setLoopCondition(node.data.loopCondition || '');
      setSubFlowId(node.data.subFlowId || '');
      setValidationError(node.data.error || null);
    }
  }, [node]);

  // Detect used variables in the current configuration
  const usedVariables = useMemo(() => {
    const vars = new Set<string>();
    // Simple regex to find {varName} in text fields
    [label, description, loopCondition].forEach(text => {
      if (!text) return;
      const matches = text.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
      if (matches) {
        matches.forEach(m => vars.add(m.slice(1, -1)));
      }
    });
    
    // For code, simple check if var name exists as whole word
    if (node?.type === NodeType.CODE && code) {
      variables.forEach(v => {
        // Create regex to match variable name as whole word, avoiding partial matches
        const escapedName = v.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedName}\\b`);
        if (regex.test(code)) {
          vars.add(v.name);
        }
      });
      // Also check for {var} syntax in code comments or strings
      const matches = code.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
      if (matches) matches.forEach(m => vars.add(m.slice(1, -1)));
    }

    return Array.from(vars).map(vName => {
      const v = variables.find(existing => existing.name === vName);
      return {
        name: vName,
        isDefined: !!v,
        value: v?.value ?? 'N/A',
        type: v?.type ?? 'unknown'
      };
    });
  }, [label, description, code, loopCondition, node?.type, variables]);

  // Validation logic for decision and loop expressions
  const validateExpression = (text: string) => {
    if (!text) return null;
    
    const varMatches = [...text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)];
    if (varMatches.length < 1) return null;

    // Check for mix of String and Number in comparison
    if (text.match(/>|<|>=|<=|-|\*|\//)) {
       for (const m of varMatches) {
          const vName = m[1];
          const v = variables.find(v => v.name === vName);
          if (v && v.type === 'string') {
             // Basic heuristic: check if it looks like a cast is present
             const isCast = new RegExp(`(int|double|float|Convert\\.\\w+|Parse)\\s*\\(\\s*\\{${vName}\\}\\s*\\)`).test(text);
             if (!isCast) {
               return `类型警告: 变量 '${vName}' 是字符串，但进行了数值运算。请使用 int({${vName}}) 或 Convert.ToInt32({${vName}}) 进行转换。`;
             }
          }
       }
    }
    
    // Check equality for mixed types
    if (text.match(/==|!=/) && varMatches.length >= 2) {
       // Rough check: look at first two vars
       const v1 = variables.find(v => v.name === varMatches[0][1]);
       const v2 = variables.find(v => v.name === varMatches[1][1]);
       if (v1 && v2 && v1.type !== v2.type) {
           return `类型警告: 正在比较不同类型的变量 (${v1.type} vs ${v2.type})。请确保类型一致。`;
       }
    }

    return null;
  };

  useEffect(() => {
    if (node?.type === NodeType.DECISION) {
        setValidationError(validateExpression(description));
    } else if (node?.type === NodeType.LOOP) {
        setValidationError(validateExpression(loopCondition));
    } else {
        setValidationError(null);
    }
  }, [description, loopCondition, node?.type, variables]);

  if (!node) return null;

  const handleSave = () => {
    onChange(node.id, {
      label,
      description,
      code,
      duration,
      url,
      method,
      headers,
      httpBody,
      dbOperation,
      connectionString,
      sql,
      loopCondition,
      subFlowId,
      error: validationError || undefined
    });
    onClose();
  };

  const getTypeLabel = (type?: string) => {
    return t(`node.${type}`) || type;
  };

  return (
    <>
      <DraggablePanel
        title={`${t('config.title')}: ${label || 'Node'}`}
        icon={Settings2}
        initialPosition={initialPosition || { x: window.innerWidth - 350, y: 100 }}
        initialSize={{ width: 400, height: 600 }}
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
                {t('config.label')} <span className="text-red-500">*</span>
              </label>
              <VariableInput
                 value={label}
                 onChange={setLabel}
                 variables={variables}
                 structs={structs}
                 placeholder="Node Name..."
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all"
              />
            </div>

            {/* Validation Error Banner */}
            {validationError && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-2 text-xs text-amber-700 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        <div className="font-bold">配置检查</div>
                        {validationError}
                    </div>
                </div>
            )}

            {/* SubFlow Config */}
            {node.type === NodeType.SUB_FLOW && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {t('config.subflow.select')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={subFlowId}
                    onChange={(e) => setSubFlowId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white appearance-none"
                  >
                    <option value="">-- Select Flow --</option>
                    {(Object.values(flows) as FlowData[]).filter(f => f.id !== 'current-active-if-needed').map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
                <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                  <Workflow className="w-3 h-3" />
                  Calls another flow within this project.
                </div>
              </div>
            )}

            {/* HTTP Request Config */}
            {node.type === NodeType.HTTP && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Method</label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">URL <span className="text-red-500">*</span></label>
                    <VariableInput
                      value={url}
                      onChange={setUrl}
                      variables={variables}
                      structs={structs}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Headers (JSON)</label>
                  <VariableInput
                    isTextArea
                    value={headers}
                    onChange={setHeaders}
                    variables={variables}
                    structs={structs}
                    placeholder='{"Content-Type": "application/json"}'
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono h-20 resize-none"
                  />
                </div>
                {method !== 'GET' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Body</label>
                    <VariableInput
                      isTextArea
                      value={httpBody}
                      onChange={setHttpBody}
                      variables={variables}
                      structs={structs}
                      placeholder="Request body..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono h-24 resize-none"
                    />
                  </div>
                )}
              </>
            )}

            {/* Database Config */}
            {node.type === NodeType.DB && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Operation</label>
                  <select
                    value={dbOperation}
                    onChange={(e) => setDbOperation(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                  >
                    <option value="select">Select</option>
                    <option value="insert">Insert</option>
                    <option value="update">Update</option>
                    <option value="delete">Delete</option>
                    <option value="execute">Execute</option>
                    <option value="connect">Connect</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Connection String</label>
                  <VariableInput
                    value={connectionString}
                    onChange={setConnectionString}
                    variables={variables}
                    structs={structs}
                    placeholder="Connection String..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                  />
                </div>
                {dbOperation !== 'connect' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">SQL <span className="text-red-500">*</span></label>
                    <CodeEditor value={sql} onChange={setSql} variables={variables} structs={structs} className="h-[150px]" />
                  </div>
                )}
              </>
            )}

            {/* Loop Config */}
            {node.type === NodeType.LOOP && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Condition <span className="text-red-500">*</span></label>
                <VariableInput
                  value={loopCondition}
                  onChange={setLoopCondition}
                  variables={variables}
                  structs={structs}
                  placeholder="e.g. {i} < 10"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                />
              </div>
            )}

            {/* C# Code Editor */}
            {node.type === NodeType.CODE && (
              <div>
                 <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      C# Code <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowFullscreenEditor(true)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Fullscreen"
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
                              {CODE_TEMPLATES.map((tpl, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setCode(prev => prev ? `${prev}\n\n${tpl.value}` : tpl.value);
                                    setShowTemplates(false);
                                  }}
                                  className="text-left px-3 py-2 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0 group"
                                >
                                  <div className="text-xs font-medium text-slate-700 group-hover:text-indigo-700">{tpl.label}</div>
                                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{tpl.description}</div>
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
                   structs={structs}
                   className="h-[200px]"
                 />
                 <p className="text-[10px] text-slate-400 mt-1">
                   输入 <code>{`{`}</code> 触发变量联想。支持基础语法高亮和括号检查。
                 </p>
              </div>
            )}

            {/* Delay Config */}
            {node.type === NodeType.DELAY && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">延时时长 (毫秒)</label>
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
                    structs={structs}
                    placeholder={node.type === NodeType.AI_TASK ? "描述AI需要做什么..." : node.type === NodeType.DECISION ? "例如: {count} > 5" : "描述此步骤的功能..."}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm min-h-[100px] resize-none transition-all"
                 />
                 {node.type === NodeType.DECISION && (
                   <p className="text-[10px] text-slate-400 mt-1">支持变量比较，如 <code>{`{variable} > 10`}</code>。请注意类型一致性。</p>
                 )}
              </div>
            )}

            {/* Variable Usage Indicator */}
            {usedVariables.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>引用的变量 ({usedVariables.length})</span>
                  <span className="text-[10px] font-normal normal-case text-slate-400">自动检测</span>
                </label>
                <div className="space-y-2">
                  {usedVariables.map(v => (
                    <div key={v.name} className={`flex items-center justify-between text-xs p-2 rounded border ${v.isDefined ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-center gap-2">
                        {v.isDefined ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                        <span className={`font-mono font-medium ${v.isDefined ? 'text-slate-700' : 'text-amber-700'}`}>{v.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {v.isDefined && <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 rounded text-slate-500">{v.type}</span>}
                        <span className="text-slate-400 max-w-[80px] truncate" title={String(v.value)}>
                          {v.isDefined ? (v.value === '' ? '(空)' : String(v.value)) : '未定义'}
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
              {t('config.apply')}
            </button>
          </div>
        </div>
      </DraggablePanel>

      {/* Fullscreen Code Editor Modal */}
      {showFullscreenEditor && node.type === NodeType.CODE && (
        <DraggablePanel
          title={`Edit Code: ${label}`}
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
                structs={structs}
                className="absolute inset-0 h-full w-full border-0 rounded-none"
                isFullscreen={true}
              />
            </div>
            <div className="p-3 bg-slate-800 border-t border-slate-700 flex justify-end gap-2 shrink-0 z-10 relative">
               <button 
                 onClick={() => setShowFullscreenEditor(false)}
                 className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors text-sm"
               >
                 Close
               </button>
               <button 
                 onClick={() => { handleSave(); setShowFullscreenEditor(false); }}
                 className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition-colors text-sm shadow-md"
               >
                 Save & Close
               </button>
            </div>
          </div>
        </DraggablePanel>
      )}
    </>
  );
};
