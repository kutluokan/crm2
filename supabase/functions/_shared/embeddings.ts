import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import OpenAI from 'https://esm.sh/openai@4.20.1'

export async function embedAndSearch(query: string) {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const openai = new OpenAI({
    apiKey: Deno.env.get('OPENAI_API_KEY'),
  })

  // Generate embedding for the query
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query,
  })

  const embedding = embeddingResponse.data[0].embedding

  // Search for similar documents
  const { data: documents, error: searchError } = await supabaseClient.rpc(
    'match_documents',
    {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5
    }
  )

  if (searchError) {
    console.error('Error searching documents:', searchError)
    return null
  }

  return documents
} 