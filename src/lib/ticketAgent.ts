import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { Client } from "langsmith";
import { supabase } from './supabase';
import { StructuredTool } from "@langchain/core/tools";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { z } from "zod";

interface TicketUpdateParams {
  ticketId: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

// Initialize LangSmith client
const client = new Client({
  apiKey: import.meta.env.VITE_LANGSMITH_API_KEY,
  endpoint: import.meta.env.VITE_LANGSMITH_ENDPOINT,
  projectName: import.meta.env.VITE_LANGSMITH_PROJECT,
});

class GetOpenTicketsTool extends StructuredTool {
  name = "getOpenTickets";
  description = "Get a list of open tickets";
  schema = z.object({});

  async _call() {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        customer:profiles!tickets_customer_id_fkey(id, full_name),
        tags:ticket_tags(tag:tags(id, name, color))
      `)
      .eq('status', 'open');
    
    if (error) throw error;
    return JSON.stringify(data);
  }
}

class UpdateTicketStatusTool extends StructuredTool {
  name = "updateTicketStatus";
  description = "Update the status of a ticket";
  schema = z.object({
    ticketId: z.string(),
    status: z.enum(['open', 'in_progress', 'resolved', 'closed'])
  });

  async _call({ ticketId, status }: z.infer<typeof this.schema>) {
    const { error } = await supabase
      .from('tickets')
      .update({ status })
      .eq('id', ticketId);
    
    if (error) throw error;
    return `Ticket ${ticketId} status updated to ${status}`;
  }
}

class UpdateTicketPriorityTool extends StructuredTool {
  name = "updateTicketPriority";
  description = "Update the priority of a ticket";
  schema = z.object({
    ticketId: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'urgent'])
  });

  async _call({ ticketId, priority }: z.infer<typeof this.schema>) {
    const { error } = await supabase
      .from('tickets')
      .update({ priority })
      .eq('id', ticketId);
    
    if (error) throw error;
    return `Ticket ${ticketId} priority updated to ${priority}`;
  }
}

class GetTicketDetailsTool extends StructuredTool {
  name = "getTicketDetails";
  description = "Get detailed information about a specific ticket";
  schema = z.object({
    ticketId: z.string()
  });

  async _call({ ticketId }: z.infer<typeof this.schema>) {
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
    return JSON.stringify(data);
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
  temperature: 0,
  modelName: 'gpt-4-turbo-preview',
  streaming: true,
  openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

// Create the prompt template
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful AI assistant for managing support tickets. You can view ticket details, update their status and priority, and provide information about open tickets. Always provide clear and concise responses."],
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
  });

  return {
    async processQuery(query: string) {
      try {
        const result = await executor.invoke({ input: query });
        return result.output;
      } catch (error) {
        console.error('Error processing query:', error);
        throw error;
      }
    }
  };
} 