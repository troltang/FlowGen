
import React from 'react';
import { Play, Layers, Undo2, Redo2, Database, Group, Bot, Wand2 } from 'lucide-react';

interface TopBarProps {
  onRun: () => void;
  isRunning: boolean;
  onSave?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToggleVariables: () => void;
  onToggleAICopilot: () => void;
  onGroupSelected: () => void;
  onAutoLayout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  onRun, 
  isRunning, 
  onSave, 
  canUndo, 
  canRedo, 
  onUndo, 
  onRedo,
  onToggleVariables,
  onToggleAICopilot,
  onGroupSelected,
  onAutoLayout
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20 shadow-sm relative select-none shrink-0">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-md">
          <Layers className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-xl text-slate-800 tracking-tight">FlowGen <span className="text-indigo-600">AI</span></h1>
          <p className="text-xs text-slate-500 -mt-1">可视化逻辑构建器</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Undo/Redo Group */}
         <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2">
          <button 
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-2 rounded-md transition-colors ${!canUndo ? 'text-slate-300' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
            title="撤销"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button 
             onClick={onRedo}
             disabled={!canRedo}
             className={`p-2 rounded-md transition-colors ${!canRedo ? 'text-slate-300' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
             title="重做"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Tools */}
        <button 
          onClick={onToggleAICopilot}
          className="text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-md hover:shadow-lg flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm font-medium border border-transparent"
        >
          <Bot className="w-4 h-4" />
          AI 编程助手
        </button>
        
        <button
          onClick={onAutoLayout}
          className="text-slate-600 hover:text-indigo-600 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium border border-transparent hover:border-slate-200"
          title="自动整理布局"
        >
          <Wand2 className="w-4 h-4" />
          美化布局
        </button>

        <button
          onClick={onGroupSelected}
          className="text-slate-600 hover:text-indigo-600 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium border border-transparent hover:border-slate-200"
        >
          <Group className="w-4 h-4" />
          组合选中
        </button>

        <button 
          onClick={onToggleVariables}
          className="text-slate-600 hover:text-indigo-600 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium border border-transparent hover:border-slate-200"
        >
          <Database className="w-4 h-4" />
          变量管理
        </button>

        {/* Separator */}
        <div className="h-8 w-px bg-slate-200 mx-2"></div>

        {/* Run Button */}
        <button
          onClick={onRun}
          disabled={isRunning}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm
            ${isRunning 
              ? 'bg-emerald-100 text-emerald-400 cursor-not-allowed border border-emerald-100' 
              : 'bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-md active:scale-95 border border-emerald-600'}
          `}
        >
          <Play className={`w-4 h-4 ${isRunning ? 'animate-spin' : 'fill-current'}`} />
          {isRunning ? '运行中...' : '运行流程'}
        </button>
      </div>
    </header>
  );
};
