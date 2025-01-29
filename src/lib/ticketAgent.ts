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

      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          content: message,
          sender_type: 'agent',
          sender_id: 'ai_assistant'
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
  openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
});

export async function createTicketAgent(userRole: 'admin' | 'support') {
  const systemMessage = `You are a helpful AI assistant for managing support tickets.`;

  return {
    async processQuery(query: string) {
      try {
        const { data, error } = await supabase.functions.invoke('ticket-agent', {
          body: { query }
        });

        if (error) throw error;
        return data.result;
      } catch (error) {
        console.error('Error processing query:', error);
        throw error;
      }
    }
  };
} 