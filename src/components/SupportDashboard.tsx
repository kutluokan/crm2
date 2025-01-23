import { Box, Container, Heading, Button, HStack, Text } from '@chakra-ui/react'
import { supabase } from '../lib/supabase'

export function SupportDashboard() {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <Container maxW="container.xl" py={8}>
      <HStack justify="space-between" mb={8}>
        <Heading size="lg">Support Dashboard</Heading>
        <Button onClick={handleSignOut} colorScheme="red" variant="outline">
          Sign Out
        </Button>
      </HStack>

      <Box bg="white" rounded="lg" shadow="base" p={6}>
        <Text>Welcome to the support dashboard. Here you can manage customer tickets and respond to support requests.</Text>
      </Box>
    </Container>
  )
}
