
import React from 'react';
import { Play, Layers, Undo2, Redo2, Database, Group, Bot, Wand2, CheckSquare, Languages, MousePointer2, Hand, Square } from 'lucide-react';
import { useTranslation, Language } from '../utils/i18n';

interface TopBarProps {
  onRun: () => void;
  onStop?: () => void;
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
  onCompile: () => void;
  onToggleLanguage: () => void;
  currentLanguage: Language;
  selectionMode: 'select' | 'pan';
  onSetSelectionMode: (mode: 'select' | 'pan') => void;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  onRun, 
  onStop,
  isRunning, 
  onSave, 
  canUndo, 
  canRedo, 
  onUndo, 
  onRedo,
  onToggleVariables,
  onToggleAICopilot,
  onGroupSelected,
  onAutoLayout,
  onCompile,
  onToggleLanguage,
  currentLanguage,
  selectionMode,
  onSetSelectionMode
}) => {
  const { t } = useTranslation();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20 shadow-sm relative select-none shrink-0">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-md">
          <Layers className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-xl text-slate-800 tracking-tight">FlowGen <span className="text-indigo-600">AI</span></h1>
          <p className="text-xs text-slate-500 -mt-1">{t('app.subtitle')}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Undo/Redo Group */}
         <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2">
          <button 
            onClick={onUndo}
            disabled={!canUndo || isRunning}
            className={`p-2 rounded-md transition-colors ${!canUndo || isRunning ? 'text-slate-300' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
            title={t('btn.undo')}
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button 
             onClick={onRedo}
             disabled={!canRedo || isRunning}
             className={`p-2 rounded-md transition-colors ${!canRedo || isRunning ? 'text-slate-300' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
             title={t('btn.redo')}
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Selection Mode Toggle */}
        <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2">
            <button
                onClick={() => onSetSelectionMode('pan')}
                disabled={isRunning}
                className={`p-2 rounded-md transition-all ${selectionMode === 'pan' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'} ${isRunning ? 'opacity-50' : ''}`}
                title="Pan Mode (Hand)"
            >
                <Hand className="w-4 h-4" />
            </button>
            <button
                onClick={() => onSetSelectionMode('select')}
                disabled={isRunning}
                className={`p-2 rounded-md transition-all ${selectionMode === 'select' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'} ${isRunning ? 'opacity-50' : ''}`}
                title="Selection Mode (Box Select)"
            >
                <MousePointer2 className="w-4 h-4" />
            </button>
        </div>

        {/* Tools */}
        <button 
          onClick={onToggleAICopilot}
          disabled={isRunning}
          className={`text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-md hover:shadow-lg flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm font-medium border border-transparent ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Bot className="w-4 h-4" />
          {t('btn.aiCopilot')}
        </button>
        
        <button
          onClick={onAutoLayout}
          disabled={isRunning}
          className={`text-slate-600 hover:text-indigo-600 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium border border-transparent hover:border-slate-200 ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={t('btn.autoLayout')}
        >
          <Wand2 className="w-4 h-4" />
          {t('btn.autoLayout')}
        </button>

        <button
          onClick={onGroupSelected}
          disabled={isRunning}
          className={`text-slate-600 hover:text-indigo-600 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium border border-transparent hover:border-slate-200 ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Group className="w-4 h-4" />
          {t('btn.group')}
        </button>

        <button 
          onClick={onToggleVariables}
          disabled={isRunning}
          className={`text-slate-600 hover:text-indigo-600 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium border border-transparent hover:border-slate-200 ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Database className="w-4 h-4" />
          {t('btn.variables')}
        </button>

        <button 
          onClick={onCompile} 
          disabled={isRunning}
          className={`text-slate-600 hover:text-indigo-600 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium border border-transparent hover:border-slate-200 ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <CheckSquare className="w-4 h-4" /> 
          {t('btn.compile')}
        </button>

        <button 
          onClick={onToggleLanguage} 
          className="text-slate-600 hover:text-indigo-600 flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-50 transition-colors text-sm font-medium border border-transparent hover:border-slate-200"
        >
          <Languages className="w-4 h-4" /> 
          {currentLanguage === 'zh' ? 'EN' : '中文'}
        </button>

        {/* Separator */}
        <div className="h-8 w-px bg-slate-200 mx-2"></div>

        {/* Run/Stop Button */}
        {isRunning ? (
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm bg-red-500 text-white hover:bg-red-600 hover:shadow-md active:scale-95 border border-red-600"
          >
            <Square className="w-4 h-4 fill-current" />
            {t('btn.stop')}
          </button>
        ) : (
          <button
            onClick={onRun}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-md active:scale-95 border border-emerald-600"
          >
            <Play className="w-4 h-4 fill-current" />
            {t('btn.run')}
          </button>
        )}
      </div>
    </header>
  );
};
