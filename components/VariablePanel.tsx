
import React, { useState, useMemo } from 'react';
import { Variable, AppNode, NodeType } from '../types';
import { Plus, Trash2, Database, AlertCircle, Check, Search, MapPin, CornerDownRight } from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';

interface VariablePanelProps {
  variables: Variable[];
  setVariables: (vars: Variable[]) => void;
  isOpen: boolean;
  onClose: () => void;
  nodes: AppNode[];
  zIndex?: number;
  onInteract?: () => void;
  initialPosition?: { x: number; y: number };
  onFocusNode?: (nodeId: string) => void;
}

const CSHARP_KEYWORDS = new Set([
  'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked',
  'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else',
  'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for',
  'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock',
  'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override', 'params',
  'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short',
  'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true',
  'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual',
  'void', 'volatile', 'while', 'var', 'dynamic', 'async', 'await'
]);

export const VariablePanel: React.FC<VariablePanelProps> = ({ 
  variables, 
  setVariables, 
  isOpen, 
  onClose, 
  nodes,
  zIndex,
  onInteract,
  initialPosition,
  onFocusNode
}) => {
  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState<Variable['type']>('string');
  const [newVarValue, setNewVarValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // State for reference searching
  const [expandedVarId, setExpandedVarId] = useState<string | null>(null);

  const isValidName = (name: string) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);

  // Find references for defined variables
  const getReferences = (varName: string) => {
    return nodes.filter(node => {
      const data = node.data;
      const textContent = (data.label || '') + (data.description || '');
      const codeContent = data.code || '';
      
      // Check text fields for {varName}
      if (textContent.includes(`{${varName}}`)) return true;
      
      // Check code for whole word match to avoid partial matches (e.g. 'count' inside 'counter')
      if (node.type === NodeType.CODE && new RegExp(`\\b${varName}\\b`).test(codeContent)) return true;
      
      return false;
    });
  };

  const detectedVariables = useMemo(() => {
    const found = new Set<string>();
    
    nodes.forEach(node => {
      const textFields = [node.data.label, node.data.description];
      textFields.forEach(text => {
        if (!text) return;
        const matches = text.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
        if (matches) {
          matches.forEach(m => found.add(m.slice(1, -1)));
        }
      });

      if (node.type === NodeType.CODE && node.data.code) {
        const codeMatches = node.data.code.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g);
        if (codeMatches) {
          codeMatches.forEach(word => {
            if (!CSHARP_KEYWORDS.has(word) && isNaN(Number(word))) {
              found.add(word);
            }
          });
        }
      }
    });

    return Array.from(found).map(name => ({
      name,
      isDefined: variables.some(v => v.name === name)
    }));
  }, [nodes, variables]);

  if (!isOpen) return null;

  const handleAdd = (nameOverride?: string) => {
    const nameToUse = nameOverride || newVarName;
    const trimmedName = nameToUse.trim();

    if (!trimmedName) {
      setError('变量名不能为空');
      return;
    }
    if (!isValidName(trimmedName)) {
      setError('变量名只能包含字母、数字和下划线，且不能以数字开头');
      return;
    }
    if (variables.some(v => v.name === trimmedName)) {
      setError('变量名已存在');
      return;
    }

    const newVar: Variable = {
      id: `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: trimmedName,
      type: nameOverride ? 'string' : newVarType,
      value: nameOverride ? '' : newVarValue
    };
    
    setVariables([...variables, newVar]);
    
    if (!nameOverride) {
      setNewVarName('');
      setNewVarValue('');
    }
    setError(null);
  };

  const handleDelete = (id: string) => {
    setVariables(variables.filter(v => v.id !== id));
    if (expandedVarId === id) setExpandedVarId(null);
  };

  const handleUpdate = (id: string, field: keyof Variable, value: string) => {
    setVariables(variables.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const toggleReferences = (id: string) => {
    setExpandedVarId(expandedVarId === id ? null : id);
  };

  return (
    <DraggablePanel
      title="全局变量管理"
      icon={Database}
      initialPosition={initialPosition || { x: window.innerWidth - 450, y: 100 }}
      initialSize={{ width: 420, height: 600 }}
      onClose={onClose}
      zIndex={zIndex}
      onInteract={onInteract}
    >
      <div className="flex flex-col h-full bg-white">
        {/* Add New Variable Section */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="text-xs font-semibold text-slate-500 mb-2">添加新变量</div>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12">
               {error && (
                <div className="flex items-center gap-1 text-xs text-red-500 mb-2 bg-red-50 p-1.5 rounded">
                  <AlertCircle className="w-3 h-3" />
                  {error}
                </div>
              )}
            </div>
            <input
              placeholder="变量名 (e.g. userCount)"
              className={`col-span-5 px-2 py-1.5 text-sm border rounded outline-none transition-all ${error ? 'border-red-300 ring-1 ring-red-100' : 'focus:ring-1 focus:ring-indigo-500 border-slate-300'}`}
              value={newVarName}
              onChange={e => {
                setNewVarName(e.target.value);
                if (error) setError(null);
              }}
            />
            <select
              className="col-span-3 px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-indigo-500 outline-none bg-white border-slate-300"
              value={newVarType}
              onChange={e => setNewVarType(e.target.value as any)}
            >
              <option value="string">文本</option>
              <option value="number">数字</option>
              <option value="boolean">布尔</option>
            </select>
            <input
              placeholder="初始值"
              className="col-span-3 px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-indigo-500 outline-none border-slate-300"
              value={newVarValue}
              onChange={e => setNewVarValue(e.target.value)}
            />
            <button 
              onClick={() => handleAdd()}
              className="col-span-1 flex items-center justify-center bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              title="添加变量"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            变量名仅支持字母、数字、下划线，且必须以字母或下划线开头。
          </p>
        </div>
        
        {/* Defined Variables List */}
        <div className="flex-1 overflow-y-auto p-0">
          {variables.length === 0 ? (
             <div className="text-center text-slate-400 text-sm py-8 flex flex-col items-center">
               <Database className="w-8 h-8 text-slate-200 mb-2" />
               暂无已定义变量
             </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-white sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-2 bg-slate-50/80 backdrop-blur w-1/4">名称</th>
                  <th className="px-3 py-2 bg-slate-50/80 backdrop-blur w-1/6">类型</th>
                  <th className="px-3 py-2 bg-slate-50/80 backdrop-blur w-1/3">当前值</th>
                  <th className="px-2 py-2 bg-slate-50/80 backdrop-blur w-1/4 text-right pr-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {variables.map(v => {
                  const isExpanded = expandedVarId === v.id;
                  const references = isExpanded ? getReferences(v.name) : [];
                  
                  return (
                    <React.Fragment key={v.id}>
                      <tr className={`border-b border-slate-50 hover:bg-slate-50/50 group ${isExpanded ? 'bg-slate-50' : ''}`}>
                        <td className="px-3 py-2 font-medium text-slate-700 font-mono text-xs">{v.name}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">
                          <span className={`px-1.5 py-0.5 rounded ${v.type === 'number' ? 'bg-blue-50 text-blue-600' : v.type === 'boolean' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>
                            {v.type === 'string' ? 'Str' : v.type === 'number' ? 'Num' : 'Bool'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <input 
                            value={v.value} 
                            onChange={(e) => handleUpdate(v.id, 'value', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none transition-colors text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => toggleReferences(v.id)}
                              className={`p-1.5 rounded transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                              title="查找引用"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(v.id)} 
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="删除变量"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded References View */}
                      {isExpanded && (
                        <tr className="bg-indigo-50/30 animate-in fade-in slide-in-from-top-1 duration-200">
                          <td colSpan={4} className="p-0">
                            <div className="px-4 py-2 border-b border-indigo-100">
                              <div className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <CornerDownRight className="w-3 h-3" />
                                变量引用 ({references.length})
                              </div>
                              {references.length === 0 ? (
                                <div className="text-xs text-slate-400 italic pl-4 py-1">
                                  未找到引用该变量的节点。
                                </div>
                              ) : (
                                <div className="space-y-1 pl-2">
                                  {references.map(refNode => (
                                    <button
                                      key={refNode.id}
                                      onClick={() => onFocusNode?.(refNode.id)}
                                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 hover:bg-white rounded border border-transparent hover:border-indigo-100 hover:shadow-sm transition-all group/item"
                                    >
                                      <div className={`w-1.5 h-1.5 rounded-full ${refNode.type === NodeType.DECISION ? 'bg-amber-400' : refNode.type === NodeType.CODE ? 'bg-slate-600' : 'bg-blue-400'}`} />
                                      <span className="text-xs text-slate-700 font-medium group-hover/item:text-indigo-700 truncate flex-1">
                                        {refNode.data.label}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1 rounded">
                                        {refNode.id}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detected Variables Section */}
        {detectedVariables.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50/80 backdrop-blur p-3 shrink-0 max-h-40 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-3 h-3 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                检测到的引用 ({detectedVariables.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {detectedVariables.map((dv) => (
                <div 
                  key={dv.name} 
                  className={`
                    flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border
                    ${dv.isDefined 
                      ? 'bg-white border-green-200 text-green-700' 
                      : 'bg-white border-amber-200 text-amber-700 shadow-sm'}
                  `}
                >
                  <span className="font-mono">{dv.name}</span>
                  {dv.isDefined ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <button 
                      onClick={() => handleAdd(dv.name)}
                      className="hover:bg-amber-100 rounded-full p-0.5 transition-colors"
                      title="添加此变量"
                    >
                      <Plus className="w-3 h-3 text-amber-600" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DraggablePanel>
  );
};
