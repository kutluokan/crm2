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
    console.log('Starting document processing...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Supabase client created');

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    });

    console.log('OpenAI client created');

    const { documentId } = await req.json()
    console.log('Document ID:', documentId);

    // Get document from database
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError) {
      console.error('Error fetching document:', docError);
      throw docError;
    }

    console.log('Document fetched:', document);

    // Get file content from storage
    const { data: fileData, error: fileError } = await supabaseClient
      .storage
      .from('documents')
      .download(document.filename)

    if (fileError) {
      console.error('Error downloading file:', fileError);
      throw fileError;
    }

    console.log('File downloaded');

    // Convert file content to text
    const content = new TextDecoder().decode(await fileData.arrayBuffer())
    console.log('File content:', content);
    console.log('File content decoded, length:', content.length);

    // Generate embedding using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: content || ' ', // Ensure we have at least one character
    });

    console.log('Embedding generated');

    const embedding = embeddingResponse.data[0].embedding;

    // Update document with content and embedding
    const { data: updateData, error: updateError } = await supabaseClient
      .from('documents')
      .update({
        content,
        embedding,
      })
      .eq('id', documentId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating document:', updateError);
      throw updateError;
    }

    console.log('Document updated successfully:', updateData);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Process document error:', error);
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