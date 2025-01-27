import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { OpenAI } from 'https://esm.sh/openai@4.20.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TicketAction {
  type: 'status' | 'priority' | 'tags' | 'summary' | 'close' | 'post_note';
  value?: string;
  tags?: string[];
  note?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    // Get current ticket data
    const { data: ticket, error: ticketError } = await supabaseClient
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

    // Get ticket messages
    const { data: messages, error: messagesError } = await supabaseClient
      .from('ticket_messages')
      .select(`
        *,
        user:profiles!ticket_messages_user_id_fkey(full_name)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (messagesError) throw messagesError

    // Format messages for better context
    const formattedMessages = messages.map(msg => ({
      ...msg,
      from: msg.user?.full_name || 'System',
      type: msg.is_internal ? 'internal' : 'customer',
    }))

    // Parse instruction using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a ticket management AI agent. Your task is to understand user instructions and convert them into actionable ticket updates.
          
Available actions:
- Update status (open, in_progress, resolved, closed)
- Update priority (low, medium, high, urgent)
- Add or remove tags
- Generate summary
- Close ticket (sets status to closed)
- Post internal note (use type: "post_note" with a note field)

Current ticket state:
${JSON.stringify(ticket, null, 2)}

Ticket conversation:
${JSON.stringify(formattedMessages, null, 2)}

You must respond with ONLY a valid JSON object containing the actions to take. Example:
{
  "actions": [
    {
      "type": "status",
      "value": "in_progress"
    },
    {
      "type": "post_note",
      "note": "Summarized conversation: Customer reported login issues..."
    }
  ],
  "message": "I'll update the ticket status to in progress and add a summary note."
}

When asked to summarize messages:
1. Analyze the conversation history
2. Create a concise summary including:
   - Main issue/request
   - Key points discussed
   - Current status/progress
   - Any pending actions
3. Post this as an internal note using the post_note action

Do not include any other text in your response, only the JSON object.`,
        },
        {
          role: 'user',
          content: instruction,
        },
      ],
      temperature: 0,
    })

    let response;
    try {
      response = JSON.parse(completion.choices[0].message.content)
    } catch (error) {
      throw new Error('Failed to parse AI response as JSON')
    }

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
          // Call the existing summarize function
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/summarize-ticket`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ ticketId }),
          })
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
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
}) 