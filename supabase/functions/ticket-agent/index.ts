import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { OpenAI } from 'https://esm.sh/openai@4.20.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface TicketAction {
  type: 'status' | 'priority' | 'tags' | 'summary' | 'close' | 'post_note';
  value?: string;
  tags?: string[];
  note?: string;
}

async function searchRelevantDocuments(query: string, openai: OpenAI, supabaseClient: any) {
  try {
    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Search for similar documents
    const { data: documents, error: searchError } = await supabaseClient.rpc(
      'match_documents',
      {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5
      }
    );

    if (searchError) {
      console.error('Error searching documents:', searchError);
      return null;
    }

    return documents;
  } catch (error) {
    console.error('Error in searchRelevantDocuments:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain',
        'Content-Length': '0',
      }
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    })

    const { ticketId, instruction, userRole, userId } = await req.json()

    // Verify user role
    if (userRole === 'customer') {
      throw new Error('Unauthorized: Only admin and support roles can use the AI agent')
    }

    let ticket = null;
    let messages = [];
    let formattedMessages = [];

    // Only fetch ticket data if not in general mode
    if (ticketId !== 'general') {
      // Get current ticket data
      const { data: ticketData, error: ticketError } = await supabaseClient
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey(id, full_name),
          tags:ticket_tags(
            tag:tags(id, name, color)
          )
        `)
        .eq('id', ticketId)
        .single()

      if (ticketError) throw ticketError
      ticket = ticketData;

      // Get ticket messages
      const { data: messageData, error: messagesError } = await supabaseClient
        .from('ticket_messages')
        .select(`
          *,
          user:profiles!ticket_messages_user_id_fkey(full_name)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })

      if (messagesError) throw messagesError
      messages = messageData;

      // Format messages for better context
      formattedMessages = messages.map(msg => ({
        ...msg,
        from: msg.user?.full_name || 'System',
        type: msg.is_internal ? 'internal' : 'customer',
      }))
    }

    // Search for relevant documents
    const relevantDocs = ticketId !== 'general' ? 
      await searchRelevantDocuments(instruction, openai, supabaseClient) : 
      [];
    
    // Get any uploaded files related to this ticket
    const ticketFiles = ticketId !== 'general' ? 
      (await supabaseClient
        .from('documents')
        .select('content, filename, metadata')
        .eq('ticket_id', ticketId))?.data || [] : 
      [];

    // Combine relevant documents and files
    const allContext = [
      ...(relevantDocs || []).map(doc => doc.content),
      ...(ticketFiles || []).map(file => `File ${file.filename}:\n${file.content}`)
    ];

    // Parse instruction using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: ticketId === 'general' ? `
You are a helpful AI assistant for managing support tickets. Your capabilities:
1. View all tickets and their details
2. Update ticket status (open, in_progress, resolved, closed)
3. Update ticket priority (low, medium, high, urgent)
4. Get detailed information about specific tickets
5. Delete tickets when they are no longer needed
6. Suggest appropriate responses
7. Send responses to customers

Important rules:
- Always check if tickets exist before performing any action
- Provide clear error messages when operations fail
- When listing tickets, always specify the count
- Format responses in a clear, readable way
- If no tickets are found, explicitly state that
- Never make assumptions about ticket status - always check
- Be careful with delete operations - they cannot be undone
- When suggesting responses, maintain a professional and empathetic tone
- Before sending a response, make sure it addresses the customer's concerns

Remember to handle errors gracefully and provide clear feedback to the user.

IMPORTANT: You must respond with ONLY a valid JSON object, with no additional text or explanation. The response must be parseable by JSON.parse().

Required JSON format:
{
  "actions": [],
  "message": "A clear message explaining what actions were taken or providing information"
}` : `
IMPORTANT: You must respond with ONLY a valid JSON object, with no additional text or explanation. The response must be parseable by JSON.parse().

Required JSON format:
{
  "actions": [
    {
      "type": "status",
      "value": "in_progress"
    }
  ],
  "message": "A clear message explaining what actions were taken"
}

Available actions and their formats:
1. Update status:
   { "type": "status", "value": "open" | "in_progress" | "resolved" | "closed" }

2. Update priority:
   { "type": "priority", "value": "low" | "medium" | "high" | "urgent" }

3. Add tags:
   { "type": "tags", "tags": ["tag1", "tag2"] }

4. Generate summary:
   { "type": "summary" }
   When generating a summary:
   - Analyze the conversation history
   - Create a concise summary of:
     * Main issue/request
     * Key points discussed
     * Current status/progress
     * Any pending actions
   - Add as an internal note

