import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Button,
  Input,
  Box,
  Text,
  Heading,
  VStack,
  Spinner,
  Flex,
  useToast
} from '@chakra-ui/react';
import { FiSend } from 'react-icons/fi';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function CustomerHelpAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    checkUserProfile();
    // Initial greeting
    setMessages([{
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you today?'
    }]);
  }, []);

  const checkUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      // Try to get the user's profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error || !profile) {
        // Try to create profile if it doesn't exist
        const { data: newProfile, error: createError } = await supabase.rpc(
          'create_profile_if_not_exists',
          { user_id: user.id, user_role: 'customer' }
        );

        if (createError) {
          console.error('Error creating profile:', createError);
          toast({
            title: 'Error',
            description: 'Failed to create user profile. Please try logging in again.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Error checking profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify user profile. Please try logging in again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      navigate('/');
    }
  };

  const createTicket = async (conversation: Message[], summary: { title: string; description: string }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Create a ticket with summary
      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert([{
          title: summary.title,
          description: summary.description,
          status: 'open',
          priority: 'medium',
          source: 'ai_assistant',
          customer_id: user.id
        }])
        .select()
        .single();

      if (error) {
        console.error('Ticket creation error:', error);
        throw error;
      }
      
      if (!ticket) {
        throw new Error('No ticket returned after creation');
      }

      // Add the summary as the first message
      const { error: messageError } = await supabase
        .from('ticket_messages')
        .insert([{
          ticket_id: ticket.id,
          user_id: user.id,
          message: summary.description,
          is_internal: false
        }]);

      if (messageError) {
        console.error('Error adding summary message:', messageError);
      }

      toast({
        title: 'Ticket Created',
        description: 'Support ticket has been created successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      return ticket;
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast({
        title: 'Error creating ticket',
        description: 'Failed to create support ticket. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return null;
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call AI function endpoint using Supabase Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      // First add AI's response to messages
      const aiMessage: Message = { role: 'assistant', content: data.content };
      setMessages(prev => [...prev, aiMessage]);
      
      // If ticket creation is needed, create it and navigate
      if (data.createTicket && data.ticketSummary) {
        const allMessages = [...messages, userMessage, aiMessage];
        const ticket = await createTicket(allMessages, data.ticketSummary);
        
        if (ticket) {
          const ticketMessage: Message = { 
            role: 'assistant', 
            content: `I've created a support ticket (#${ticket.id}) for you with the title: "${data.ticketSummary.title}". Redirecting you to the ticket page...` 
          };
          setMessages(prev => [...prev, ticketMessage]);
          
          // Wait a moment to show the message before redirecting
          setTimeout(() => {
            navigate(`/customer/tickets/${ticket.id}`);
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get AI response';
      const errorResponse: Message = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again later.' 
      };
      setMessages(prev => [...prev, errorResponse]);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }

    setLoading(false);
  };

  return (
    <Box maxW="800px" mx="auto" p={6}>
      <Box bg="white" p={6} borderRadius="lg" shadow="base">
        <Heading size="md" mb={4}>
          AI Help Assistant
        </Heading>
        
        <VStack spacing={4} h="60vh" overflowY="auto" mb={4} align="stretch">
          {messages.map((message, index) => (
            <Box
              key={index}
              p={4}
              bg={message.role === 'assistant' ? 'gray.50' : 'blue.50'}
              borderRadius="md"
            >
              <Text>{message.content}</Text>
            </Box>
          ))}
          {loading && (
            <Flex justify="center" p={4}>
              <Spinner size="md" />
            </Flex>
          )}
        </VStack>

        <Flex gap={2}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message here..."
            disabled={loading}
          />
          <Button
            colorScheme="blue"
            onClick={handleSend}
            isDisabled={loading}
            leftIcon={<FiSend />}
          >
            Send
          </Button>
        </Flex>
      </Box>
    </Box>
  );
} 