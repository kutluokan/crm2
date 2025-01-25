import {
  Box,
  VStack,
  Text,
  Heading,
  Divider,
  Badge,
} from '@chakra-ui/react';
import { Ticket } from './types';

interface TicketInfoProps {
  ticket: Ticket;
  customerEmail: string;
}

export function TicketInfo({ ticket, customerEmail }: TicketInfoProps) {
  return (
    <Box
      width="300px"
      height="100vh"
      position="fixed"
      right="0"
      top="0"
      bg="white"
      borderLeft="1px"
      borderColor="gray.200"
      p={4}
      overflowY="auto"
    >
      <VStack spacing={4} align="stretch">
        <Box>
          <Heading size="sm" mb={2}>Customer Information</Heading>
          <Text fontSize="sm">Name: {ticket.customer?.full_name}</Text>
          <Text fontSize="sm">Email: {customerEmail}</Text>
        </Box>

        <Divider />

        <Box>
          <Heading size="sm" mb={2}>Ticket Details</Heading>
          <Text fontSize="sm">ID: #{ticket.id}</Text>
          <Text fontSize="sm">Created: {new Date(ticket.created_at).toLocaleDateString()}</Text>
          <Text fontSize="sm">Status: <Badge colorScheme={ticket.status === 'open' ? 'red' : ticket.status === 'in_progress' ? 'yellow' : 'green'}>{ticket.status}</Badge></Text>
          <Text fontSize="sm">Priority: <Badge colorScheme={
            ticket.priority === 'urgent' ? 'red' : 
            ticket.priority === 'high' ? 'orange' : 
            ticket.priority === 'medium' ? 'yellow' : 
            'green'
          }>{ticket.priority}</Badge></Text>
        </Box>

        <Divider />

        <Box>
          <Heading size="sm" mb={2}>Assigned To</Heading>
          <Text fontSize="sm">{ticket.assignee?.full_name || 'Unassigned'}</Text>
        </Box>

        <Divider />

        <Box>
          <Heading size="sm" mb={2}>Tags</Heading>
          {ticket.tags?.length > 0 ? (
            <VStack spacing={2} align="stretch">
              {ticket.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  bg={tag.color}
                  color="gray.800"
                  px={2}
                  py={1}
                  borderRadius="full"
                >
                  {tag.name}
                </Badge>
              ))}
            </VStack>
          ) : (
            <Text fontSize="sm">No tags</Text>
          )}
        </Box>
      </VStack>
    </Box>
  );
} 