
import { useState, createContext, useContext } from 'react';

export type Language = 'zh' | 'en';

export const translations = {
  zh: {
    // TopBar
    'app.title': 'FlowGen AI',
    'app.subtitle': '可视化逻辑构建器',
    'btn.undo': '撤销',
    'btn.redo': '重做',
    'btn.aiCopilot': 'AI 编程助手',
    'btn.autoLayout': '美化布局',
    'btn.group': '组合选中',
    'btn.variables': '变量 & 结构体',
    'btn.compile': '编译检查',
    'btn.run': '运行流程',
    'btn.stop': '停止运行',
    'btn.running': '运行中...',
    
    // Sidebar
    'tools.title': '工具箱',
    'group.flow': '流程控制',
    'group.logic': '逻辑 & 动作',
    'group.advanced': '高级功能',
    'node.start': '开始',
    'node.end': '结束',
    'node.decision': '判断',
    'node.loop': '循环',
    'node.group': '节点组',
    'node.subflow': '子流程',
    'node.process': '处理',
    'node.code': 'C# 代码',
    'node.delay': '延时',
    'node.http': 'HTTP 请求',
    'node.db': '数据库',
    'node.aiTask': 'AI 生成',
    'node.log': '日志打印',
    'node.functionCall': '函数调用',

    // Project Sidebar
    'project.title': '项目管理',
    'project.flows': '流程列表',
    'project.functions': '代码函数 (C#)',
    'project.libs': '依赖库 (DLL)',
    'project.settings': '项目设置',
    'project.noLibs': '暂无依赖库',
    'project.noFuncs': '暂无代码文件',
    'project.newFlow': '新建流程',
    'project.newFunc': '新建函数',
    'project.search': '搜索文件...',
    'ctx.rename': '重命名',
    'ctx.delete': '删除',

    // Variable Panel
    'var.title': '数据管理',
    'var.tab.local': '局部变量',
    'var.tab.global': '全局变量',
    'var.tab.struct': '结构体定义',
    'var.add': '添加变量',
    'var.name': '名称',
    'var.type': '类型',
    'var.array': '数组',
    'var.value': '默认值',
    'var.desc': '变量名仅支持字母、数字、下划线。',
    'struct.add': '定义结构体',
    'struct.field.add': '添加字段',
    
    // Compiler
    'compiler.title': '编译结果',
    'compiler.success': '编译成功，无异常。',
    'compiler.error': '错误',
    'compiler.warning': '警告',
    
    // Config
    'config.title': '配置',
    'config.label': '标签名称',
    'config.apply': '应用更改',
    'config.subflow.select': '选择子流程',
    'config.func.file': '选择代码文件',
    'config.func.method': '选择方法',
    'config.func.params': '参数映射',
    'config.func.return': '返回值存入变量',
  },
  en: {
    // TopBar
    'app.title': 'FlowGen AI',
    'app.subtitle': 'Visual Logic Builder',
    'btn.undo': 'Undo',
    'btn.redo': 'Redo',
    'btn.aiCopilot': 'AI Copilot',
    'btn.autoLayout': 'Auto Layout',
    'btn.group': 'Group',
    'btn.variables': 'Vars & Structs',
    'btn.compile': 'Compile',
    'btn.run': 'Run Flow',
    'btn.stop': 'Stop',
    'btn.running': 'Running...',

    // Sidebar
    'tools.title': 'Toolbox',
    'group.flow': 'Flow Control',
    'group.logic': 'Logic & Actions',
    'group.advanced': 'Advanced',
    'node.start': 'Start',
    'node.end': 'End',
    'node.decision': 'Decision',
    'node.loop': 'Loop',
    'node.group': 'Group',
    'node.subflow': 'Sub Flow',
    'node.process': 'Process',
    'node.code': 'C# Code',
    'node.delay': 'Delay',
    'node.http': 'HTTP Request',
    'node.db': 'Database',
    'node.aiTask': 'AI Task',
    'node.log': 'Log',
    'node.functionCall': 'Function Call',

    // Project Sidebar
    'project.title': 'Project Manager',
    'project.flows': 'Flows',
    'project.functions': 'Code Functions (C#)',
    'project.libs': 'Libraries (DLL)',
    'project.settings': 'Project Settings',
    'project.noLibs': 'No libraries',
    'project.noFuncs': 'No code files',
    'project.newFlow': 'New Flow',
    'project.newFunc': 'New Function',
    'project.search': 'Search files...',
    'ctx.rename': 'Rename',
    'ctx.delete': 'Delete',

    // Variable Panel
    'var.title': 'Data Manager',
    'var.tab.local': 'Local Vars',
    'var.tab.global': 'Global Vars',
    'var.tab.struct': 'Structs',
    'var.add': 'Add Variable',
    'var.name': 'Name',
    'var.type': 'Type',
    'var.array': 'Array',
    'var.value': 'Default',
    'var.desc': 'Alphanumeric and underscore only.',
    'struct.add': 'Define Struct',
    'struct.field.add': 'Add Field',

    // Compiler
    'compiler.title': 'Compilation Output',
    'compiler.success': 'Compilation successful. No errors.',
    'compiler.error': 'Error',
    'compiler.warning': 'Warning',

    // Config
    'config.title': 'Config',
    'config.label': 'Label',
    'config.apply': 'Apply Changes',
    'config.subflow.select': 'Select Sub-flow',
    'config.func.file': 'Select Code File',
    'config.func.method': 'Select Method',
    'config.func.params': 'Parameters',
    'config.func.return': 'Store Result In',
  }
};

export const LanguageContext = createContext<{
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
}>({
  lang: 'zh',
  setLang: () => {},
  t: (key) => key,
});

export const useTranslation = () => useContext(LanguageContext);
