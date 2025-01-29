import {
  Box,
  VStack,
  Text,
  Heading,
  Button,
  Input,
  useToast,
  Spinner,
} from '@chakra-ui/react';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface TicketAIAgentProps {
  ticketId: string;
  userRole: 'admin' | 'support' | 'customer';
  onUpdate: () => void;
}

export function TicketAIAgent({ ticketId, userRole, onUpdate }: TicketAIAgentProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleAction = async () => {
    if (!input.trim()) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ticket-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          ticketId,
          instruction: input,
          userRole,
          userId: session.user.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      toast({
        title: 'Action completed',
        description: data.message,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Clear input and refresh ticket data
      setInput('');
      onUpdate();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to perform action',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Only show for admin and support roles
  if (userRole === 'customer') {
    return null;
  }

  return (
    <Box>
      <Heading size="sm" mb={2}>AI Agent</Heading>
      <VStack spacing={3} align="stretch">
        <Text fontSize="sm">
          Ask me to help manage this ticket. I can:
          {'\n'}- Update status or priority
          {'\n'}- Add or remove tags
          {'\n'}- Generate summaries
          {'\n'}- Close resolved tickets
          {'\n'}- Add internal notes
        </Text>
        <Input
          placeholder="What would you like me to do?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAction()}
          disabled={loading}
        />
        <Button
          onClick={handleAction}
          isLoading={loading}
          loadingText="Processing"
          colorScheme="blue"
          leftIcon={loading ? <Spinner size="sm" /> : undefined}
        >
          Execute
        </Button>
      </VStack>
    </Box>
  );
} 