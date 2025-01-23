import { Box, Container, Heading, Button, HStack, Text } from '@chakra-ui/react'
import { supabase } from '../lib/supabase'

export function CustomerDashboard() {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <Container maxW="container.xl" py={8}>
      <HStack justify="space-between" mb={8}>
        <Heading size="lg">Customer Dashboard</Heading>
        <Button onClick={handleSignOut} colorScheme="red" variant="outline">
          Sign Out
        </Button>
      </HStack>

      <Box bg="white" rounded="lg" shadow="base" p={6}>
        <Text>Welcome to your customer dashboard. Here you can view your tickets and support requests.</Text>
      </Box>
    </Container>
  )
}
