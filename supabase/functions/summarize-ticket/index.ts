import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from './cors.ts';

serve(async (req) => {
  console.log('Function received request:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ticketId } = await req.json();
    console.log('Processing ticket:', ticketId);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all messages for the ticket
    const { data: messages, error: messagesError } = await supabaseClient
      .from('ticket_messages')
      .select('message, created_at, is_internal, profiles(full_name)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    // Format messages for OpenAI
    const conversationText = messages
      .map(msg => `${msg.profiles.full_name} (${new Date(msg.created_at).toLocaleString()}): ${msg.message}${msg.is_internal ? ' [Internal Note]' : ''}`)
      .join('\n\n');

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes customer support conversations. Create a concise summary that captures the key points, any decisions made, and the current status. Focus on the most important details.'
          },
          {
            role: 'user',
            content: `Please summarize this support ticket conversation:\n\n${conversationText}`
          }
        ],
        max_tokens: 250,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const openAIResponse = await response.json();
    const summary = openAIResponse.choices[0].message.content;

    // Store the AI-generated summary in the tickets table
    const { error: updateError } = await supabaseClient
      .from('tickets')
      .update({ ai_summary: summary })
      .eq('id', ticketId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        message: 'Summary generated and stored',
        summary,
        ticketId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
}); 