import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StructuredTool } from "@langchain/core/tools";
import { Client } from "langsmith";
import { ConsoleCallbackHandler } from "langchain/callbacks";
import { z } from "zod";

// Add type declarations for environment
declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Configure LangSmith
const langsmithClient = new Client({
  apiUrl: "https://api.smith.langchain.com",
  apiKey: Deno.env.get('LANGCHAIN_API_KEY'),
});

// Configure tracing globally
globalThis.process = {
  env: {
    LANGCHAIN_TRACING_V2: "true",
    LANGCHAIN_API_KEY: Deno.env.get('LANGCHAIN_API_KEY'),
    LANGCHAIN_PROJECT: "crm2",
    LANGCHAIN_ENDPOINT: "https://api.smith.langchain.com",
  },
} as any;

// Create tracer
const tracer = new Client();

// Define tools
class UpdateTicketStatusTool extends StructuredTool {
  name = "updateTicketStatus";
  description = "Updates the status of a ticket. Valid statuses are: open, in_progress, resolved, closed";
  schema = z.object({
    ticketId: z.string(),
    status: z.enum(['open', 'in_progress', 'resolved', 'closed'])
  });

  constructor(private supabaseClient: any) {
    super();
  }

  async _call(args: { ticketId: string; status: string }) {
    const { error } = await this.supabaseClient
      .from('tickets')
      .update({ status: args.status })
      .eq('id', args.ticketId);
    
    if (error) throw error;
    return `Successfully updated ticket ${args.ticketId} status to ${args.status}`;
  }
}

class UpdateTicketPriorityTool extends StructuredTool {
  name = "updateTicketPriority";
  description = "Updates the priority of a ticket. Valid priorities are: low, medium, high, urgent";
  schema = z.object({
    ticketId: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'urgent'])
  });

  constructor(private supabaseClient: any) {
    super();
  }

  async _call(args: { ticketId: string; priority: string }) {
    const { error } = await this.supabaseClient
      .from('tickets')
      .update({ priority: args.priority })
      .eq('id', args.ticketId);
    
    if (error) throw error;
    return `Successfully updated ticket ${args.ticketId} priority to ${args.priority}`;
  }
}

class AddTicketTagsTool extends StructuredTool {
  name = "addTicketTags";
  description = "Adds tags to a ticket";
  schema = z.object({
    ticketId: z.string(),
    tags: z.array(z.string())
  });

  constructor(private supabaseClient: any) {
    super();
  }

  async _call(args: { ticketId: string; tags: string[] }) {
    const { data: availableTags } = await this.supabaseClient
      .from('tags')
      .select('*');

    for (const tagName of args.tags) {
      const tag = availableTags?.find(t => t.name.toLowerCase() === tagName.toLowerCase());
      if (tag) {
        await this.supabaseClient
          .from('ticket_tags')
          .upsert({
            ticket_id: args.ticketId,
            tag_id: tag.id,
          });
      }
    }
    return `Successfully added tags to ticket ${args.ticketId}`;
  }
}

class AddInternalNoteTool extends StructuredTool {
  name = "addInternalNote";
  description = "Adds an internal note to a ticket";
  schema = z.object({
    ticketId: z.string(),
    userId: z.string(),
    note: z.string()
  });

  constructor(private supabaseClient: any) {
    super();
  }

  async _call(args: { ticketId: string; userId: string; note: string }) {
    const { error } = await this.supabaseClient
      .from('ticket_messages')
      .insert({
        ticket_id: args.ticketId,
        user_id: args.userId,
        message: args.note,
        is_internal: true,
        is_system: true,
      });
    
    if (error) throw error;
    return `Successfully added internal note to ticket ${args.ticketId}`;
  }
}

class GetTicketDetailsTool extends StructuredTool {
  name = "getTicketDetails";
  description = "Gets detailed information about a ticket including its history";
  schema = z.object({
    ticketId: z.string()
  });

  constructor(private supabaseClient: any) {
    super();
  }

  async _call(args: { ticketId: string }) {
    const { data, error } = await this.supabaseClient
      .from('tickets')
      .select(`
        *,
        customer:profiles!tickets_customer_id_fkey(id, full_name),
        ticket_messages(*)
      `)
      .eq('id', args.ticketId)
      .single();
    
    if (error) throw error;
    return JSON.stringify(data);
  }
}

