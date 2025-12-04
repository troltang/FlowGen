import React, { useState, useRef, useEffect } from 'react';
import { NodeType } from '../types';
import { Play, Square, GitFork, Sparkles, StopCircle, GripVertical, Code2, Clock, Terminal, Box, ChevronLeft, ChevronRight, GripHorizontal, ChevronDown } from 'lucide-react';

// Tool Group Configuration
const TOOLS = [
  {
    id: 'flow',
    label: '流程控制',
    items: [
      { type: NodeType.START, label: '开始', icon: Play, color: 'emerald' },
      { type: NodeType.END, label: '结束', icon: StopCircle, color: 'red' },
      { type: NodeType.DECISION, label: '判断', icon: GitFork, color: 'amber' },
      { type: NodeType.GROUP, label: '节点组', icon: Box, color: 'indigo' },
    ]
  },
  {
    id: 'logic',
    label: '逻辑 & 动作',
    items: [
      { type: NodeType.PROCESS, label: '处理', icon: Square, color: 'blue' },
      { type: NodeType.CODE, label: 'C# 代码', icon: Code2, color: 'slate' },
      { type: NodeType.DELAY, label: '延时', icon: Clock, color: 'orange' },
    ]
  },
  {
    id: 'advanced',
    label: '高级功能',
    items: [
      { type: NodeType.AI_TASK, label: 'AI 生成', icon: Sparkles, color: 'purple' },
      { type: NodeType.LOG, label: '日志打印', icon: Terminal, color: 'gray' },
    ]
  }
];

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    flow: true,
    logic: true,
    advanced: true
  });
  
  const dragRef = useRef<HTMLDivElement>(null);

  // Dragging logic
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

  const DraggableItem = ({ type, label, icon: Icon, color }: { type: NodeType; label: string; icon: React.ElementType; color: string }) => (
    <div
      className={`flex items-center p-2 mb-2 bg-white rounded-md border border-slate-200 shadow-sm cursor-move hover:shadow hover:border-${color}-400 transition-all group`}
      onDragStart={(event) => onDragStart(event, type, label)}
      draggable
    >
      <GripVertical className="w-3.5 h-3.5 text-slate-300 mr-2 group-hover:text-slate-500" />
      <div className={`p-1.5 rounded bg-${color}-50 mr-2`}>
        <Icon className={`w-4 h-4 text-${color}-600`} />
      </div>
      {!isCollapsed && <div className="text-xs font-medium text-slate-700">{label}</div>}
    </div>
  );

  return (
    <aside 
      className={`absolute z-40 bg-white/95 backdrop-blur shadow-xl border border-slate-200 rounded-xl transition-all duration-200 flex flex-col select-none ${isCollapsed ? 'w-16' : 'w-48'}`}
      style={{ left: position.x, top: position.y, maxHeight: 'calc(100vh - 150px)' }}
    >
      {/* Drag Handle */}
      <div 
        ref={dragRef}
        className="h-6 bg-slate-100 rounded-t-xl cursor-move flex items-center justify-center border-b border-slate-200 hover:bg-slate-200 transition-colors"
        onMouseDown={() => setIsDragging(true)}
      >
        <GripHorizontal className="w-8 h-4 text-slate-400" />
      </div>

      <div className="p-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        {!isCollapsed && (
          <div>
            <h2 className="font-bold text-slate-800 text-sm">工具箱</h2>
          </div>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
          title={isCollapsed ? "展开工具箱" : "收起工具箱"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-slate-200">
        {TOOLS.map((group, index) => (
          <div key={group.id} className={index !== 0 ? "mt-4" : ""}>
            {!isCollapsed ? (
              <button
                onClick={() => toggleGroup(group.id)}
                className="flex items-center justify-between w-full text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 hover:text-indigo-600 transition-colors group"
              >
                <span>{group.label}</span>
                <span className="p-0.5 rounded hover:bg-slate-100 text-slate-300 group-hover:text-indigo-500 transition-colors">
                  {openGroups[group.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </span>
              </button>
            ) : (
              // Separator in collapsed mode
              index !== 0 && <div className="w-8 mx-auto h-px bg-slate-100 my-2" />
            )}

            {/* Show items if group is open OR if sidebar is collapsed (always show items in icon mode) */}
            <div className={`space-y-1 ${!isCollapsed && !openGroups[group.id] ? 'hidden' : ''}`}>
              {group.items.map(item => (
                <DraggableItem 
                  key={item.type} 
                  type={item.type} 
                  label={item.label} 
                  icon={item.icon} 
                  color={item.color} 
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
