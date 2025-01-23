import { Box, VStack, Button, Icon, Text, useToast } from '@chakra-ui/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FiUsers, FiInbox, FiHelpCircle, FiLogOut } from 'react-icons/fi'
import { supabase } from '../lib/supabase'

interface MenuItem {
  label: string
  path: string
  icon: any
}

interface SidebarProps {
  items: MenuItem[]
}

export function Sidebar({ items }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  async function handleSignOut() {
    try {
      // Clear state first
      sessionStorage.clear()
      localStorage.clear()

      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      // Finally navigate
      navigate('/', { replace: true })
    } catch (error: any) {
      console.error('Error signing out:', error)
      toast({
        title: 'Error signing out',
        description: error.message || 'An error occurred while signing out',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      // Force navigation to home on error
      navigate('/', { replace: true })
    }
  }

  return (
    <Box
      w="240px"
      h="100vh"
      bg="white"
      borderRight="1px"
      borderColor="gray.200"
      py={8}
      position="fixed"
      left={0}
      top={0}
      display="flex"
      flexDirection="column"
    >
      <VStack spacing={2} align="stretch" px={4} flex="1">
        {items.map((item) => (
          <Button
            key={item.path}
            leftIcon={<Icon as={item.icon} />}
            variant={location.pathname.includes(item.path) ? 'solid' : 'ghost'}
            justifyContent="flex-start"
            size="lg"
            onClick={() => navigate(item.path)}
            colorScheme={location.pathname.includes(item.path) ? 'blue' : 'gray'}
          >
            <Text fontSize="md">{item.label}</Text>
          </Button>
        ))}
      </VStack>
      
      <Box px={4} mt="auto">
        <Button
          leftIcon={<Icon as={FiLogOut} />}
          variant="ghost"
          justifyContent="flex-start"
          size="lg"
          width="100%"
          colorScheme="red"
          onClick={handleSignOut}
        >
          <Text fontSize="md">Sign Out</Text>
        </Button>
      </Box>
    </Box>
  )
} 