class SendResponseTool extends StructuredTool {
  name = "sendResponse";
  description = "Sends a response message to the customer";
  schema = z.object({
    ticketId: z.string(),
    message: z.string()
  });

  constructor(private supabaseClient: any) {
    super();
  }

  async _call(args: { ticketId: string; message: string }) {
    const { error } = await this.supabaseClient
      .from('ticket_messages')
      .insert({
        ticket_id: args.ticketId,
        message: args.message,
        is_internal: false,
        is_system: true
      });
    
    if (error) throw error;
    return `Successfully sent response to ticket ${args.ticketId}`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { ticketId, instruction, userRole, userId } = await req.json();

    // Verify user role
    if (userRole === 'customer') {
      throw new Error('Unauthorized: Only admin and support roles can use the AI agent');
    }

    // Create tools
    const tools = [
      new GetTicketDetailsTool(supabaseClient),
      new UpdateTicketStatusTool(supabaseClient),
      new UpdateTicketPriorityTool(supabaseClient),
      new AddTicketTagsTool(supabaseClient),
      new AddInternalNoteTool(supabaseClient),
      new SendResponseTool(supabaseClient)
    ];

    // Create chat model
    const model = new ChatOpenAI({
      modelName: "gpt-4",
      temperature: 0,
      openAIApiKey: Deno.env.get('OPENAI_API_KEY'),
    });

    // Create prompt
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `You are a helpful AI assistant for managing support tickets. Your capabilities:
1. Get ticket details and history
2. Update ticket status (open, in_progress, resolved, closed)
3. Update ticket priority (low, medium, high, urgent)
4. Add tags to tickets
5. Add internal notes
6. Send responses to customers

Important rules:
- Always check ticket details before taking any action
- When resolving tickets:
  1. Review the ticket history
  2. Update the status appropriately
  3. Add a closing note if needed
  4. Notify the customer
- Provide clear error messages when operations fail
- Format responses in a clear, readable way
- Never make assumptions about ticket status - always check
- When suggesting responses, maintain a professional and empathetic tone

Remember to handle errors gracefully and provide clear feedback to the user.`],
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    // Create agent
    const agent = await createOpenAIFunctionsAgent({
      llm: model,
      tools,
      prompt,
    });

    // Create executor with tracing
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: true,
      callbacks: [
        new ConsoleCallbackHandler(),
        {
          handleToolStart: async (tool: any, input: string) => {
            console.log(`Starting tool ${tool.name} with input:`, input);
          },
          handleToolEnd: async (output: string) => {
            console.log('Tool output:', output);
          },
          handleAgentAction: async (action: any) => {
            console.log('Agent action:', action);
          }
        }
      ],
      tags: ["ticket-agent"],
      metadata: {
        ticketId,
        userRole,
        userId,
      },
    });

    // Execute agent with tracing
    const result = await agentExecutor.invoke(
      {
        input: instruction,
        ticketId,
        userId,
      },
      {
        callbacks: [
          {
            handleChainStart: async (chain: any, inputs: any) => {
              console.log('Chain started:', chain.name, inputs);
            },
            handleChainEnd: async (outputs: any) => {
              console.log('Chain ended:', outputs);
            },
            handleLLMStart: async (llm: any, prompts: string[]) => {
              console.log('LLM started with prompts:', prompts);
            },
            handleLLMEnd: async (output: any) => {
              console.log('LLM output:', output);
            }
          }
        ],
        runName: `Ticket ${ticketId} - ${instruction}`,
        metadata: {
          ticketId,
          userRole,
          userId,
          instruction
        },
        tags: ["ticket-agent"]
      }
    );

    // Verify tool execution
    let actionTaken = false;
    if (result.intermediateSteps) {
      for (const step of result.intermediateSteps) {
        if (step.action && step.action.tool) {
          actionTaken = true;
          break;
        }
      }
    }

    // If no action was taken, inform the user
    if (!actionTaken) {
      return new Response(
        JSON.stringify({ 
          message: "I understood your request but wasn't able to take any action. Please try rephrasing your instruction.",
          success: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        message: result.output,
        success: true,
        actions: result.intermediateSteps?.map(step => ({
          tool: step.action?.tool,
          input: step.action?.toolInput,
          output: step.observation
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
}); 