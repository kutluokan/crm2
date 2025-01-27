import { Box, Heading } from '@chakra-ui/react';
import { TicketAIAgent } from '../TicketAIAgent';

interface TicketAIAssistantProps {
  userRole: 'admin' | 'support';
}

export function TicketAIAssistant({ userRole }: TicketAIAssistantProps) {
  return (
    <Box p={6}>
      <Heading size="lg" mb={6}>AI Ticket Assistant</Heading>
      <TicketAIAgent userRole={userRole} />
    </Box>
  );
} 