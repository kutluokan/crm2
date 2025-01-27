import { ChatOpenAI } from "langchain/chat_models/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { supabase } from './supabase';
import { StructuredTool } from "@langchain/core/tools";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { z } from "zod";
import { ConsoleCallbackHandler } from "langchain/callbacks";
import { LangChainTracer } from "langchain/callbacks";

// Configure tracing globally
globalThis.process = {
  env: {
    LANGCHAIN_TRACING_V2: "true",
    LANGCHAIN_API_KEY: import.meta.env.VITE_LANGCHAIN_API_KEY,
    LANGCHAIN_PROJECT: import.meta.env.VITE_LANGCHAIN_PROJECT,
  },
} as any;

// Create tracer with environment variables
const tracer = new LangChainTracer();

interface TicketUpdateParams {
  ticketId: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

class GetOpenTicketsTool extends StructuredTool {
  name = "getOpenTickets";
  description = "Retrieves a list of all tickets with status 'open'. Use this to check currently open tickets. Returns an empty array if no tickets are open.";
  schema = z.object({});

  async _call() {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey(id, full_name),
          tags:ticket_tags(tag:tags(id, name, color))
        `)
        .eq('status', 'open');
      
      if (error) throw error;
      
      const tickets = data || [];
      if (tickets.length === 0) {
        return "No open tickets found.";
      }

      return JSON.stringify({
        count: tickets.length,
        tickets: tickets.map(ticket => ({
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          customer: ticket.customer?.full_name || 'Unknown',
        }))
      });
    } catch (error) {
      console.error('Error fetching open tickets:', error);
      throw new Error('Failed to fetch open tickets');
    }
  }
}

class UpdateTicketStatusTool extends StructuredTool {
  name = "updateTicketStatus";
  description = "Updates the status of a specific ticket. Requires ticket ID and new status. Verify the ticket exists before updating. Returns error if ticket not found.";
  schema = z.object({
    ticketId: z.string().describe("The unique identifier of the ticket to update"),
    status: z.enum(['open', 'in_progress', 'resolved', 'closed']).describe("The new status to set")
  });

  async _call({ ticketId, status }: z.infer<typeof this.schema>) {
    try {
      // First check if ticket exists
      const { data: ticket, error: checkError } = await supabase
        .from('tickets')
        .select('id, status')
        .eq('id', ticketId)
        .single();

      if (checkError || !ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      const { error } = await supabase
        .from('tickets')
        .update({ status })
        .eq('id', ticketId);
      
      if (error) throw error;
      return `Successfully updated ticket ${ticketId} status from ${ticket.status} to ${status}`;
    } catch (error) {
      console.error('Error updating ticket status:', error);
      throw error;
    }
  }
}

class UpdateTicketPriorityTool extends StructuredTool {
  name = "updateTicketPriority";
  description = "Updates the priority of a specific ticket. Requires ticket ID and new priority. Verify the ticket exists before updating. Returns error if ticket not found.";
  schema = z.object({
    ticketId: z.string().describe("The unique identifier of the ticket to update"),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).describe("The new priority level to set")
  });

  async _call({ ticketId, priority }: z.infer<typeof this.schema>) {
    try {
      // First check if ticket exists
      const { data: ticket, error: checkError } = await supabase
        .from('tickets')
        .select('id, priority')
        .eq('id', ticketId)
        .single();

      if (checkError || !ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      const { error } = await supabase
        .from('tickets')
        .update({ priority })
        .eq('id', ticketId);
      
      if (error) throw error;
      return `Successfully updated ticket ${ticketId} priority from ${ticket.priority} to ${priority}`;
    } catch (error) {
      console.error('Error updating ticket priority:', error);
      throw error;
    }
  }
}

class GetTicketDetailsTool extends StructuredTool {
  name = "getTicketDetails";
  description = "Retrieves detailed information about a specific ticket. Requires ticket ID. Returns error if ticket not found.";
  schema = z.object({
    ticketId: z.string().describe("The unique identifier of the ticket to retrieve")
  });

  async _call({ ticketId }: z.infer<typeof this.schema>) {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey(id, full_name),
          tags:ticket_tags(tag:tags(id, name, color)),
          ticket_messages(*)
        `)
        .eq('id', ticketId)
        .single();
      
      if (error) throw error;
      if (!data) throw new Error(`Ticket ${ticketId} not found`);

      return JSON.stringify({
        id: data.id,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        customer: data.customer?.full_name || 'Unknown',
        created_at: data.created_at,
        tags: data.tags?.map(t => t.tag.name) || [],
        messages: data.ticket_messages?.length || 0
      });
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      throw error;
    }
  }
}

// Define ticket management tools
const tools = [
  new GetOpenTicketsTool(),
  new UpdateTicketStatusTool(),
  new UpdateTicketPriorityTool(),
  new GetTicketDetailsTool(),
];

// Initialize the agent
const model = new ChatOpenAI({
  modelName: 'gpt-4-turbo-preview',
  temperature: 0,
  openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
});

// Create the prompt template
const prompt = ChatPromptTemplate.fromMessages([
  ["system", `You are a helpful AI assistant for managing support tickets. Your capabilities:
1. View open tickets and their details
2. Update ticket status (open, in_progress, resolved, closed)
3. Update ticket priority (low, medium, high, urgent)
4. Get detailed information about specific tickets

Important rules:
- Always check if tickets exist before trying to update them
- Provide clear error messages when operations fail
- When listing tickets, always specify the count
- Format responses in a clear, readable way
- If no tickets are found, explicitly state that
- Never make assumptions about ticket status - always check

Remember to handle errors gracefully and provide clear feedback to the user.`],
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

export async function createTicketAgent() {
  const agent = await createOpenAIFunctionsAgent({
    llm: model,
    tools: tools,
    prompt: prompt,
  });

  const executor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
    tags: ["ticket_management"],
    metadata: {
      agentType: "ticket_management",
      projectName: "crm2",
    },
    callbacks: [
      new ConsoleCallbackHandler(),
      tracer,
    ],
  });

  return {
    async processQuery(query: string) {
      try {
        const result = await executor.invoke({ 
          input: query,
          tags: ["ticket_query"],
          metadata: {
            queryType: "ticket_management",
            timestamp: new Date().toISOString(),
          },
          runName: "Ticket Management Query",
        });

        // Try to parse and format the response if it's JSON
        try {
          const parsed = JSON.parse(result.output);
          if (parsed.tickets) {
            return `Found ${parsed.count} open ticket(s):\n${parsed.tickets.map((t: any) => 
              `- Ticket #${t.id}: ${t.title} (${t.status}, ${t.priority}) - Customer: ${t.customer}`
            ).join('\n')}`;
          }
          return `Ticket Details:\n${Object.entries(parsed).map(([k, v]) => 
            `${k}: ${Array.isArray(v) ? v.join(', ') : v}`
          ).join('\n')}`;
        } catch {
          return result.output;
        }
      } catch (error) {
        console.error('Error processing query:', error);
        throw error;
      }
    }
  };
} 