5. Close ticket:
   { "type": "close" }

6. Post internal note:
   { "type": "post_note", "note": "Your note text here" }

When asked to summarize or provide a summary:
1. Always use the "summary" action type
2. The summary will be automatically added as an internal note
3. Include a clear message explaining that you've generated the summary

Current ticket state:
${JSON.stringify(ticket, null, 2)}

Ticket conversation:
${JSON.stringify(formattedMessages, null, 2)}

Relevant context from knowledge base and files:
${allContext.join('\n\n')}`
        },
        {
          role: 'user',
          content: instruction,
        },
      ],
      temperature: 0
    })

    let response;
    try {
      const content = completion.choices[0].message.content.trim();
      response = JSON.parse(content);
      
      // Validate response format
      if (!response.actions || !Array.isArray(response.actions) || !response.message) {
        throw new Error('Invalid response format: missing required fields');
      }

      // Skip action validation in general mode
      if (ticketId !== 'general') {
        // Validate each action
        for (const action of response.actions) {
          if (!action.type) {
            throw new Error('Invalid action: missing type');
          }
          
          switch (action.type) {
            case 'status':
              if (!['open', 'in_progress', 'resolved', 'closed'].includes(action.value)) {
                throw new Error(`Invalid status value: ${action.value}`);
              }
              break;
            case 'priority':
              if (!['low', 'medium', 'high', 'urgent'].includes(action.value)) {
                throw new Error(`Invalid priority value: ${action.value}`);
              }
              break;
            case 'tags':
              if (!Array.isArray(action.tags)) {
                throw new Error('Invalid tags: must be an array');
              }
              break;
            case 'post_note':
              if (!action.note || typeof action.note !== 'string') {
                throw new Error('Invalid note: missing or invalid format');
              }
              break;
          }
        }
      }
    } catch (error) {
      console.error('AI response parsing error:', error);
      console.error('Raw response:', completion.choices[0].message.content);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }

    // Only execute actions if not in general mode
    if (ticketId !== 'general') {
      // Execute actions
      for (const action of response.actions) {
        switch (action.type) {
          case 'status':
            await supabaseClient
              .from('tickets')
              .update({ status: action.value })
              .eq('id', ticketId)
            break

          case 'priority':
            await supabaseClient
              .from('tickets')
              .update({ priority: action.value })
              .eq('id', ticketId)
            break

          case 'tags':
            if (action.tags) {
              // First get all available tags
              const { data: availableTags } = await supabaseClient
                .from('tags')
                .select('*')

              // Add new tags
              for (const tagName of action.tags) {
                const tag = availableTags?.find(t => t.name.toLowerCase() === tagName.toLowerCase())
                if (tag) {
                  await supabaseClient
                    .from('ticket_tags')
                    .upsert({
                      ticket_id: ticketId,
                      tag_id: tag.id,
                    })
                }
              }
            }
            break

          case 'summary':
            // Generate summary using OpenAI
            const summaryCompletion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `Create a concise summary of this ticket conversation. Focus on:
- Main issue/request
- Key points discussed
- Current status/progress
- Any pending actions or next steps
Be clear and professional.`
                },
                {
                  role: 'user',
                  content: `Ticket state: ${JSON.stringify(ticket, null, 2)}\n\nConversation: ${JSON.stringify(formattedMessages, null, 2)}`
                }
              ],
              temperature: 0.7,
            });

            const summary = summaryCompletion.choices[0].message.content;

            // Add the summary as an internal note
            const { error: summaryError } = await supabaseClient
              .from('ticket_messages')
              .insert({
                ticket_id: ticketId,
                user_id: userId,
                message: summary,
                is_internal: true,
                is_system: true,
              });
            
            if (summaryError) throw summaryError;

            // Update the ticket's AI summary field
            const { error: updateError } = await supabaseClient
              .from('tickets')
              .update({ ai_summary: summary })
              .eq('id', ticketId);
            
            if (updateError) throw updateError;
            break

          case 'close':
            await supabaseClient
              .from('tickets')
              .update({ status: 'closed' })
              .eq('id', ticketId)
            break

          case 'post_note':
            if (action.note) {
              const { error: noteError } = await supabaseClient
                .from('ticket_messages')
                .insert({
                  ticket_id: ticketId,
                  user_id: userId,
                  message: action.note,
                  is_internal: true,
                  is_system: true,
                })
              
              if (noteError) throw noteError
            }
            break
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: response.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
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
      },
    )
  }
}) 