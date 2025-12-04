import React, { useState, useRef } from 'react';
import { Folder, FileText, Settings, ChevronRight, ChevronDown, Plus, Search, Command, Package, Upload } from 'lucide-react';
import { ProjectFolder, Library } from '../types';

interface ProjectSidebarProps {
  onLoadProject: (id: string) => void;
  onLibraryUpload: (lib: Library) => void;
  libraries: Library[];
}

// Mock Data
const MOCK_FOLDERS: ProjectFolder[] = [
  {
    id: 'f1',
    name: '我的流程',
    files: [
      { id: 'p1', name: '用户注册逻辑', updatedAt: '2023-10-01' },
      { id: 'p2', name: '订单处理流程', updatedAt: '2023-10-02' }
    ],
    folders: [
      {
        id: 'f1-1',
        name: '草稿箱',
        files: [{ id: 'p3', name: '测试流', updatedAt: '2023-10-05' }],
        folders: []
      }
    ],
    isOpen: true
  },
  {
    id: 'f2',
    name: '系统模板',
    files: [
      { id: 't1', name: '审批流模板', updatedAt: '2023-09-15' },
      { id: 't2', name: '数据清洗', updatedAt: '2023-09-20' }
    ],
    folders: [],
    isOpen: false
  }
];

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({ onLoadProject, onLibraryUpload, libraries }) => {
  const [folders, setFolders] = useState<ProjectFolder[]>(MOCK_FOLDERS);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleFolder = (folderId: string) => {
    const toggle = (list: ProjectFolder[]): ProjectFolder[] => {
      return list.map(f => {
        if (f.id === folderId) return { ...f, isOpen: !f.isOpen };
        if (f.folders.length > 0) return { ...f, folders: toggle(f.folders) };
        return f;
      });
    };
    setFolders(toggle(folders));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate DLL Parsing
    const libName = file.name;
    const namespace = libName.replace('.dll', '');
    
    // Generate some mock methods for demonstration
    const mockMethods = [
      { name: 'Calculate', returnType: 'int', parameters: ['int a', 'int b'] },
      { name: 'FormatDate', returnType: 'string', parameters: ['DateTime date'] },
      { name: 'ValidateEmail', returnType: 'bool', parameters: ['string email'] },
      { name: 'GetConfig', returnType: 'string', parameters: ['string key'] }
    ];

    const newLib: Library = {
      id: `lib-${Date.now()}`,
      name: libName,
      namespace: `${namespace}.Utils`,
      methods: mockMethods
    };

    onLibraryUpload(newLib);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const FolderItem = ({ folder, depth = 0 }: { folder: ProjectFolder; depth?: number }) => (
    <div>
      <div 
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors select-none"
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={() => toggleFolder(folder.id)}
      >
        {folder.isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        )}
        <Folder className="w-4 h-4 text-indigo-400 fill-indigo-50" />
        <span className="font-medium truncate">{folder.name}</span>
      </div>
      
      {folder.isOpen && (
        <div>
          {folder.folders.map(sub => (
            <FolderItem key={sub.id} folder={sub} depth={depth + 1} />
          ))}
          {folder.files.map(file => (
            <div 
              key={file.id}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors select-none group"
              style={{ paddingLeft: `${depth * 12 + 28}px` }}
              onClick={() => onLoadProject(file.id)}
            >
              <FileText className="w-3.5 h-3.5 group-hover:text-indigo-500" />
              <span className="truncate flex-1">{file.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-60 bg-slate-50 border-r border-slate-200 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <Command className="w-5 h-5 text-indigo-600" />
          <span>项目管理</span>
        </div>
        <div className="ml-auto">
          <button className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-indigo-600 transition-colors">
             <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input 
            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            placeholder="搜索文件..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Project Files */}
        {folders.map(folder => (
          <FolderItem key={folder.id} folder={folder} />
        ))}

        {/* Libraries Section */}
        <div className="mt-4 pt-2 border-t border-slate-200">
           <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
             <span>引用库 (DLL)</span>
             <button 
               onClick={() => fileInputRef.current?.click()}
               className="p-1 hover:bg-slate-200 rounded text-indigo-600 transition-colors" 
               title="上传 DLL"
             >
               <Upload className="w-3 h-3" />
             </button>
             <input 
               type="file" 
               accept=".dll" 
               className="hidden" 
               ref={fileInputRef} 
               onChange={handleFileUpload}
             />
           </div>
           {libraries.length === 0 ? (
             <div className="px-3 py-2 text-xs text-slate-400 italic">暂无外部引用</div>
           ) : (
             libraries.map(lib => (
               <div key={lib.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 group">
                 <Package className="w-3.5 h-3.5 text-amber-500" />
                 <div className="flex flex-col overflow-hidden">
                   <span className="truncate font-medium">{lib.name}</span>
                   <span className="text-[10px] text-slate-400 truncate">{lib.namespace}</span>
                 </div>
               </div>
             ))
           )}
        </div>
      </div>

      {/* Footer Settings */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <button className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
          <Settings className="w-4 h-4" />
          系统参数配置
        </button>
      </div>
    </div>
  );
};