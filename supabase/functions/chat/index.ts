import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { corsHeaders } from '../_shared/cors.ts'
import { embedAndSearch } from '../_shared/embeddings.ts'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate request
    if (!req.headers.get('authorization')) {
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Initialize OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('Missing OpenAI API key');
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      throw new Error('Invalid messages format');
    }

    // Get user ID from JWT
    const authHeader = req.headers.get('authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Get relevant documents using existing RAG system
    const lastMessage = messages[messages.length - 1].content;
    const relevantDocs = await embedAndSearch(lastMessage);
    
    // Get any uploaded files related to the user's tickets
    const { data: ticketFiles, error: filesError } = await supabaseClient
      .from('documents')
      .select('content, filename, metadata')
      .filter('ticket_id', 'in', (
        await supabaseClient
          .from('tickets')
          .select('id')
          .eq('customer_id', user.id)
      ).data?.map(t => t.id) || []);

    if (filesError) {
      console.error('Error fetching ticket files:', filesError);
    }

    // Combine relevant documents and files
    const allContext = [
      ...(relevantDocs || []).map(doc => doc.content),
      ...(ticketFiles || []).map(file => `File ${file.filename}:\n${file.content}`)
    ];
    
    // Format conversation history and context for OpenAI
    const conversationHistory = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    // Add context from RAG and files
    const contextMessage = {
      role: 'system',
      content: `Relevant context from our knowledge base and uploaded files:\n${allContext.join('\n\n')}`
    };

    // Call OpenAI API for chat response
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful customer support AI assistant. Help users with their questions and create support tickets when necessary.'
          },
          contextMessage,
          ...conversationHistory
        ],
        temperature: 0.7,
      }),
    });

    if (!chatResponse.ok) {
      throw new Error(`OpenAI API error: ${chatResponse.statusText}`);
    }

    const aiResponse = await chatResponse.json();
    const responseContent = aiResponse.choices[0].message.content;

    // Generate conversation summary for internal use
    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Create a concise internal summary of this customer conversation. Focus on key points, customer needs, and any actions taken or needed.'
          },
          ...conversationHistory,
          {
            role: 'assistant',
            content: responseContent
          }
        ],
        temperature: 0.7,
        max_tokens: 250,
      }),
    });

    if (!summaryResponse.ok) {
      throw new Error(`OpenAI API error: ${summaryResponse.statusText}`);
    }

    const summaryResult = await summaryResponse.json();
    const summary = summaryResult.choices[0].message.content;

    // Determine if we need to create a ticket
    const needsTicket = responseContent.toLowerCase().includes('create a ticket') || 
                       responseContent.toLowerCase().includes('submit a ticket') ||
                       responseContent.toLowerCase().includes('open a ticket');

    let ticketSummary = null;
    if (needsTicket) {
      // Generate ticket title and description
      const ticketResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Create a concise ticket title and description based on the conversation. Return in JSON format with "title" and "description" fields.'
            },
            ...conversationHistory,
            {
              role: 'assistant',
              content: responseContent
            }
          ],
          temperature: 0.7,
        }),
      });

      if (!ticketResponse.ok) {
        throw new Error(`OpenAI API error: ${ticketResponse.statusText}`);
      }

      const ticketResult = await ticketResponse.json();
      try {
        ticketSummary = JSON.parse(ticketResult.choices[0].message.content);
      } catch (e) {
        console.error('Failed to parse ticket summary:', e);
      }
    }

    console.log('AI Response:', responseContent);
    console.log('Should create ticket:', needsTicket);
    console.log('Ticket Summary:', ticketSummary);
    console.log('Internal Summary:', summary);

    return new Response(
      JSON.stringify({
        content: responseContent,
        createTicket: needsTicket,
        ticketSummary,
        internalSummary: summary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 