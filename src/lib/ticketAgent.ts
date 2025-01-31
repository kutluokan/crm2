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
    OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY,
  },
} as any;

// Create tracer with environment variables
const tracer = new LangChainTracer();

class GetAllTicketsTool extends StructuredTool {
  name = "getAllTickets";
  description = "Retrieves a list of all tickets regardless of their status. Returns an empty array if no tickets are found.";
  schema = z.object({});

  async _call() {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey(id, full_name),
          tags:ticket_tags(tag:tags(id, name, color))
        `);
      
      if (error) throw error;
      
      const tickets = data || [];
      if (tickets.length === 0) {
        return "No tickets found.";
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
      console.error('Error fetching tickets:', error);
      throw new Error('Failed to fetch tickets');
    }
  }
}

class UpdateTicketStatusTool extends StructuredTool {
  name = "updateTicketStatus";
  description = "Updates the status of a specific ticket. Can change any ticket to any status (open, in_progress, resolved, closed) regardless of its current status. For example, resolved or closed tickets can be reopened. Requires ticket ID and new status. Returns error if ticket not found.";
  schema = z.object({
    ticketId: z.string().describe("The unique identifier of the ticket to update"),
    status: z.enum(['open', 'in_progress', 'resolved', 'closed']).describe("The new status to set - can be changed to any status regardless of current status")
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
        tags: data.tags?.map((t: { tag: { name: string } }) => t.tag.name) || [],
        messages: data.ticket_messages?.length || 0
      });
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      throw error;
    }
  }
}

class DeleteTicketTool extends StructuredTool {
  name = "deleteTicket";
  description = "Permanently deletes a ticket. Requires ticket ID. This action cannot be undone. Returns error if ticket not found.";
  schema = z.object({
    ticketId: z.string().describe("The unique identifier of the ticket to delete")
  });

  async _call({ ticketId }: z.infer<typeof this.schema>) {
    try {
      // First check if ticket exists
      const { data: ticket, error: checkError } = await supabase
        .from('tickets')
        .select('id, title')
        .eq('id', ticketId)
        .single();

      if (checkError || !ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticketId);
      
      if (error) throw error;
      return `Successfully deleted ticket ${ticketId}: ${ticket.title}`;
    } catch (error) {
      console.error('Error deleting ticket:', error);
      throw error;
    }
  }
}

class SuggestResponseTool extends StructuredTool {
  name = "suggestResponse";
  description = "Suggests an appropriate response for a ticket based on its content and history. Requires ticket ID.";
  schema = z.object({
    ticketId: z.string().describe("The unique identifier of the ticket to suggest a response for")
  });

  async _call({ ticketId }: z.infer<typeof this.schema>) {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey(id, full_name),
          ticket_messages(*)
        `)
        .eq('id', ticketId)
        .single();
      
      if (error || !data) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      // Analyze ticket content and suggest appropriate response
      const context = {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        customer: data.customer?.full_name,
        messages: data.ticket_messages
      };

      const model = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
      });

      const response = await model.invoke([
        ["system", `You are a helpful customer support agent. Based on the ticket information provided, suggest a professional and empathetic response. Consider:
        - The ticket's priority and status
        - Previous message history
        - Customer's specific concerns
        - Appropriate tone and formality
        Use clear, concise language and maintain a professional yet friendly tone.`],
        ["human", `Please suggest a response for this ticket:
        Title: ${context.title}
        Description: ${context.description}
        Status: ${context.status}
        Priority: ${context.priority}
        Customer: ${context.customer}
        Message History: ${JSON.stringify(context.messages)}`]
      ]);

      return JSON.stringify({
        suggestedResponse: response.content,
        context: {
          ticketId,
          title: data.title,
          customer: data.customer?.full_name
        }
      });
    } catch (error) {
      console.error('Error suggesting response:', error);
      throw error;
    }
  }
}

class SendResponseTool extends StructuredTool {
  name = "sendResponse";
  description = "Sends a response message to a ticket. Requires ticket ID and message content.";
  schema = z.object({
    ticketId: z.string().describe("The unique identifier of the ticket to respond to"),
    message: z.string().describe("The message content to send")
  });

  async _call({ ticketId, message }: z.infer<typeof this.schema>) {
    try {
      // First check if ticket exists
      const { data: ticket, error: checkError } = await supabase
        .from('tickets')
        .select('id, customer_id')
        .eq('id', ticketId)
        .single();

      if (checkError || !ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      // Get Sarah Support's ID
      const { data: supportUser, error: supportUserError } = await supabase
        .from('profiles')
        .select('id')
        .eq('full_name', 'Sarah Support')
        .single();

      if (supportUserError || !supportUser) {
        throw new Error('Support user not found');
      }

      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          message: message,
          user_id: supportUser.id,
          is_internal: false
        });
      
      if (error) throw error;
      return `Successfully sent response to ticket ${ticketId}`;
    } catch (error) {
      console.error('Error sending response:', error);
      throw error;
    }
  }
}

// Define ticket management tools
const tools = [
  new GetAllTicketsTool(),
  new UpdateTicketStatusTool(),
  new UpdateTicketPriorityTool(),
  new GetTicketDetailsTool(),
  new DeleteTicketTool(),
  new SuggestResponseTool(),
  new SendResponseTool(),
];

// Initialize the agent
const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
  openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export async function createTicketAgent(userRole: 'admin' | 'support') {
  const systemMessage = `You are a helpful AI assistant for managing support tickets. Your capabilities:
1. View all tickets and their details (regardless of status)
2. Update ticket status (open, in_progress, resolved, closed) - you can change any ticket to any status, including reopening resolved/closed tickets
3. Update ticket priority (low, medium, high, urgent)
4. Get detailed information about specific tickets
5. Delete tickets when they are no longer needed
6. Suggest appropriate responses based on ticket context
7. Send responses to customers

Important rules:
- Always check if tickets exist before performing any action
- You can change a ticket's status to any state regardless of its current status (e.g., reopening resolved tickets)
- Provide clear error messages when operations fail
- When listing tickets, always specify the count
- Format responses in a clear, readable way
- If no tickets are found, explicitly state that
- Never make assumptions about ticket status - always check
- Be careful with delete operations - they cannot be undone
- When suggesting responses, maintain a professional and empathetic tone
- Before sending a response, make sure it addresses the customer's concerns
- Your role is ${userRole}, act accordingly with appropriate permissions

Remember to handle errors gracefully and provide clear feedback to the user.`;

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemMessage],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

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