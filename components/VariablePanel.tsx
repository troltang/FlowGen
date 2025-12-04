
import React, { useState, useMemo } from 'react';
import { Variable, AppNode, NodeType, StructDefinition, StructField } from '../types';
import { Plus, Trash2, Database, AlertCircle, Check, Search, MapPin, CornerDownRight, Box, Globe, Table, ChevronRight, ChevronDown, X } from 'lucide-react';
import { DraggablePanel } from './DraggablePanel';
import { useTranslation } from '../utils/i18n';

interface VariablePanelProps {
  variables: Variable[]; // Current flow variables (local)
  globalVariables: Variable[]; // Project variables (global)
  structs: StructDefinition[];
  setVariables: (vars: Variable[]) => void;
  setGlobalVariables: (vars: Variable[]) => void;
  setStructs: (structs: StructDefinition[]) => void;
  isOpen: boolean;
  onClose: () => void;
  nodes: AppNode[]; // Current flow nodes for referencing
  zIndex?: number;
  onInteract?: () => void;
  initialPosition?: { x: number; y: number };
  onFocusNode?: (nodeId: string) => void;
}

type Tab = 'local' | 'global' | 'struct';

export const VariablePanel: React.FC<VariablePanelProps> = ({ 
  variables, 
  globalVariables,
  structs,
  setVariables, 
  setGlobalVariables,
  setStructs,
  isOpen, 
  onClose, 
  nodes,
  zIndex,
  onInteract,
  initialPosition,
  onFocusNode
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('local');
  
  // New Variable State
  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState<string>('string');
  const [newVarIsArray, setNewVarIsArray] = useState(false);
  const [newVarValue, setNewVarValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // New Struct State
  const [newStructName, setNewStructName] = useState('');
  
  // Reference State
  const [expandedVarIds, setExpandedVarIds] = useState<Set<string>>(new Set());

  const isValidName = (name: string) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);

  // Available types including primitives and defined structs
  const availableTypes = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'integer', label: 'Integer' },
    { value: 'float', label: 'Float' },
    { value: 'datetime', label: 'DateTime' },
    { value: 'object', label: 'JSON Object' },
    ...structs.map(s => ({ value: s.name, label: `Struct: ${s.name}` }))
  ];

  if (!isOpen) return null;

  // -- Handlers --

  const handleAddVariable = (isGlobal: boolean) => {
    const targetList = isGlobal ? globalVariables : variables;
    const setter = isGlobal ? setGlobalVariables : setVariables;
    const trimmedName = newVarName.trim();

    if (!trimmedName) return setError(t('var.desc'));
    if (!isValidName(trimmedName)) return setError(t('var.desc'));
    if (targetList.some(v => v.name === trimmedName)) return setError('Name exists');

    const newVar: Variable = {
      id: `${isGlobal ? 'g' : 'v'}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: trimmedName,
      type: newVarType,
      value: newVarValue,
      isArray: newVarIsArray,
      isGlobal
    };
    
    // Automatically expand new structs to encourage field editing
    if (structs.some(s => s.name === newVarType)) {
        setExpandedVarIds(prev => new Set(prev).add(newVar.id));
    }

    setter([...targetList, newVar]);
    setNewVarName('');
    setNewVarValue('');
    setError(null);
  };

  const handleDeleteVariable = (id: string, isGlobal: boolean) => {
    if (isGlobal) {
      setGlobalVariables(globalVariables.filter(v => v.id !== id));
    } else {
      setVariables(variables.filter(v => v.id !== id));
    }
  };

  const toggleExpandVar = (id: string) => {
    const newSet = new Set(expandedVarIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedVarIds(newSet);
  };

  const updateStructValue = (
    varId: string, 
    field: string, 
    value: string, 
    isGlobal: boolean, 
    currentJsonString: string
  ) => {
    let obj: any = {};
    try {
      obj = JSON.parse(currentJsonString || '{}');
    } catch {
      obj = {};
    }
    
    // For nested fields or simple fields, update the object
    obj[field] = value;
    
    const newValueString = JSON.stringify(obj);
    const setter = isGlobal ? setGlobalVariables : setVariables;
    const list = isGlobal ? globalVariables : variables;
    
    setter(list.map(v => v.id === varId ? { ...v, value: newValueString } : v));
  };

  const handleAddStruct = () => {
    const name = newStructName.trim();
    if (!name || !isValidName(name)) return;
    if (structs.some(s => s.name === name)) return;

    const newStruct: StructDefinition = {
      id: `struct-${Date.now()}`,
      name,
      fields: []
    };
    setStructs([...structs, newStruct]);
    setNewStructName('');
  };

  const handleAddField = (structId: string) => {
    setStructs(structs.map(s => {
      if (s.id === structId) {
        // Ensure unique name
        let fieldName = 'newField';
        let counter = 1;
        while(s.fields.some(f => f.name === fieldName)) {
            fieldName = `newField${counter++}`;
        }

        return {
          ...s,
          fields: [...s.fields, { name: fieldName, type: 'string', isArray: false }]
        };
      }
      return s;
    }));
  };

  const updateStructField = (structId: string, fieldIndex: number, updates: Partial<StructField>) => {
    setStructs(structs.map(s => {
      if (s.id === structId) {
        const newFields = [...s.fields];
        // Check duplicate name if renaming
        if (updates.name && newFields.some((f, idx) => idx !== fieldIndex && f.name === updates.name)) {
            // If duplicate, ignore the name update but allow other updates (like type)
            const { name, ...otherUpdates } = updates;
            if (Object.keys(otherUpdates).length === 0) return s; 
            newFields[fieldIndex] = { ...newFields[fieldIndex], ...otherUpdates };
        } else {
            newFields[fieldIndex] = { ...newFields[fieldIndex], ...updates };
        }
        return { ...s, fields: newFields };
      }
      return s;
    }));
  };

  const deleteStructField = (structId: string, fieldIndex: number) => {
    setStructs(structs.map(s => {
      if (s.id === structId) {
        const newFields = [...s.fields];
        newFields.splice(fieldIndex, 1);
        return { ...s, fields: newFields };
      }
      return s;
    }));
  };

  // -- Renderers --

  const renderVariableList = (vars: Variable[], isGlobal: boolean) => (
    <table className="w-full text-sm text-left">
      <thead className="text-xs text-slate-500 uppercase bg-white sticky top-0 z-10 shadow-sm">
        <tr>
          <th className="px-3 py-2">{t('var.name')}</th>
          <th className="px-3 py-2">{t('var.type')}</th>
          <th className="px-3 py-2 text-center">Array</th>
          <th className="px-3 py-2">{t('var.value')}</th>
          <th className="px-2 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {vars.map(v => {
          const structDef = structs.find(s => s.name === v.type);
          const isStruct = !!structDef;
          const isExpanded = expandedVarIds.has(v.id);

          return (
            <React.Fragment key={v.id}>
              <tr className="border-b border-slate-50 hover:bg-slate-50/50 group">
                <td className="px-3 py-2 font-medium font-mono text-xs flex items-center gap-1">
                  {isStruct && (
                    <button onClick={() => toggleExpandVar(v.id)} className="text-slate-400 hover:text-indigo-600">
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  )}
                  {!isStruct && <span className="w-3 h-3 block" />} {/* Spacer */}
                  {v.name}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{v.type}</td>
                <td className="px-3 py-2 text-center text-xs">{v.isArray ? '✅' : ''}</td>
                <td className="px-3 py-2">
                  {!isStruct ? (
                    <input 
                      value={v.value} 
                      onChange={(e) => {
                        const setter = isGlobal ? setGlobalVariables : setVariables;
                        const list = isGlobal ? globalVariables : variables;
                        setter(list.map(item => item.id === v.id ? { ...item, value: e.target.value } : item));
                      }}
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none text-xs truncate"
                    />
                  ) : (
                    <button 
                        onClick={() => toggleExpandVar(v.id)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                    >
                        {isExpanded ? '(收起成员)' : '(展开配置成员)'}
                    </button>
                  )}
                </td>
                <td className="px-2 py-2 text-right">
                  <button 
                    onClick={() => handleDeleteVariable(v.id, isGlobal)} 
                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
              {isStruct && isExpanded && structDef && (
                <tr className="bg-slate-50/50">
                  <td colSpan={5} className="px-4 py-2 border-b border-slate-100">
                    <div className="pl-6 border-l-2 border-indigo-200 space-y-1 py-1">
                      <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between">
                         <span>结构体成员 ({structDef.name})</span>
                         <span className="text-slate-300 italic">自动同步 JSON</span>
                      </div>
                      {structDef.fields.map(field => {
                        let parsedValue = {};
                        try { parsedValue = JSON.parse(v.value || '{}'); } catch {}
                        const fieldValue = (parsedValue as any)[field.name] || '';

                        return (
                          <div key={field.name} className="flex items-center gap-2 text-xs">
                            <span className="w-20 font-mono text-slate-600 text-right truncate" title={field.name}>{field.name}:</span>
                            <input 
                              value={fieldValue}
                              onChange={(e) => updateStructValue(v.id, field.name, e.target.value, isGlobal, v.value)}
                              className="flex-1 bg-white border border-slate-200 rounded-sm px-2 py-1 focus:border-indigo-500 outline-none"
                              placeholder={`Enter ${field.type}...`}
                            />
                            <span className="text-[10px] text-slate-400 w-12 truncate text-right">{field.type}</span>
                          </div>
                        );
                      })}
                      {structDef.fields.length === 0 && (
                          <div className="text-xs text-slate-400 italic pl-2">无成员定义，请在“结构体定义”页签添加。</div>
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
  );

  return (
    <DraggablePanel
      title={t('var.title')}
      icon={Database}
      initialPosition={initialPosition || { x: window.innerWidth - 450, y: 100 }}
      initialSize={{ width: 500, height: 650 }}
      onClose={onClose}
      zIndex={zIndex}
      onInteract={onInteract}
    >
      <div className="flex flex-col h-full bg-white">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button 
            onClick={() => setActiveTab('local')}
            className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'local' ? 'bg-white text-indigo-600 border-t-2 border-t-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Box className="w-3 h-3" /> {t('var.tab.local')}
          </button>
          <button 
            onClick={() => setActiveTab('global')}
            className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'global' ? 'bg-white text-purple-600 border-t-2 border-t-purple-600' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Globe className="w-3 h-3" /> {t('var.tab.global')}
          </button>
          <button 
            onClick={() => setActiveTab('struct')}
            className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'struct' ? 'bg-white text-amber-600 border-t-2 border-t-amber-600' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Table className="w-3 h-3" /> {t('var.tab.struct')}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab !== 'struct' ? (
            <>
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
                <div className="grid grid-cols-12 gap-2">
                  <input
                    placeholder={t('var.name')}
                    className="col-span-4 px-2 py-1.5 text-sm border rounded outline-none"
                    value={newVarName}
                    onChange={e => setNewVarName(e.target.value)}
                  />
                  <select
                    className="col-span-3 px-2 py-1.5 text-sm border rounded outline-none bg-white"
                    value={newVarType}
                    onChange={e => setNewVarType(e.target.value)}
                  >
                    {availableTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  <label className="col-span-2 flex items-center gap-1 text-xs text-slate-600 cursor-pointer select-none">
                    <input type="checkbox" checked={newVarIsArray} onChange={e => setNewVarIsArray(e.target.checked)} />
                    Array
                  </label>
                  <button 
                    onClick={() => handleAddVariable(activeTab === 'global')}
                    className="col-span-3 flex items-center justify-center bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700"
                  >
                    <Plus className="w-3 h-3 mr-1" /> {t('var.add')}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderVariableList(activeTab === 'global' ? globalVariables : variables, activeTab === 'global')}
              </div>
            </>
          ) : (
            // Struct Tab
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex gap-2">
                <input 
                  placeholder="Struct Name (e.g. User)" 
                  className="flex-1 px-2 py-1.5 text-sm border rounded outline-none"
                  value={newStructName}
                  onChange={e => setNewStructName(e.target.value)}
                />
                <button 
                  onClick={handleAddStruct}
                  className="px-4 py-1.5 bg-amber-600 text-white rounded text-xs hover:bg-amber-700"
                >
                  {t('struct.add')}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {structs.map(struct => (
                  <div key={struct.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <div className="bg-slate-100 px-3 py-2 flex justify-between items-center border-b border-slate-200">
                      <span className="font-bold text-slate-700 text-sm">{struct.name}</span>
                      <button onClick={() => setStructs(structs.filter(s => s.id !== struct.id))} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-2 space-y-2">
                      {struct.fields.map((field, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input 
                            value={field.name}
                            onChange={(e) => updateStructField(struct.id, idx, { name: e.target.value })}
                            className="flex-1 px-2 py-1 text-xs border rounded"
                            placeholder="Field Name"
                          />
                          <select
                            value={field.type}
                            onChange={(e) => updateStructField(struct.id, idx, { type: e.target.value })}
                            className="w-24 px-2 py-1 text-xs border rounded bg-white"
                          >
                            {availableTypes.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1 text-[10px] text-slate-500">
                            <input 
                              type="checkbox" 
                              checked={!!field.isArray}
                              onChange={(e) => updateStructField(struct.id, idx, { isArray: e.target.checked })}
                            /> Array
                          </label>
                          <button onClick={() => deleteStructField(struct.id, idx)} className="text-slate-300 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => handleAddField(struct.id)}
                        className="w-full py-1 text-xs text-slate-400 hover:text-indigo-600 border border-dashed border-slate-300 rounded hover:border-indigo-300 transition-colors"
                      >
                        + {t('struct.field.add')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DraggablePanel>
  );
};
