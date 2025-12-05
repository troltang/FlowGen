
import React, { useState, useRef, useEffect } from 'react';
import { Folder, FileText, Settings, ChevronRight, ChevronDown, Plus, Search, Command, Package, Upload, Workflow, Trash2, Edit2, MoreVertical, Crosshair, FileJson } from 'lucide-react';
import { ProjectFolder, Library, FlowData, CodeFile } from '../types';
import { useTranslation } from '../utils/i18n';

interface ProjectSidebarProps {
  onLoadProject: (id: string) => void;
  onLibraryUpload: (lib: Library) => void;
  libraries: Library[];
  flows: Record<string, FlowData>;
  codeFiles: CodeFile[];
  activeTabId: string | null;
  
  onAddFlow: () => void;
  onDeleteFlow: (id: string) => void;
  onRenameFlow: (id: string, newName: string) => void;
  onFindReferences?: (id: string) => void;
  
  onAddCodeFile: () => void;
  onDeleteCodeFile: (id: string) => void;
  onRenameCodeFile: (id: string, newName: string) => void;
  onFindCodeReferences: (id: string) => void;

  onOpenTab: (id: string, type: 'flow' | 'code', name: string) => void;
}

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({ 
  onLoadProject, 
  onLibraryUpload, 
  libraries,
  flows,
  codeFiles = [],
  activeTabId,
  onAddFlow,
  onDeleteFlow,
  onRenameFlow,
  onFindReferences,
  onAddCodeFile,
  onDeleteCodeFile,
  onRenameCodeFile,
  onFindCodeReferences,
  onOpenTab
}) => {
  const { t } = useTranslation();
  
  // Renaming State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<'flow' | 'code' | null>(null);
  const [editName, setEditName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string; type: 'flow' | 'code' } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
      // Also save rename on click outside if editing
      if (editingId && editInputRef.current && !editInputRef.current.contains(event.target as Node)) {
         submitRename();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu, editingId, editName]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleContextMenu = (e: React.MouseEvent, id: string, type: 'flow' | 'code') => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, id, type });
  };

  const startRename = (id: string, currentName: string, type: 'flow' | 'code') => {
    setEditingId(id);
    setEditType(type);
    setEditName(currentName);
    setContextMenu(null);
  };

  const validateName = (name: string, currentId: string): boolean => {
      const trimmedName = name.trim();
      if (!trimmedName) return false;
      
      // Check for duplicates in Flows
      const flowExists = Object.values(flows).some(f => f.id !== currentId && f.name.toLowerCase() === trimmedName.toLowerCase());
      // Check for duplicates in Code Files
      const codeExists = codeFiles.some(f => f.id !== currentId && f.name.toLowerCase() === trimmedName.toLowerCase());
      
      if (flowExists || codeExists) {
          alert("文件名称已存在，请使用其他名称 (File name already exists).");
          return false;
      }
      return true;
  };

  const submitRename = () => {
    if (editingId && editName.trim()) {
        if (validateName(editName, editingId)) {
            if (editType === 'flow') {
                onRenameFlow(editingId, editName.trim());
            } else if (editType === 'code') {
                onRenameCodeFile(editingId, editName.trim());
            }
        }
    }
    setEditingId(null);
    setEditType(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submitRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditType(null);
    }
  };

  const handleDelete = (id: string, type: 'flow' | 'code') => {
    if (type === 'flow') {
        onDeleteFlow(id);
    } else {
        onDeleteCodeFile(id);
    }
    setContextMenu(null);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-60 bg-slate-50 border-r border-slate-200 flex flex-col h-full shrink-0 relative">
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <Command className="w-5 h-5 text-indigo-600" />
          <span>{t('project.title')}</span>
        </div>
      </div>

      {/* Flows Section */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('project.flows')}</span>
          <button 
            onClick={onAddFlow}
            className="p-1 hover:bg-slate-200 rounded text-indigo-600 transition-colors"
            title={t('project.newFlow')}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        
        <div className="space-y-0.5">
          {(Object.values(flows) as FlowData[]).map(flow => (
            <div 
              key={flow.id}
              className={`
                group flex items-center justify-between px-4 py-2 text-sm cursor-pointer transition-colors relative
                ${activeTabId === flow.id ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500' : 'text-slate-600 hover:bg-slate-100'}
              `}
              onClick={() => onOpenTab(flow.id, 'flow', flow.name)}
              onContextMenu={(e) => handleContextMenu(e, flow.id, 'flow')}
            >
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <Workflow className="w-4 h-4 shrink-0" />
                {editingId === flow.id ? (
                  <input 
                    ref={editInputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={submitRename}
                    className="w-full bg-white border border-indigo-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="truncate select-none">{flow.name}</span>
                )}
              </div>
              
              {!editingId && (
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setContextMenu({ x: e.clientX, y: e.clientY, id: flow.id, type: 'flow' }); 
                  }}
                  className="p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-indigo-600 hover:bg-slate-200 rounded transition-all"
                >
                  <MoreVertical className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Code Functions Section */}
        <div className="mt-4 pt-2 border-t border-slate-200">
           <div className="px-3 py-2 flex items-center justify-between">
             <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('project.functions')}</span>
             <button 
               onClick={onAddCodeFile}
               className="p-1 hover:bg-slate-200 rounded text-indigo-600 transition-colors"
               title={t('project.newFunc')}
             >
               <Plus className="w-3.5 h-3.5" />
             </button>
           </div>
           
           {codeFiles.length === 0 ? (
             <div className="px-3 py-2 text-xs text-slate-400 italic">{t('project.noFuncs')}</div>
           ) : (
             <div className="space-y-0.5">
               {codeFiles.map(file => (
                 <div 
                   key={file.id} 
                   className={`
                     flex items-center justify-between px-4 py-2 text-sm cursor-pointer transition-colors group
                     ${activeTabId === file.id ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500' : 'text-slate-600 hover:bg-slate-100'}
                   `}
                   onClick={() => onOpenTab(file.id, 'code', file.name)}
                   onContextMenu={(e) => handleContextMenu(e, file.id, 'code')}
                 >
                   <div className="flex items-center gap-2 overflow-hidden flex-1">
                     <FileJson className="w-4 h-4 text-rose-500 shrink-0" />
                     {editingId === file.id ? (
                        <input 
                            ref={editInputRef}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={submitRename}
                            className="w-full bg-white border border-rose-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                            onClick={(e) => e.stopPropagation()}
                        />
                     ) : (
                        <span className="truncate">{file.name}</span>
                     )}
                   </div>
                   
                   {!editingId && (
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setContextMenu({ x: e.clientX, y: e.clientY, id: file.id, type: 'code' }); 
                        }}
                        className="p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-600 hover:bg-slate-200 rounded transition-all"
                    >
                        <MoreVertical className="w-3 h-3" />
                    </button>
                   )}
                 </div>
               ))}
             </div>
           )}
        </div>

        {/* Libraries Section */}
        <div className="mt-4 pt-2 border-t border-slate-200">
           <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
             <span>{t('project.libs')}</span>
             <button 
               onClick={() => fileInputRef.current?.click()}
               className="p-1 hover:bg-slate-200 rounded text-indigo-600 transition-colors" 
               title="Upload DLL"
             >
               <Upload className="w-3 h-3" />
             </button>
             <input 
               type="file" 
               accept=".dll" 
               className="hidden" 
               ref={fileInputRef} 
               onChange={(e) => {
                 const file = e.target.files?.[0];
                 if (file) {
                   // Mock parsing DLL methods for demo purposes
                   const namespace = file.name.replace('.dll', '');
                   const mockMethods = [
                       { name: 'Execute', returnType: 'void', parameters: [] },
                       { name: 'Calculate', returnType: 'int', parameters: [{name: 'a', type: 'int'}, {name: 'b', type: 'int'}] },
                       { name: 'ToString', returnType: 'string', parameters: [] },
                       { name: 'Initialize', returnType: 'bool', parameters: [{name: 'config', type: 'string'}] },
                       { name: 'ProcessData', returnType: 'object', parameters: [{name: 'input', type: 'object'}] }
                   ];
                   
                   onLibraryUpload({
                     id: `lib-${Date.now()}`,
                     name: file.name,
                     namespaces: [{ name: namespace, classes: [{ name: "Main", methods: mockMethods, properties: [] }] }], 
                     uploadDate: new Date().toISOString()
                   });
                 }
               }} 
             />
           </div>
           {libraries.length === 0 ? (
             <div className="px-3 py-2 text-xs text-slate-400 italic">{t('project.noLibs')}</div>
           ) : (
             libraries.map(lib => (
               <div key={lib.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 group">
                 <Package className="w-3.5 h-3.5 text-amber-500" />
                 <div className="flex flex-col overflow-hidden">
                   <span className="truncate font-medium">{lib.name}</span>
                   <span className="text-[10px] text-slate-400 truncate">{lib.namespaces[0]?.name || lib.name.replace('.dll','')}</span>
                 </div>
               </div>
             ))
           )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <button className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
          <Settings className="w-4 h-4" />
          {t('project.settings')}
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          ref={contextMenuRef}
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 w-36 py-1 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button 
            onClick={() => {
                if (contextMenu.type === 'flow' && onFindReferences) onFindReferences(contextMenu.id);
                if (contextMenu.type === 'code' && onFindCodeReferences) onFindCodeReferences(contextMenu.id);
                setContextMenu(null);
            }}
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 text-left w-full transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5" />
            查找引用
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button 
            onClick={() => {
                const item = contextMenu.type === 'flow' ? flows[contextMenu.id] : codeFiles.find(c => c.id === contextMenu.id);
                if(item) startRename(contextMenu.id, item.name, contextMenu.type);
            }}
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 text-left w-full transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            {t('ctx.rename')}
          </button>
          <button 
            onClick={() => handleDelete(contextMenu.id, contextMenu.type)}
            className="flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 text-left w-full transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('ctx.delete')}
          </button>
        </div>
      )}
    </div>
  );
};
