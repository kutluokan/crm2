import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Input,
  Button,
  VStack,
  HStack,
  Text,
  Avatar,
  Switch,
  FormControl,
  FormLabel,
  Badge,
  IconButton,
  useToast,
  InputGroup,
  InputRightElement,
} from '@chakra-ui/react';
import { FiPaperclip, FiSearch } from 'react-icons/fi';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface UserProfile {
  full_name: string;
}

interface Message {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  is_internal: boolean;
  user: UserProfile;
}

interface TicketChatProps {
  ticketId: string;
  currentUserId: string;
  isSupport: boolean;
}

interface Document {
  id: string;
  filename: string;
  similarity: number;
}

export default function TicketChat({ ticketId, currentUserId, isSupport }: TicketChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isRagQuery, setIsRagQuery] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    let isMounted = true;

    const loadMessagesIfMounted = async () => {
      if (isMounted) {
        await loadMessages();
      }
    };

    loadMessagesIfMounted();
    const subscription = setupMessagesSubscription();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function setupMessagesSubscription() {
    return supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();
  }

  async function loadMessages() {
    try {
      if (!ticketId) {
        console.error('No ticket ID provided for TicketChat.');
        return;
      }

      // Create a new query each time
      const query = supabase
        .from('ticket_messages')
        .select('*, profiles(full_name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      // If not support/admin, filter out internal messages
      if (!isSupport) {
        query.eq('is_internal', false);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      
      // Transform the data to ensure it matches our Message type
      const transformedMessages: Message[] = (data || []).map(msg => ({
        id: msg.id,
        message: msg.message,
        created_at: msg.created_at,
        user_id: msg.user_id,
        is_internal: msg.is_internal,
        user: {
          full_name: msg.profiles?.full_name || 'Unknown User'
        }
      }));

      setMessages(transformedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);

      // Upload file to Supabase Storage
      const filename = `${ticketId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filename, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert({
          ticket_id: ticketId,
          filename,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Process document and generate embeddings
      const { error: processError } = await supabase.functions
        .invoke('process-document', {
          body: { documentId: document.id },
        });

      if (processError) throw processError;

      toast({
        title: 'Document uploaded successfully',
        status: 'success',
        duration: 3000,
      });

      // Add system message about the upload
      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        user_id: currentUserId,
        message: `Uploaded document: ${file.name}`,
        is_internal: false,
      });

    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error uploading document',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setIsLoading(true);

      if (isRagQuery) {
        // Perform RAG query
        const { data: response, error: ragError } = await supabase.functions
          .invoke('rag-query', {
            body: { 
              query: newMessage,
              ticketId,
            },
          });

        if (ragError) throw ragError;

        // Add user query
        await supabase.from('ticket_messages').insert({
          ticket_id: ticketId,
          user_id: currentUserId,
          message: `🔍 ${newMessage}`,
          is_internal: isInternal,
        });

        // Add AI response with document references
        const documentList = response.documents
          .map((doc: Document) => `- ${doc.filename} (${Math.round(doc.similarity * 100)}% match)`)
          .join('\n');

        await supabase.from('ticket_messages').insert({
          ticket_id: ticketId,
          user_id: currentUserId,
          message: `🤖 ${response.answer}\n\nReferences:\n${documentList}`,
          is_internal: isInternal,
        });
      } else {
        // Regular message
        await supabase.from('ticket_messages').insert({
          ticket_id: ticketId,
          user_id: currentUserId,
          message: newMessage,
          is_internal: isInternal,
        });
      }

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error sending message',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box height="100%" display="flex" flexDirection="column">
      <Box flex="1" overflowY="auto" p={4} bg="gray.50">
        <VStack spacing={4} align="stretch" pt={2}>
          {messages.map((message) => (
            <Box
              key={message.id}
              alignSelf={message.user_id === currentUserId ? 'flex-end' : 'flex-start'}
              maxWidth={{ base: "85%", md: "50%" }}
              minWidth="auto"
              w="fit-content"
              ml={message.user_id === currentUserId ? 'auto' : '0'}
              mr={message.user_id === currentUserId ? '0' : 'auto'}
              bg={message.is_internal 
                ? 'yellow.100'
                : message.user_id === currentUserId 
                  ? 'green.100' 
                  : 'blue.100'
              }
              p={4}
              borderRadius="lg"
              boxShadow="sm"
              borderLeft={message.is_internal ? '4px solid orange' : undefined}
            >
              <HStack 
                spacing={2} 
                mb={2}
                justify="flex-start"
                flexWrap="wrap"
              >
                {message.user_id !== currentUserId && (
                  <Avatar size="sm" name={message.user?.full_name} />
                )}
                <VStack spacing={0} align="flex-start">
                  <Text fontSize="sm" fontWeight="bold" noOfLines={1}>
                    {message.user?.full_name}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {new Date(message.created_at).toLocaleString()}
                  </Text>
                </VStack>
                {message.user_id === currentUserId && (
                  <Avatar size="sm" name={message.user?.full_name} />
                )}
              </HStack>
              <Box>
                <Text 
                  whiteSpace="pre-wrap" 
                  textAlign="left"
                  wordBreak="break-word"
                >
                  {message.message}
                </Text>
              </Box>
              {message.is_internal && (
                <Badge colorScheme="orange" mt={2}>Internal Note</Badge>
              )}
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </VStack>
      </Box>
      <Box p={4} bg="white" borderTop="1px" borderColor="gray.200">
        <VStack spacing={2}>
          <HStack width="100%" spacing={2}>
            {isSupport && (
              <FormControl display="flex" alignItems="center" width="auto">
                <FormLabel htmlFor="internal-note" mb="0" fontSize="sm">
                  Internal Note
                </FormLabel>
                <Switch
                  id="internal-note"
                  isChecked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                />
              </FormControl>
            )}
            <FormControl display="flex" alignItems="center" width="auto">
              <FormLabel htmlFor="rag-query" mb="0" fontSize="sm">
                Search Documents
              </FormLabel>
              <Switch
                id="rag-query"
                isChecked={isRagQuery}
                onChange={(e) => setIsRagQuery(e.target.checked)}
              />
            </FormControl>
          </HStack>
          <HStack width="100%" spacing={2}>
            <InputGroup>
              <Input
                placeholder={isRagQuery ? "Ask a question about the documents..." : "Type a message..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <InputRightElement>
                <IconButton
                  aria-label="Upload document"
                  icon={<FiPaperclip />}
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  isLoading={isLoading}
                />
              </InputRightElement>
            </InputGroup>
            <Button
              colorScheme="blue"
              onClick={handleSendMessage}
              isLoading={isLoading}
              leftIcon={isRagQuery ? <FiSearch /> : undefined}
            >
              {isRagQuery ? 'Search' : 'Send'}
            </Button>
          </HStack>
        </VStack>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".txt,.pdf"
          onChange={handleFileUpload}
        />
      </Box>
    </Box>
  );
} 
