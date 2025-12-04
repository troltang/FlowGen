import { GoogleGenAI, Type } from "@google/genai";
import { AppNode, ExecutionResult, ExecutionLog, Variable, GeneratedFlowData, NodeType } from '../types';
import { Edge } from 'reactflow';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const executeFlowWithGemini = async (nodes: AppNode[], edges: Edge[], variables: Variable[]): Promise<ExecutionResult> => {
  // Serialize the graph for the LLM
  // We filter out Group nodes from logic execution as they are visual only
  const logicNodes = nodes.filter(n => n.type !== 'group');
  
  const graphRepresentation = {
    nodes: logicNodes.map(n => ({
      id: n.id,
      type: n.type,
      label: n.data.label,
      description: n.data.description || '',
      code: n.data.code || '',
      duration: n.data.duration,
      // Include new fields
      url: n.data.url,
      method: n.data.method,
      headers: n.data.headers,
      httpBody: n.data.httpBody,
      dbOperation: n.data.dbOperation,
      connectionString: n.data.connectionString,
      sql: n.data.sql,
      loopCondition: n.data.loopCondition
    })),
    edges: edges.map(e => ({
      source: e.source,
      target: e.target,
      label: e.label || (e.sourceHandle === 'true' ? 'Yes' : e.sourceHandle === 'false' ? 'No' : e.sourceHandle === 'loopBody' ? 'Loop Body' : e.sourceHandle === 'loopEnd' ? 'Loop End' : 'Next'),
      sourceHandle: e.sourceHandle
    })),
    initialVariables: variables.reduce((acc, v) => ({ ...acc, [v.name]: v.value }), {})
  };

  const prompt = `
    You are a sophisticated flowchart execution engine with C# code simulation capabilities.
    I will provide you with a JSON representation of a flowchart and initial variable states.
    
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
        - If TRUE: Follow edge with sourceHandle='loopBody'. After the body path finishes (reaches a node pointing back or logic ends), re-evaluate condition. (Note: Since graph structure might not explicitly cycle back, just assume standard loop semantics if edge structure allows, or execute body once if linear).
        - If FALSE: Follow edge with sourceHandle='loopEnd'.
    
    Graph Data:
    ${JSON.stringify(graphRepresentation, null, 2)}
    
    Return JSON format adhering to this schema.
    - 'logs': Array of steps. 'status' must be 'info', 'success', 'warning', or 'error'.
    - 'finalOutput': Result of the last operation.
    - 'finalVariables': Array of objects { name, value, type } representing the final state of all variables.
    
    IMPORTANT: The 'message' in logs should be in Chinese (Simplified).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            logs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  step: { type: Type.INTEGER },
                  nodeId: { type: Type.STRING },
                  nodeLabel: { type: Type.STRING },
                  message: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ['info', 'success', 'warning', 'error'] },
                  timestamp: { type: Type.STRING }
                }
              }
            },
            finalOutput: { type: Type.STRING },
            finalVariables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  value: { type: Type.STRING },
                  type: { type: Type.STRING }
                }
              }
            },
            success: { type: Type.BOOLEAN }
          }
        }
      }
    });

    let jsonString = response.text || '{}';
    if (jsonString.includes('```')) {
      jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      console.warn("Failed to parse Gemini response:", e);
      return {
        success: false,
        logs: [{
          step: 0,
          nodeId: 'system',
          nodeLabel: 'System Error',
          message: '解析 AI 响应失败。',
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
    console.error("Gemini Execution Error:", error);
    return {
      success: false,
      logs: [{
        step: 0,
        nodeId: 'system',
        nodeLabel: 'System Error',
        message: `执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
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
  appendTargetId?: string
): Promise<GeneratedFlowData> => {
  
  const prompt = `
    You are an AI programming assistant for a visual flow builder.
    User Request: "${description}"
    
    Task:
    ${appendTargetId ? `Create a sequence of nodes to APPEND after the node with ID "${appendTargetId}".` : 'Create a complete new flowchart based on the description.'}
    
    **CRITICAL NODE SELECTION RULES (Follow these priority):**
    1. **PRIORITIZE VISUAL NODES**: Use the following node types whenever possible to represent logic:
       - **'decision'**: For ANY "if/else", "check", "verify", "validate" logic.
       - **'loop'**: For iterations, "while", "for each" logic.
       - **'http'**: For API calls, web requests, fetching data.
       - **'db'**: For database operations, SQL queries.
       - **'delay'**: For waiting or pausing.
       - **'log'**: For printing messages.
       - **'aiTask'**: For generative AI tasks.
       - **'process'**: For generic actions not covered above.
    
    2. **MINIMIZE 'code' NODES**: Only use 'code' nodes (C#) for complex arithmetic or string manipulation not possible with visual nodes.

    Requirements:
    1. **Nodes**: Generate a list of nodes with unique IDs.
    2. **Edges**: Generate edges to connect these nodes logically.
       - 'decision': sourceHandle 'true'/'false'.
       - 'loop': sourceHandle 'loopBody'/'loopEnd'.
    3. **Variables**: Define any new variables required.
    
    Context:
    - Existing Nodes: ${currentNodes.length}
    - Mode: ${appendTargetId ? 'Append Mode' : 'New Flow Mode'}
    
    Return JSON with 'nodes', 'edges', and 'variables'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING },
                  label: { type: Type.STRING },
                  description: { type: Type.STRING },
                  code: { type: Type.STRING },
                  duration: { type: Type.INTEGER },
                  url: { type: Type.STRING },
                  method: { type: Type.STRING },
                  dbOperation: { type: Type.STRING },
                  sql: { type: Type.STRING },
                  loopCondition: { type: Type.STRING }
                }
              }
            },
            edges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  label: { type: Type.STRING },
                  sourceHandle: { type: Type.STRING }
                }
              }
            },
            variables: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['string', 'number', 'boolean'] },
                  value: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const jsonString = response.text || '{}';
    const parsed = JSON.parse(jsonString);

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