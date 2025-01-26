import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4.24.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Parse request body
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

    // Try to fetch knowledge base documents if the table exists
    let knowledgeBase = [];
    try {
      const { data: documents, error: docsError } = await supabaseClient
        .from('knowledge_base')
        .select('content')
        .limit(5);

      if (!docsError && documents) {
        knowledgeBase = documents;
      }
    } catch (error) {
      console.log('Knowledge base not available:', error);
      // Continue without knowledge base
    }

    // Create system message with context
    const systemMessage = {
      role: 'system',
      content: `You are a helpful customer support AI assistant. ${knowledgeBase.length ? `You have access to the following knowledge base documents:
${knowledgeBase.map((doc, i) => `Document ${i + 1}: ${doc.content}`).join('\n')}` : 'The knowledge base is currently empty.'}

Your goal is to help customers resolve their issues. If you cannot resolve the issue, you MUST explicitly say "I'll create a support ticket for you" in your response.

When to create a ticket:
1. If the issue is complex and requires human intervention
2. If the solution isn't found in the knowledge base
3. If the customer has tried the suggested solutions without success

Remember: You MUST include the exact phrase "I'll create a support ticket for you" if you determine a ticket is needed.`
    }

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      max_tokens: 500,
    });

    if (!completion.choices[0].message) {
      throw new Error('No response from OpenAI');
    }

    const aiResponse = completion.choices[0].message.content;
    
    // Determine if we need to create a ticket
    const shouldCreateTicket = aiResponse.toLowerCase().includes("i'll create a support ticket for you") ||
      aiResponse.toLowerCase().includes("i will create a support ticket for you");

    let ticketSummary = null;
    if (shouldCreateTicket) {
      // Get a concise summary for the ticket
      const summaryCompletion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a support ticket summarizer. Create two parts:
1. Title: A very concise title (max 50 chars)
2. Description: A clear, professional summary of the issue that will be the first message in the ticket. Include:
   - The main problem
   - Any relevant technical details
   - What has been tried (if anything)
   - Why this needs human support
Format your response as a JSON object: {"title": "...", "description": "..."}`
          },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      try {
        ticketSummary = JSON.parse(summaryCompletion.choices[0].message?.content || '{}');
      } catch (e) {
        console.error('Error parsing summary:', e);
        ticketSummary = {
          title: 'Support Needed',
          description: 'Customer requires assistance with their issue. A support representative will review the conversation history and assist you further.'
        };
      }
    }

    console.log('AI Response:', aiResponse);
    console.log('Should create ticket:', shouldCreateTicket);
    console.log('Ticket Summary:', ticketSummary);

    return new Response(
      JSON.stringify({
        content: aiResponse,
        createTicket: shouldCreateTicket,
        ticketSummary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Edge function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}) 