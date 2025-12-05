
import React, { useState, useRef, useEffect } from 'react';
import { Variable, Library, StructDefinition } from '../types';
import { Box, Code, Variable as VarIcon, Type, Braces } from 'lucide-react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: Variable[];
  libraries?: Library[]; // New prop for DLLs
  structs?: StructDefinition[]; // Struct definitions for autocomplete
  className?: string;
  isFullscreen?: boolean;
  onCursorChange?: (index: number) => void;
}

const CSHARP_KEYWORDS = [
  'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked',
  'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else',
  'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for',
  'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock',
  'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override', 'params',
  'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short',
  'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true',
  'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual',
  'void', 'volatile', 'while', 'var', 'dynamic', 'async', 'await'
];

export const CodeEditor: React.FC<CodeEditorProps> = ({ 
  value, 
  onChange, 
  variables, 
  libraries = [], 
  structs = [],
  className,
  isFullscreen = false,
  onCursorChange
}) => {
  const [suggestion, setSuggestion] = useState<{ type: 'keyword' | 'variable' | 'library' | 'field', list: string[], left: number, top: number } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    onChange(val);
    checkSuggestions(val, pos);
    if (onCursorChange) onCursorChange(pos);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      if (onCursorChange) {
          onCursorChange(e.currentTarget.selectionStart);
      }
  };

  // Reset selection index when suggestion list changes
  useEffect(() => {
    if (suggestion) {
        setSelectedIndex(0);
    }
  }, [suggestion?.list]);

  // Scroll to selected item
  useEffect(() => {
      if (suggestion && suggestionRef.current) {
          const activeItem = suggestionRef.current.children[selectedIndex] as HTMLElement;
          if (activeItem) {
              activeItem.scrollIntoView({ block: 'nearest' });
          }
      }
  }, [selectedIndex, suggestion]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestion) {
          applySuggestion(suggestion.list[selectedIndex]);
      } else {
          const start = e.currentTarget.selectionStart;
          const end = e.currentTarget.selectionEnd;
          const val = e.currentTarget.value;
          onChange(val.substring(0, start) + '  ' + val.substring(end));
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
              if(onCursorChange) onCursorChange(start + 2);
            }
          }, 0);
      }
    } else if (e.key === 'ArrowUp') {
        if (suggestion) {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + suggestion.list.length) % suggestion.list.length);
        }
    } else if (e.key === 'ArrowDown') {
        if (suggestion) {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % suggestion.list.length);
        }
    } else if (e.key === 'Enter') {
       if (suggestion) {
           e.preventDefault();
           applySuggestion(suggestion.list[selectedIndex]);
       }
    } else if (e.key === 'Escape') {
      if (suggestion) {
          e.preventDefault();
          setSuggestion(null);
      }
    }
  };

  const checkSuggestions = (text: string, cursorIndex: number) => {
    const textBefore = text.slice(0, cursorIndex);
    const lastChar = textBefore.slice(-1);

    // 1. Variable trigger "{"
    if (lastChar === '{') {
      const coords = getCaretCoordinates(textareaRef.current, cursorIndex);
      setSuggestion({
        type: 'variable',
        list: variables.map(v => v.name),
        left: coords.left,
        top: coords.top + 20
      });
      return;
    }

    // 2. Member Trigger "." (Structs or Libraries)
    if (lastChar === '.') {
      const match = textBefore.slice(0, -1).match(/([a-zA-Z0-9_]+)$/);
      if (match) {
        const tokenName = match[1];
        
        // A. Check Variables (Structs)
        const variable = variables.find(v => v.name === tokenName);
        if (variable) {
          const structDef = structs.find(s => s.name === variable.type);
          if (structDef && structDef.fields.length > 0) {
             const coords = getCaretCoordinates(textareaRef.current, cursorIndex);
             setSuggestion({
               type: 'field',
               list: structDef.fields.map(f => f.name),
               left: coords.left,
               top: coords.top + 20
             });
             return;
          }
        }

        // B. Check Libraries (Namespaces / Classes)
        let libSuggestions: string[] = [];
        
        for (const lib of libraries) {
            for (const ns of lib.namespaces) {
                // If token matches namespace, suggest classes
                if (ns.name === tokenName) {
                    libSuggestions = ns.classes.map(c => c.name);
                    break;
                }
                // If token matches class, suggest methods
                const cls = ns.classes.find(c => c.name === tokenName);
                if (cls) {
                    libSuggestions = cls.methods.map(m => m.name);
                    break;
                }
            }
            if (libSuggestions.length > 0) break;
        }

        if (libSuggestions.length > 0) {
            const coords = getCaretCoordinates(textareaRef.current, cursorIndex);
            setSuggestion({
                type: 'library',
                list: libSuggestions,
                left: coords.left,
                top: coords.top + 20
            });
            return;
        }
      }
    }

    // 3. Keywords / Library Namespaces (Autocomplete while typing word)
    const lastWordMatch = textBefore.match(/([a-zA-Z0-9_]+)$/); 
    if (lastWordMatch) {
      const word = lastWordMatch[1];
      
      // Combine keywords and library namespaces (flattened)
      const libNamespaces = libraries.flatMap(l => l.namespaces.map(ns => ns.name));
      const allCandidates = [...libNamespaces, ...CSHARP_KEYWORDS];
      
      if (word.length >= 1) {
        const matches = allCandidates.filter(k => k.toLowerCase().startsWith(word.toLowerCase()) && k !== word);
        if (matches.length > 0) {
          const coords = getCaretCoordinates(textareaRef.current, cursorIndex);
          // Determine type based on what matched first
          const isLib = libNamespaces.includes(matches[0]);
          setSuggestion({
            type: isLib ? 'library' : 'keyword',
            list: matches.slice(0, 8), // Limit to 8 suggestions
            left: coords.left,
            top: coords.top + 20
          });
          return;
        }
      }
    }

    setSuggestion(null);
  };

  const applySuggestion = (item: string) => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const text = value;
    const textBefore = text.slice(0, cursor);
    
    let newText = "";
    let newCursor = cursor;

    if (suggestion?.type === 'variable') {
      newText = textBefore + item + "}" + text.slice(cursor);
      newCursor = cursor + item.length + 1;
    } else if (suggestion?.type === 'field' || (suggestion?.type === 'library' && textBefore.endsWith('.'))) {
      // Just append the name (it was triggered by dot)
      newText = textBefore + item + text.slice(cursor);
      newCursor = cursor + item.length;
    } else {
       // Replacing a partial word
       const lastWordMatch = textBefore.match(/([a-zA-Z0-9_]+)$/);
       if (lastWordMatch) {
         const word = lastWordMatch[1];
         newText = textBefore.slice(0, -word.length) + item + text.slice(cursor);
         newCursor = cursor - word.length + item.length;
       } else {
         // Should not happen based on checkSuggestions logic but safe fallback
         newText = textBefore + item + text.slice(cursor);
         newCursor = cursor + item.length;
       }
    }

    onChange(newText);
    setSuggestion(null);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
        if(onCursorChange) onCursorChange(newCursor);
      }
    }, 0);
  };

  const highlightCode = (code: string) => {
    if (!code) return '';

    const escape = (str: string) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Gather library namespaces for highlighting (flattened)
    const libNamespaces = libraries.flatMap(l => l.namespaces.map(ns => ns.name));
    
    const combinedRegex = new RegExp([
      `"(?:\\\\.|[^"\\\\])*"`, // Strings
      `//.*`,                   // Comments
      `\\b(?:${CSHARP_KEYWORDS.join('|')})\\b`, // Keywords
      `\\b\\d+\\b`,              // Numbers
      ...libNamespaces.map(ns => `\\b${ns.replace('.', '\\.')}\\b`) // Library Namespaces
    ].join('|'), 'g'); 

    const parts = code.split(new RegExp(`(${combinedRegex.source})`, 'g'));

    return parts.map(part => {
      if (!part) return '';

      if (part.startsWith('"')) return `<span class="text-orange-300">${escape(part)}</span>`;
      if (part.startsWith('//')) return `<span class="text-gray-500 italic">${escape(part)}</span>`;
      if (/^\d+$/.test(part)) return `<span class="text-emerald-300">${part}</span>`;
      if (CSHARP_KEYWORDS.includes(part)) return `<span class="text-blue-400 font-bold">${part}</span>`;
      if (libNamespaces.includes(part)) return `<span class="text-purple-400 font-bold">${part}</span>`; // Highlight DLL namespaces
      
      return escape(part);
    }).join('');
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'variable': return <VarIcon className="w-3 h-3 text-amber-400" />;
          case 'library': return <Box className="w-3 h-3 text-purple-400" />;
          case 'field': return <Type className="w-3 h-3 text-cyan-400" />;
          default: return <Code className="w-3 h-3 text-blue-400" />;
      }
  };

  return (
    <div className={`relative ${className} bg-slate-900 rounded-lg overflow-hidden border border-slate-700 flex flex-col min-h-0`}>
      <div className="relative flex-1 overflow-hidden min-h-0">
        {/* Backdrop for highlighting */}
        <div 
          ref={backdropRef}
          className={`absolute inset-0 pointer-events-none p-3 whitespace-pre-wrap font-mono ${isFullscreen ? 'text-base' : 'text-sm'} leading-6 break-words text-slate-200 overflow-auto scrollbar-hide pb-10 h-full w-full`}
          dangerouslySetInnerHTML={{ __html: highlightCode(value) + '<br/>' }}
        />
        {/* Textarea for input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onSelect={handleSelect}
          onClick={handleSelect}
          onKeyUp={handleSelect}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onBlur={() => setTimeout(() => setSuggestion(null), 200)}
          spellCheck={false}
          className={`relative w-full h-full p-3 bg-transparent text-transparent caret-white font-mono ${isFullscreen ? 'text-base' : 'text-sm'} leading-6 resize-none outline-none break-words overflow-auto pb-10`}
          style={{ color: 'transparent' }}
        />
      </div>
      
      {/* Suggestions Popup */}
      {suggestion && (
        <div 
          ref={suggestionRef}
          className="absolute z-50 bg-slate-800 border border-slate-600 rounded-md shadow-2xl flex flex-col min-w-[180px] max-h-[200px] overflow-y-auto ring-1 ring-black/20"
          style={{ left: Math.min(suggestion.left, 400), top: suggestion.top }}
        >
          <div className="px-2 py-1.5 text-[10px] bg-slate-850 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-700 flex justify-between">
            <span>
                {suggestion.type === 'variable' ? 'Variables' : 
                 suggestion.type === 'library' ? 'Library' : 
                 suggestion.type === 'field' ? 'Members' : 'Keywords'}
            </span>
            <span className="text-[9px] opacity-60">⇅ Select  ↲ Enter</span>
          </div>
          {suggestion.list.map((item, idx) => (
             <button 
               key={idx}
               onMouseDown={(e) => { e.preventDefault(); applySuggestion(item); }}
               className={`
                 px-3 py-1.5 text-xs text-left font-mono border-b border-slate-700/50 last:border-0 flex items-center gap-2 transition-colors
                 ${idx === selectedIndex ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}
               `}
             >
               {getIcon(suggestion.type)}
               {suggestion.type === 'variable' && <span className="text-amber-400 opacity-70">{`{`}</span>}
               {suggestion.type === 'field' && <span className="text-cyan-400 opacity-70">.</span>}
               <span>{item}</span>
               {suggestion.type === 'variable' && <span className="text-amber-400 opacity-70">{`}`}</span>}
             </button>
          ))}
        </div>
      )}
      
      {/* Basic Error Checking Indicator */}
      {(value.split('{').length !== value.split('}').length || value.split('(').length !== value.split(')').length) && (
        <div className="absolute bottom-2 right-2 text-[10px] text-red-400 flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded border border-red-500/30 pointer-events-none">
           <Braces className="w-3 h-3" />
           括号不匹配
        </div>
      )}
    </div>
  );
};

// Helper for caret coordinates (Simplified)
const getCaretCoordinates = (element: HTMLTextAreaElement | null, position: number) => {
  if (!element) return { left: 0, top: 0 };
  const { scrollLeft, scrollTop } = element;
  const textLines = element.value.substr(0, position).split("\n");
  const currentLineIndex = textLines.length - 1;
  const currentLineText = textLines[currentLineIndex];
  
  // Rough estimation
  const charWidth = 8.5; 
  const lineHeight = 24;

  return {
    left: currentLineText.length * charWidth + 10 - scrollLeft, 
    top: currentLineIndex * lineHeight + 10 - scrollTop 
  };
};
