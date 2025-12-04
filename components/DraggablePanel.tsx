import React, { useState, useRef, useEffect } from 'react';
import { X, GripHorizontal, ArrowDownRight, Minus } from 'lucide-react';

interface DraggablePanelProps {
  title: string;
  icon?: React.ElementType;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  headerColor?: string;
  zIndex?: number;
  onInteract?: () => void;
}

export const DraggablePanel: React.FC<DraggablePanelProps> = ({
  title,
  icon: Icon,
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 400, height: 500 },
  minSize = { width: 300, height: 200 },
  onClose,
  children,
  className = "",
  headerColor = "bg-white",
  zIndex = 50,
  onInteract
}) => {
  // Safe initial positioning logic to keep panel within viewport
  const getSafePosition = (pos: { x: number, y: number }, w: number, h: number) => {
    const maxX = window.innerWidth - w;
    const maxY = window.innerHeight - h;
    return {
      x: Math.min(Math.max(0, pos.x), maxX > 0 ? maxX : 0),
      y: Math.min(Math.max(0, pos.y), maxY > 0 ? maxY : 0)
    };
  };

  const [size, setSize] = useState(initialSize);
  const [position, setPosition] = useState(() => getSafePosition(initialPosition, initialSize.width, initialSize.height));
  
  // Update position if initialPosition prop changes (e.g., clicking a different node)
  useEffect(() => {
    setPosition(getSafePosition(initialPosition, size.width, size.height));
  }, [initialPosition.x, initialPosition.y]);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPosRef = useRef(position);
  const startSizeRef = useRef(size);

  // Drag logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        setPosition({
          x: Math.max(0, startPosRef.current.x + deltaX),
          y: Math.max(0, startPosRef.current.y + deltaY)
        });
      }
      if (isResizing && !isMinimized) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        setSize({
          width: Math.max(minSize.width, startSizeRef.current.width + deltaX),
          height: Math.max(minSize.height, startSizeRef.current.height + deltaY)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, minSize, isMinimized]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (onInteract) onInteract();
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    startPosRef.current = position;
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onInteract) onInteract();
    setIsResizing(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    startSizeRef.current = size;
  };

  return (
    <div 
      ref={panelRef}
      className={`absolute flex flex-col bg-white shadow-2xl rounded-xl border border-slate-200 overflow-hidden ${className} animate-in zoom-in-95 duration-200`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? 'auto' : size.height,
        zIndex: zIndex,
        maxHeight: '90vh'
      }}
      onMouseDown={() => onInteract && onInteract()}
    >
      {/* Header / Drag Handle */}
      <div 
        className={`flex items-center justify-between p-3 border-b border-slate-100 cursor-move shrink-0 select-none ${headerColor}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {Icon && <Icon className="w-4 h-4 text-slate-500 shrink-0" />}
          <h3 className="font-bold text-slate-800 text-sm truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <GripHorizontal className="w-4 h-4 text-slate-300 mr-2" />
          
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} 
            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded transition-colors"
            title={isMinimized ? "展开" : "折叠"}
          >
            <Minus className="w-4 h-4" />
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            className="text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <>
          <div className="flex-1 overflow-hidden relative flex flex-col h-full">
            {children}
          </div>

          {/* Resize Handle */}
          <div 
            className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-0.5 z-20"
            onMouseDown={handleResizeStart}
          >
            <ArrowDownRight className="w-4 h-4 text-slate-300 hover:text-indigo-500 transition-colors" />
          </div>
        </>
      )}
    </div>
  );
};