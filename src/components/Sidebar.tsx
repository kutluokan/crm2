import { Box, VStack, Button, Icon, Text } from '@chakra-ui/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FiUsers, FiInbox, FiHelpCircle } from 'react-icons/fi'

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
    >
      <VStack spacing={2} align="stretch" px={4}>
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
    </Box>
  )
} 