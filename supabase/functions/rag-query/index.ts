import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4.20.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting RAG query...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Supabase client created');

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    });

    console.log('OpenAI client created');

    const { query, ticketId } = await req.json()
    console.log('Query:', query);
    console.log('Ticket ID:', ticketId);

    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query,
    });

    console.log('Query embedding generated');

    const embedding = embeddingResponse.data[0].embedding;

    // Search for similar documents
    const { data: documents, error: searchError } = await supabaseClient.rpc(
      'match_documents',
      {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5,
        ticket_id: ticketId
      }
    )

    if (searchError) {
      console.error('Error searching documents:', searchError);
      throw searchError;
    }

    console.log('Found matching documents:', documents);

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ 
          answer: "I couldn't find any relevant documents to answer your question.",
          documents: []
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Prepare context from matched documents
    const context = documents
      .map((doc, index) => `Document ${index + 1}:\nFilename: ${doc.filename}\nContent: "${doc.content}"`)
      .join('\n\n');

    console.log('Context prepared:', context);

    // Generate response using ChatGPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that reads and explains document contents. 
The documents and their contents are provided in the context below. 
When asked about a document's content, read the content provided in the context and explain what it contains.
Always reference the actual content provided, don't say you can't access the files.`,
        },
        {
          role: 'user',
          content: `Here are the relevant documents and their contents:\n\n${context}\n\nQuestion: ${query}`,
        },
      ],
    });

    console.log('ChatGPT response generated');

    const answer = completion.choices[0].message.content;

    return new Response(
      JSON.stringify({ 
        answer,
        documents: documents.map(doc => ({
          filename: doc.filename,
          similarity: doc.similarity
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('RAG query error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString(),
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 