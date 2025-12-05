
import React, { useState, useRef, useEffect } from 'react';
import { NodeType } from '../types';
import { Play, Square, GitFork, Sparkles, StopCircle, GripVertical, Code2, Clock, Terminal, Box, ChevronLeft, ChevronRight, GripHorizontal, ChevronDown, Globe, Database, Repeat, Workflow, FileJson } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface DraggableItemProps {
  type: NodeType;
  label: string;
  icon: React.ElementType;
  color: string;
  isCollapsed: boolean;
  onDragStart: (event: React.DragEvent, nodeType: NodeType, label: string) => void;
}

const DraggableItem: React.FC<DraggableItemProps> = ({ type, label, icon: Icon, color, isCollapsed, onDragStart }) => (
  <div
    className={`flex items-center p-2 mb-2 bg-white rounded-md border border-slate-200 shadow-sm cursor-move hover:shadow hover:border-${color}-400 transition-all group overflow-hidden ${isCollapsed ? 'justify-center' : ''}`}
    onDragStart={(event) => onDragStart(event, type, label)}
    draggable
    title={isCollapsed ? label : undefined}
  >
    {/* Hide drag grip in collapsed mode to save space */}
    {!isCollapsed && (
      <GripVertical className="w-3.5 h-3.5 text-slate-300 mr-2 group-hover:text-slate-500 shrink-0" />
    )}
    <div className={`p-1.5 rounded bg-${color}-50 ${isCollapsed ? '' : 'mr-2'} shrink-0`}>
      <Icon className={`w-4 h-4 text-${color}-600`} />
    </div>
    <div className={`text-xs font-medium text-slate-700 whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
      {label}
    </div>
  </div>
);

interface SidebarProps {
  isRunning?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isRunning }) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  // Default all groups to CLOSED
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'flow': true,
    'logic': true, 
    'advanced': true
  });
  
  const dragRef = useRef<HTMLDivElement>(null);

  const TOOLS = [
    {
      id: 'flow',
      label: t('group.flow'),
      items: [
        { type: NodeType.START, label: t('node.start'), icon: Play, color: 'emerald' },
        { type: NodeType.END, label: t('node.end'), icon: StopCircle, color: 'red' },
        { type: NodeType.DECISION, label: t('node.decision'), icon: GitFork, color: 'amber' },
        { type: NodeType.LOOP, label: t('node.loop'), icon: Repeat, color: 'lime' },
        { type: NodeType.SUB_FLOW, label: t('node.subflow'), icon: Workflow, color: 'teal' },
        { type: NodeType.GROUP, label: t('node.group'), icon: Box, color: 'indigo' },
      ]
    },
    {
      id: 'logic',
      label: t('group.logic'),
      items: [
        { type: NodeType.PROCESS, label: t('node.process'), icon: Square, color: 'blue' },
        { type: NodeType.CODE, label: t('node.code'), icon: Code2, color: 'slate' },
        { type: NodeType.FUNCTION_CALL, label: t('node.functionCall'), icon: FileJson, color: 'rose' },
        { type: NodeType.DELAY, label: t('node.delay'), icon: Clock, color: 'orange' },
        { type: NodeType.HTTP, label: t('node.http'), icon: Globe, color: 'cyan' },
        { type: NodeType.DB, label: t('node.db'), icon: Database, color: 'pink' },
      ]
    },
    {
      id: 'advanced',
      label: t('group.advanced'),
      items: [
        { type: NodeType.AI_TASK, label: t('node.aiTask'), icon: Sparkles, color: 'purple' },
        { type: NodeType.LOG, label: t('node.log'), icon: Terminal, color: 'gray' },
      ]
    }
  ];

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition(prev => ({
          x: prev.x + e.movementX,
          y: prev.y + e.movementY
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const onDragStart = (event: React.DragEvent, nodeType: NodeType, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside 
      className={`absolute z-40 bg-white/95 backdrop-blur shadow-xl border border-slate-200 rounded-xl transition-all duration-500 ease-in-out flex flex-col select-none ${isCollapsed ? 'w-16' : 'w-48'}`}
      style={{ 
        left: position.x, 
        top: position.y, 
        maxHeight: 'calc(100vh - 150px)',
        transform: isRunning ? 'translateX(-300px)' : 'translateX(0)',
        opacity: isRunning ? 0 : 1,
        pointerEvents: isRunning ? 'none' : 'auto'
      }}
    >
      {/* Drag Handle */}
      <div 
        ref={dragRef}
        className="h-6 bg-slate-100 rounded-t-xl cursor-move flex items-center justify-center border-b border-slate-200 hover:bg-slate-200 transition-colors shrink-0"
        onMouseDown={() => setIsDragging(true)}
      >
        <GripHorizontal className="w-8 h-4 text-slate-400" />
      </div>

      <div className="p-3 border-b border-slate-100 flex items-center justify-between shrink-0 h-12">
        <div className={`transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
          <h2 className="font-bold text-slate-800 text-sm whitespace-nowrap">{t('tools.title')}</h2>
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-slate-200">
        {TOOLS.map((group, index) => (
          <div key={group.id} className={index !== 0 ? "mt-4" : ""}>
            <button
              onClick={() => toggleGroup(group.id)}
              className={`flex items-center w-full text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 hover:text-indigo-600 transition-colors group ${isCollapsed ? 'justify-center' : 'justify-between'}`}
              title={isCollapsed ? group.label : undefined}
            >
              {!isCollapsed && <span>{group.label}</span>}
              <span className={`p-0.5 rounded hover:bg-slate-100 text-slate-300 group-hover:text-indigo-500 transition-colors ${isCollapsed ? 'mx-auto' : ''}`}>
                {openGroups[group.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </span>
            </button>

            {/* Respect openGroups even in collapsed mode */}
            <div className={`space-y-1 ${!openGroups[group.id] ? 'hidden' : ''}`}>
              {group.items.map(item => (
                <DraggableItem 
                  key={item.type} 
                  type={item.type} 
                  label={item.label} 
                  icon={item.icon} 
                  color={item.color} 
                  isCollapsed={isCollapsed}
                  onDragStart={onDragStart}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
