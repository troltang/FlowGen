
import { AppNode, ExecutionResult, ExecutionLog, Variable, GeneratedFlowData, NodeType, CodeFile } from '../types';
import { Edge } from 'reactflow';

// Configuration for Zhipu AI
// 🔴 在线预览专用：请将您的 智谱AI API Key 粘贴在下方引号中 (例如 "abc.123...")
const HARDCODED_API_KEY = "6d8bc1ebfab049a2bed2df171765642f.H8ftaUxjRIcbxYsp"; 

const API_KEY = HARDCODED_API_KEY || process.env.API_KEY;
const API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
// Using glm-4-flash for high speed and low cost (economic choice)
const MODEL_NAME = "glm-4-flash"; 

const callZhipuAI = async (messages: any[], jsonMode: boolean = true) => {
  const apiKey = API_KEY;
  if (!apiKey) {
    throw new Error("API Key 未配置 (process.env.API_KEY is missing)");
  }

  const payload = {
    model: MODEL_NAME,
    messages: messages,
    stream: false,
    temperature: 0.1,
    top_p: 0.7,
    // Zhipu doesn't strictly enforce JSON via a parameter like 'response_format' in all SDK versions,
    // but glm-4-flash adheres well to system instructions. 
    // We strictly instruct it in the prompt.
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("API Rate Limit Exceeded (429)");
    }
    const errorText = await response.text();
    throw new Error(`Zhipu AI API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("API returned empty content");
  }

  return content;
};

// Retry helper
const retryWithBackoff = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.message?.includes('429') || error.message?.includes('503'))) {
      console.warn(`API Rate limited/Server Error. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const executeFlowWithGemini = async (nodes: AppNode[], edges: Edge[], variables: Variable[], codeFiles: CodeFile[] = []): Promise<ExecutionResult> => {
  // Serialize the graph for the LLM
  const logicNodes = nodes.filter(n => n.type !== 'group');
  
  const graphRepresentation = {
    nodes: logicNodes.map(n => ({
      id: n.id,
      type: n.type,
      label: n.data.label,
      description: n.data.description || '',
      code: n.data.code || '',
      duration: n.data.duration,
      url: n.data.url,
      method: n.data.method,
      headers: n.data.headers,
      httpBody: n.data.httpBody,
      dbOperation: n.data.dbOperation,
      connectionString: n.data.connectionString,
      sql: n.data.sql,
      loopCondition: n.data.loopCondition,
      functionName: n.data.functionName,
      codeFileId: n.data.codeFileId,
      parameterValues: n.data.parameterValues,
      variableName: n.data.variableName
    })),
    edges: edges.map(e => ({
      source: e.source,
      target: e.target,
      label: e.label || (e.sourceHandle === 'true' ? 'Yes' : e.sourceHandle === 'false' ? 'No' : e.sourceHandle === 'loopBody' ? 'Loop Body' : e.sourceHandle === 'loopEnd' ? 'Loop End' : 'Next'),
      sourceHandle: e.sourceHandle
    })),
    initialVariables: variables.reduce((acc, v) => ({ ...acc, [v.name]: v.value }), {})
  };

  const codeContext = codeFiles.map(f => `
    File ID: ${f.id}
    File Name: ${f.name}
    Content:
    \`\`\`csharp
    ${f.content}
    \`\`\`
  `).join('\n');

  const systemPrompt = `
    You are a sophisticated flowchart execution engine with C# code simulation capabilities.
    I will provide you with a JSON representation of a flowchart, initial variable states, and a set of C# code files.
    
    Your task is to simulate the execution of this flowchart step-by-step.
    
    Rules:
    1. Start at the 'start' node.
    2. Follow edges to the next node.
    3. **Variables**: Maintain the state of variables defined in 'initialVariables'. Update them as needed.
       - **Syntax**: Text fields might contain variables in format '{varName}'. Replace them with actual values during execution logging.
    4. **'code' Nodes**: Simulate the execution of the provided C# code. 
       - If the code modifies a variable (e.g., 'count++'), update the variable state.
       - Assume standard C# syntax. 
    5. **'delay' Nodes**: Log a message like "Waiting for X ms..." but continue execution.
    6. **'decision' Nodes**: logical evaluation based on variable values (e.g., "{count} > 5").
       - Substitute {variables} before evaluation.
       - If condition is true, follow 'Yes'/'true' edge.
       - If false, follow 'No'/'false' edge.
    7. **Concurrent Branching / Parallel Execution**: 
       - If a non-decision, non-loop node has multiple outgoing edges, consider this a parallel fork.
       - Execute all following branches. You can interleave the logs of these branches or execute them sequentially.
    8. **'aiTask' Nodes**: Perform the generative task.
    9. **'log' Nodes**: Output the message. Replace {varName} with values.
    10. **'http' Nodes**: Simulate an HTTP request.
        - Log "Sending [METHOD] request to [URL]".
        - Substitute {variables} in URL, headers, and body.
        - Simulate a successful response (200 OK) or a failure if the URL is obviously invalid.
    11. **'db' Nodes**: Simulate a database operation.
        - Log "Executing [OPERATION] on DB: [SQL]".
        - If 'select', log simulated result rows.
        - Substitute {variables} in the SQL.
    12. **'loop' Nodes**: Simulate a While/For loop.
        - Evaluate 'loopCondition' (e.g., "{i} < 5").
        - If TRUE: Follow edge with sourceHandle='loopBody'. After the body path finishes (reaches a node pointing back or logic ends), re-evaluate condition.
        - If FALSE: Follow edge with sourceHandle='loopEnd'.
    13. **'functionCall' Nodes**:
        - Locate the function in the provided "Code Files" using 'codeFileId' and 'functionName'.
        - Map 'parameterValues' to the function arguments. Evaluate any {variables} in the values.
        - Simulate the execution of the C# function.
        - The C# function may reference other classes/functions defined in other Code Files. Assume all Code Files are in the same assembly/project.
        - If 'variableName' (Output Variable) is set, store the return value of the function into that variable in the global state.
        - Log "Calling function [Name] with params [...]".
    
    IMPORTANT: You MUST return a VALID JSON object. Do not include markdown formatting (like \`\`\`json).
    
    Output JSON Schema:
    {
      "logs": [
        { "step": number, "nodeId": "string", "nodeLabel": "string", "message": "string (in Chinese Simplified)", "status": "info" | "success" | "warning" | "error", "timestamp": "string" }
      ],
      "finalOutput": "string",
      "finalVariables": [
        { "name": "string", "value": "string", "type": "string" }
      ],
      "success": boolean
    }
  `;

  const userPrompt = `
    Graph Data:
    ${JSON.stringify(graphRepresentation, null, 2)}

    Code Files (Context):
    ${codeContext}
  `;

  try {
    const jsonString = await retryWithBackoff(() => callZhipuAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]));

    // Clean up potential markdown code blocks if the model adds them despite instructions
    const cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed: any = {};
    try {
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      console.warn("Failed to parse GLM response:", e);
      return {
        success: false,
        logs: [{
          step: 0,
          nodeId: 'system',
          nodeLabel: 'System Error',
          message: '解析 AI 响应失败 (Invalid JSON)。',
          status: 'error',
          timestamp: new Date().toISOString()
        }],
        finalOutput: undefined
      };
    }

    const validLogs: ExecutionLog[] = [];
    if (parsed.logs && Array.isArray(parsed.logs)) {
      parsed.logs.forEach((log: any, idx: number) => {
        if (log && typeof log === 'object') {
           validLogs.push({
            step: typeof log.step === 'number' ? log.step : idx + 1,
            nodeId: log.nodeId || 'unknown',
            nodeLabel: log.nodeLabel || '未知',
            message: log.message || '',
            status: ['info', 'success', 'warning', 'error'].includes(log.status) ? log.status : 'info',
            timestamp: log.timestamp || new Date().toISOString()
          });
        }
      });
    }
    
    const finalVarsRecord: Record<string, any> = {};
    if (parsed.finalVariables && Array.isArray(parsed.finalVariables)) {
      parsed.finalVariables.forEach((v: any) => {
        if (v && v.name) {
          finalVarsRecord[v.name] = v.value;
        }
      });
    }
    
    return {
      success: parsed.success ?? false,
      logs: validLogs,
      finalOutput: parsed.finalOutput,
      finalVariables: finalVarsRecord
    };

  } catch (error) {
    console.error("GLM Execution Error:", error);
    const isQuota = (error instanceof Error) && error.message.includes('429');
    return {
      success: false,
      logs: [{
        step: 0,
        nodeId: 'system',
        nodeLabel: 'System Error',
        message: isQuota 
          ? 'API 配额已耗尽，请稍后再试 (Error 429)'
          : `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
        status: 'error',
        timestamp: new Date().toISOString()
      }]
    };
  }
};

/**
 * AI Copilot: Generate flow structure from natural language
 */
export const generateFlowFromDescription = async (
  description: string, 
  currentNodes: AppNode[], 
  appendTargetId?: string,
  language: 'zh' | 'en' = 'zh'
): Promise<GeneratedFlowData> => {
  
  const systemPrompt = `
    You are an expert flowchart architect for a visual programming system.
    Your goal is to convert user requests into **EXECUTABLE** flowcharts using **SPECIFIC** tools.

    **STRICT NODE SELECTION RULES (YOU MUST FOLLOW THESE):**
    
    1. **'decision'**: 
       - USE FOR: Any logic check, if/else, validation, comparison (e.g., "Is count > 10?", "Check if user exists").
       - REQUIREMENT: Must contain a condition (e.g. "{x} > 5") in the description.
    
    2. **'loop'**:
       - USE FOR: Iteration, while loops, repeating actions.
       - REQUIREMENT: Must have a 'loopCondition'.
    
    3. **'http'**:
       - USE FOR: API calls, fetching data, webhooks, REST interactions.
       - DO NOT use 'process' or 'aiTask' for API calls. Use 'http'.
    
    4. **'db'**:
       - USE FOR: Database queries, SQL, saving data, reading records.
       - DO NOT use 'process' or 'aiTask' for DB operations. Use 'db'.
    
    5. **'log'**:
       - USE FOR: Printing output, debugging, showing messages to the user.
    
    6. **'delay'**:
       - USE FOR: Pausing execution, waiting.
    
    7. **'functionCall'**:
       - USE FOR: Complex calculations or business logic that requires code.
    
    8. **'aiTask'**:
       - USE ONLY IF: The user explicitly asks for "AI generation", "summarization", "LLM", or "creative writing".
       - DO NOT use it for general logic or data processing.
    
    9. **'process'**:
       - USE FOR: Generic steps that don't fit above (rarely used if strict mapping is followed).

    **CRITICAL CONSTRAINTS:**
    - **Executable**: The flow must be valid. 
    - **Decision Edges**: A 'decision' node MUST have outgoing edges labeled for 'true' and 'false' paths (use sourceHandle: 'true' / 'false').
    - **Loop Edges**: A 'loop' node MUST have 'loopBody' and 'loopEnd' edges.
    - **Variables**: If the user implies data storage, define a variable.

    Output Language: **${language === 'zh' ? 'Chinese (Simplified)' : 'English'}**.
    
    Return JSON ONLY with 'nodes', 'edges', and 'variables'. Do not include markdown formatting.
  `;

  const userPrompt = `
    User Request: "${description}"
    Task: ${appendTargetId ? `Create a sequence of nodes to APPEND after the node with ID "${appendTargetId}".` : 'Create a complete new flowchart based on the description.'}
    Context: Existing Nodes: ${currentNodes.length}, Mode: ${appendTargetId ? 'Append Mode' : 'New Flow Mode'}
    
    Output Schema:
    {
      "nodes": [ { "id": "string", "type": "string", "label": "string", "description": "string", "code": "string", "duration": number, "url": "string", "method": "string", "dbOperation": "string", "sql": "string", "loopCondition": "string" } ],
      "edges": [ { "source": "string", "target": "string", "label": "string", "sourceHandle": "string" } ],
      "variables": [ { "name": "string", "type": "string", "value": "string" } ]
    }
  `;

  try {
    const jsonString = await retryWithBackoff(() => callZhipuAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]));

    const cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    // Post-process to ensure IDs and types match AppNode structure
    const newNodes: AppNode[] = (parsed.nodes || []).map((n: any) => ({
      id: n.id,
      type: n.type as NodeType,
      position: { x: 0, y: 0 }, // Position will be calculated by layout engine later
      data: {
        label: n.label,
        description: n.description,
        code: n.code,
        duration: n.duration,
        url: n.url,
        method: n.method,
        dbOperation: n.dbOperation,
        sql: n.sql,
        loopCondition: n.loopCondition
      }
    }));

    const newEdges: Edge[] = (parsed.edges || []).map((e: any) => ({
      id: `e-${e.source}-${e.target}-${Math.random().toString(36).substr(2, 5)}`,
      source: e.source,
      target: e.target,
      label: e.label,
      sourceHandle: e.sourceHandle
    }));

    const newVars: Variable[] = (parsed.variables || []).map((v: any) => ({
      id: `v-${Math.random().toString(36).substr(2, 9)}`,
      name: v.name,
      type: v.type,
      value: v.value || ''
    }));

    return {
      nodes: newNodes,
      edges: newEdges,
      variables: newVars
    };

  } catch (e) {
    console.error("AI Copilot Error:", e);
    return { nodes: [], edges: [], variables: [] };
  }
};

/**
 * AI Code Assistant: Generate C# code snippets
 */
export const generateCodeFromDescription = async (
  description: string, 
  existingCode: string,
  language: 'zh' | 'en' = 'zh'
): Promise<string> => {
  const systemPrompt = `
    You are an expert C# developer assistant.
    Your task is to generate or modify C# code based on the user's request.
    
    Context:
    - You are editing a specific C# file inside a namespace and class.
    - Ensure the generated code is syntactically correct C#.
    
    Output:
    - Return ONLY the C# code (or the snippet to insert).
    - If the user asks for a new function, generate the full method signature and body.
    - Do NOT include markdown blocks like \`\`\`csharp. Just the code.
    - Comments should be in **${language === 'zh' ? 'Chinese (Simplified)' : 'English'}**.
  `;

  const userPrompt = `
    Current Code Context:
    ${existingCode}

    User Request: "${description}"
    
    Please provide the code snippet to be inserted at the cursor position. If it is a new method, provide the full method. If it's logic inside a method, provide the statements.
  `;

  try {
    const code = await retryWithBackoff(() => callZhipuAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]));

    return code.replace(/```csharp/g, '').replace(/```/g, '').trim();
  } catch (e) {
    console.error("AI Code Gen Error:", e);
    return "// Error generating code. Please try again.";
  }
};
