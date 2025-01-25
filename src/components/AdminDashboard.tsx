import {
  Box,
  Heading,
  Flex,
} from '@chakra-ui/react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { FiUsers, FiInbox, FiBarChart2, FiMessageSquare } from 'react-icons/fi'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const sidebarItems = [
  { label: 'User Management', path: '/admin/users', icon: FiUsers },
  { label: 'Tickets', path: '/admin/tickets', icon: FiInbox },
  { label: 'Performance', path: '/admin/performance', icon: FiBarChart2 },
  { label: 'Templates', path: '/admin/templates', icon: FiMessageSquare },
]

export function AdminDashboard() {
  const [userId, setUserId] = useState('')

  useEffect(() => {
    getCurrentUser()
  }, [])

  async function getCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  return (
    <Flex h="100vh" w="100vw" overflowY="auto" overflowX="hidden">
      <Sidebar items={sidebarItems} />
      <Box ml="240px" w="full" px={8}>
        <Box bg="gray.50" px={8} py={4}>
          <Heading size="lg">Admin Dashboard</Heading>
        </Box>

        <Outlet />
      </Box>
    </Flex>
  )
}
