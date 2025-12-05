
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppNode, NodeType, Variable, Library, FlowData, StructDefinition, CodeFile, FunctionDefinition } from '../types';
import { Copy, Settings2, CheckCircle2, AlertCircle, FileCode, ChevronDown, Maximize2, Minimize2, Workflow, ArrowRightLeft, Wrench, FileJson, Search, BookOpen } from 'lucide-react';
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
  codeFiles?: CodeFile[];
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

// Helper to map C# types to Flow types
const mapCSharpTypeToFlowType = (csType: string): string => {
    switch (csType) {
        case 'int':
        case 'float':
        case 'double':
        case 'decimal':
        case 'long':
        case 'short':
        case 'byte':
            return 'number';
        case 'string':
            return 'string';
        case 'bool':
            return 'boolean';
        case 'DateTime':
            return 'datetime';
        case 'object':
        case 'dynamic':
            return 'object';
        default:
            return 'object'; // Fallback
    }
};

const checkTypeCompatibility = (varType: string, expectedType: string): boolean => {
    if (varType === expectedType) return true;
    const numberTypes = ['number', 'integer', 'float'];
    // Allow any number type to match 'number'
    if (expectedType === 'number' && numberTypes.includes(varType)) return true;
    if (numberTypes.includes(expectedType) && varType === 'number') return true;
    
    // Object/Any compatibility
    if (expectedType === 'object' || varType === 'object') return true; 
    
    return false;
};

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ 
  node, 
  onClose, 
  onChange, 
  variables,
  libraries = [],
  structs = [],
  codeFiles = [],
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
  const [validationResult, setValidationResult] = useState<{ isValid: boolean, message?: string, suggestion?: string, targetVar?: string } | null>(null);

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
  
  // Function Call States
  const [selectedCodeFileId, setSelectedCodeFileId] = useState('');
  const [selectedFunctionName, setSelectedFunctionName] = useState('');
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [variableName, setVariableName] = useState(''); // Store return value here
  const [showFunctionSelector, setShowFunctionSelector] = useState(false);

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
      
      // Function Call
      setSelectedCodeFileId(node.data.codeFileId || '');
      setSelectedFunctionName(node.data.functionName || '');
      setParameterValues(node.data.parameterValues || {});
      setVariableName(node.data.variableName || '');

      setValidationResult(node.data.error ? { isValid: false, message: node.data.error } : null);
    }
  }, [node]);

  // Handle Function Call logic
  const selectedCodeFile = codeFiles.find(f => f.id === selectedCodeFileId);
  const selectedFunction = selectedCodeFile?.functions.find(f => f.name === selectedFunctionName);

  // Function Selector logic
  const functionSelectorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (functionSelectorRef.current && !functionSelectorRef.current.contains(event.target as Node)) {
              setShowFunctionSelector(false);
          }
      };
      if (showFunctionSelector) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFunctionSelector]);

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
    
    // For function parameters
    if (node?.type === NodeType.FUNCTION_CALL && parameterValues) {
        Object.values(parameterValues).forEach(val => {
            const matches = val.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
            if (matches) matches.forEach(m => vars.add(m.slice(1, -1)));
        });
    }
    
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
  }, [label, description, code, loopCondition, node?.type, variables, parameterValues]);

  const validateExpression = (text: string): { isValid: boolean, message?: string, suggestion?: string, targetVar?: string } | null => {
    if (!text) return null;
    
    // 0. Assignment check (Did user type = instead of == ?)
    // Match {var} = {var} or {var} = "val" but NOT ==, !=, >=, <=
    const assignmentRegex = /\{([a-zA-Z0-9_]+)\}\s*=(?!=)\s*(?:\{([a-zA-Z0-9_]+)\}|[^=])/;
    if (assignmentRegex.test(text)) {
        return {
            isValid: false,
            message: "检测到赋值操作 '='。在判断条件中请使用 '==' 进行比较。",
            suggestion: text.replace(/([^=])=([^=])/g, '$1==$2')
        };
    }

    // 1. Binary Type Mismatch Check (Loop through all comparisons)
    // Regex for {var} op {var}
    const binaryRegex = /\{([a-zA-Z0-9_]+)\}\s*(==|!=|===|!==|>|<|>=|<=)\s*\{([a-zA-Z0-9_]+)\}/g;
    let match;
    while ((match = binaryRegex.exec(text)) !== null) {
      const v1Name = match[1];
      const operator = match[2];
      const v2Name = match[3];
      const v1 = variables.find(v => v.name === v1Name);
      const v2 = variables.find(v => v.name === v2Name);
      
      if (v1 && v2 && !checkTypeCompatibility(v1.type, v2.type)) {
         return {
             isValid: false,
             message: `类型不匹配: 无法比较 ${v1.type} '{${v1Name}}' 和 ${v2.type} '{${v2Name}}'。`,
             suggestion: undefined,
             targetVar: undefined
         };
      }
    }

    // 2. Single boolean check
    const singleVarRegex = /^\s*\{([a-zA-Z0-9_]+)\}\s*$/;
    const singleMatch = text.match(singleVarRegex);
    if (singleMatch) {
        const vName = singleMatch[1];
        const v = variables.find(va => va.name === vName);
        if (v && v.type !== 'boolean') {
             let suggestion = '';
             if (v.type === 'string') suggestion = `!string.IsNullOrEmpty({${vName}})`;
             else if (v.type === 'number' || v.type === 'integer' || v.type === 'float') suggestion = `{${vName}} != 0`;
             else suggestion = `{${vName}} != null`;

             return {
                 isValid: false,
                 message: `类型错误: 条件必须是布尔值。变量 '{${vName}}' 是 ${v.type} 类型。`,
                 suggestion: suggestion,
                 targetVar: vName
             };
        }
    }
    return null;
  };

  // Function Parameter Validation
  const validateFunctionParams = (): string | null => {
      if (!selectedFunction) return null;
      for (const param of selectedFunction.parameters) {
          const val = parameterValues[param.name];
          if (!val) continue; // Allow empty? Or strict check for non-optional?
          
          const match = val.match(/^\{([a-zA-Z0-9_]+)\}$/);
          if (match) {
              const varName = match[1];
              const variable = variables.find(v => v.name === varName);
              if (variable) {
                  const expectedFlowType = mapCSharpTypeToFlowType(param.type);
                  if (!checkTypeCompatibility(variable.type, expectedFlowType)) {
                      return `参数 '${param.name}' 类型错误: 需要 ${expectedFlowType} (C# ${param.type}), 但变量 '{${variable.name}}' 是 ${variable.type}。`;
                  }
              }
          }
      }
      return null;
  };

  useEffect(() => {
    let result: { isValid: boolean, message?: string } | null = null;

    if (node?.type === NodeType.DECISION) {
        result = validateExpression(description);
    } else if (node?.type === NodeType.LOOP) {
        result = validateExpression(loopCondition);
    } else if (node?.type === NodeType.FUNCTION_CALL) {
        const paramError = validateFunctionParams();
        if (paramError) {
            result = { isValid: false, message: paramError };
        }
    }
    
    setValidationResult(result);
  }, [description, loopCondition, node?.type, variables, parameterValues, selectedFunction]);

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
      // Function Call
      codeFileId: selectedCodeFileId,
      functionName: selectedFunctionName,
      parameterValues: parameterValues,
      variableName: variableName,
      
      error: validationResult?.isValid === false ? validationResult.message : undefined
    });
    onClose();
  };

  const applyFix = () => {
      if (!validationResult || !validationResult.suggestion) return;
      const replacement = validationResult.suggestion;
      
      if (node.type === NodeType.DECISION) {
          setDescription(replacement);
      } else if (node.type === NodeType.LOOP) {
          setLoopCondition(replacement);
      }
  };

  const getTypeLabel = (type?: string) => {
    return t(`node.${type}`) || type;
  };

  const renderFunctionSelector = () => (
      <div className="relative">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              调用函数 <span className="text-red-500">*</span>
          </label>
          <button 
              onClick={() => setShowFunctionSelector(!showFunctionSelector)}
              className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 rounded-lg bg-white hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500 transition-all text-left"
          >
              <div className="flex flex-col overflow-hidden">
                  <span className={`text-sm font-medium truncate ${selectedFunction ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                      {selectedFunction ? selectedFunction.name : '选择目标函数...'}
                  </span>
                  {selectedCodeFile && (
                      <span className="text-[10px] text-slate-400 truncate">
                          {selectedCodeFile.name}
                      </span>
                  )}
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {showFunctionSelector && (
              <div ref={functionSelectorRef} className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                  {codeFiles.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 text-center italic">暂无可用代码文件</div>
                  ) : (
                      codeFiles.map(file => (
                          <div key={file.id} className="border-b border-slate-50 last:border-0">
                              <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 sticky top-0">
                                  <FileCode className="w-3 h-3" />
                                  {file.name}
                              </div>
                              {file.functions.length === 0 ? (
                                  <div className="px-3 py-2 text-xs text-slate-300 italic">无公共方法</div>
                              ) : (
                                  file.functions.map(func => (
                                      <button
                                          key={func.name}
                                          onClick={() => {
                                              setSelectedCodeFileId(file.id);
                                              setSelectedFunctionName(func.name);
                                              setParameterValues({});
                                              setShowFunctionSelector(false);
                                          }}
                                          className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 flex items-center justify-between group transition-colors ${selectedCodeFileId === file.id && selectedFunctionName === func.name ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                                      >
                                          <span className="font-mono">{func.name}</span>
                                          <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded group-hover:border-indigo-200">
                                              {func.returnType}
                                          </span>
                                      </button>
                                  ))
                              )}
                          </div>
                      ))
                  )}
              </div>
          )}
      </div>
  );

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
            {validationResult && validationResult.isValid === false && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 shadow-sm">
                    <div className="flex items-start gap-2 text-xs text-red-700">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="font-bold">校验错误</div>
                    </div>
                    <div className="text-xs text-red-600 pl-6 leading-relaxed">
                        {validationResult.message}
                    </div>
                    {validationResult.suggestion && (
                        <div className="pl-6 mt-1 flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">建议修改为:</span>
                            <code className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-red-100 font-mono text-red-600">{validationResult.suggestion}</code>
                            <button 
                                onClick={applyFix}
                                className="ml-auto flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-red-700 transition-colors shadow-sm active:scale-95"
                            >
                                <Wrench className="w-3 h-3" />
                                自动修复
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Function Call Config */}
            {node.type === NodeType.FUNCTION_CALL && (
              <div className="space-y-4">
                {/* Compact Function Selector */}
                {renderFunctionSelector()}

                {/* Function Documentation */}
                {selectedFunction && (
                    <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-slate-600">
                        <div className="flex items-center gap-1 font-bold text-blue-700 mb-1">
                            <BookOpen className="w-3 h-3" />
                            文档说明
                        </div>
                        <div className="italic">
                            {selectedFunction.description || "该函数暂无描述文档。"}
                        </div>
                        <div className="mt-2 pt-2 border-t border-blue-100 flex gap-4">
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase">Return</span>
                                <div className="font-mono text-blue-600">{selectedFunction.returnType}</div>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase">Params</span>
                                <div className="font-mono text-slate-700">{selectedFunction.parameters.length}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Parameters */}
                {selectedFunction && selectedFunction.parameters.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded border border-slate-200">
                    <label className="block text-xs font-bold text-slate-600 mb-2 border-b border-slate-200 pb-1">
                      {t('config.func.params')}
                    </label>
                    <div className="space-y-3">
                      {selectedFunction.parameters.map(param => {
                        // Check type compatibility inline for visual feedback
                        const currentVal = parameterValues[param.name] || '';
                        const varMatch = currentVal.match(/^\{([a-zA-Z0-9_]+)\}$/);
                        let typeError = null;
                        if (varMatch) {
                            const v = variables.find(va => va.name === varMatch[1]);
                            if (v) {
                                const expected = mapCSharpTypeToFlowType(param.type);
                                if (!checkTypeCompatibility(v.type, expected)) {
                                    typeError = `Type mismatch: ${v.type} ≠ ${expected} (${param.type})`;
                                }
                            }
                        }

                        return (
                        <div key={param.name}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-slate-700 font-mono">{param.name}</span>
                            <span className="text-[10px] text-slate-400 bg-white px-1 rounded border border-slate-200">{param.type}</span>
                          </div>
                          <VariableInput
                            value={currentVal}
                            onChange={(val) => setParameterValues(prev => ({ ...prev, [param.name]: val }))}
                            variables={variables}
                            structs={structs}
                            placeholder={`Value for ${param.name}`}
                            className={`w-full px-2 py-1.5 border rounded focus:ring-1 focus:ring-indigo-500 outline-none text-sm bg-white ${typeError ? 'border-red-300' : 'border-slate-300'}`}
                          />
                          {typeError && (
                              <div className="text-[10px] text-red-500 mt-0.5">{typeError}</div>
                          )}
                        </div>
                      )})}
                    </div>
                  </div>
                )}

                {/* Return Value Variable */}
                {selectedFunction && selectedFunction.returnType !== 'void' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      {t('config.func.return')}
                    </label>
                    <VariableInput
                      value={variableName}
                      onChange={setVariableName}
                      variables={variables}
                      structs={structs}
                      placeholder="e.g. resultVar"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono text-indigo-700"
                    />
                    <div className="mt-1 text-[10px] text-slate-400">
                      Result will be stored in this variable (Global or Local).
                    </div>
                  </div>
                )}
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
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono ${validationResult?.isValid === false ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'}`}
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
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-h-[100px] resize-none transition-all ${validationResult?.isValid === false ? 'border-red-300 focus:ring-red-200' : 'border-slate-300'}`}
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
