import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  Input,
  Button,
  Text,
  useToast,
  Spinner,
} from '@chakra-ui/react';
import { createTicketAgent } from '../lib/ticketAgent';

interface TicketAIAgentProps {
  userRole: string;
}

export function TicketAIAgent({ userRole }: TicketAIAgentProps) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<any>(null);
  const toast = useToast();

  useEffect(() => {
    async function initAgent() {
      try {
        const ticketAgent = await createTicketAgent();
        setAgent(ticketAgent);
      } catch (error) {
        console.error('Error initializing agent:', error);
        toast({
          title: 'Error initializing AI agent',
          status: 'error',
          duration: 5000,
        });
      }
    }

    initAgent();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!query.trim() || !agent) return;

    setLoading(true);
    try {
      const result = await agent.processQuery(query);
      setResponse(result);
    } catch (error) {
      console.error('Error processing query:', error);
      toast({
        title: 'Error processing query',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [query, agent]);

  if (!agent) {
    return (
      <Box p={4}>
        <Text>Initializing AI agent...</Text>
        <Spinner mt={2} />
      </Box>
    );
  }

  return (
    <Box p={4} bg="white" borderRadius="md" shadow="sm">
      <VStack spacing={4}>
        <Input
          placeholder="Ask me about tickets or request actions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <Button
          colorScheme="blue"
          onClick={handleSubmit}
          isLoading={loading}
          width="full"
        >
          Send Query
        </Button>
        {response && (
          <Box
            p={4}
            bg="gray.50"
            borderRadius="md"
            width="full"
            whiteSpace="pre-wrap"
          >
            <Text>{response}</Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
} 