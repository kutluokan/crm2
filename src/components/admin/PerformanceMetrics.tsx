import { useEffect, useState } from 'react'
import {
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Heading,
  VStack,
  HStack,
  Select,
  Progress,
  useColorModeValue,
} from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'

interface Metrics {
  totalTickets: number
  openTickets: number
  resolvedTickets: number
  avgResolutionTime: number
  responseRate: number
}

interface PerformanceMetricsProps {
  userRole: 'admin' | 'support'
  userId?: string
}

export function PerformanceMetrics({ userRole, userId }: PerformanceMetricsProps) {
  const [metrics, setMetrics] = useState<Metrics>({
    totalTickets: 0,
    openTickets: 0,
    resolvedTickets: 0,
    avgResolutionTime: 0,
    responseRate: 0,
  })
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week')
  const [loading, setLoading] = useState(true)
  const bgColor = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.700')

  useEffect(() => {
    fetchMetrics()
  }, [timeRange, userId])

  async function fetchMetrics() {
    try {
      setLoading(true)
      const now = new Date()
      let startDate = new Date()

      // Calculate start date based on time range
      switch (timeRange) {
        case 'day':
          startDate.setDate(now.getDate() - 1)
          break
        case 'week':
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(now.getMonth() - 1)
          break
      }

      // Build the query based on user role and time range
      let query = supabase
        .from('tickets')
        .select('*', { count: 'exact' })
        .gte('created_at', startDate.toISOString())

      // Add role-specific filters
      if (userRole === 'support' && userId) {
        query = query.eq('assigned_to', userId)
      }

      const { data: tickets, error, count } = await query

      if (error) throw error

      // Calculate metrics
      const openTickets = tickets?.filter(t => t.status === 'open' || t.status === 'in_progress').length || 0
      const resolvedTickets = tickets?.filter(t => t.status === 'resolved' || t.status === 'closed').length || 0
      
      // Calculate average resolution time for resolved tickets
      const resolvedTicketsData = tickets?.filter(t => t.status === 'resolved' || t.status === 'closed') || []
      const totalResolutionTime = resolvedTicketsData.reduce((acc, ticket) => {
        const created = new Date(ticket.created_at)
        const resolved = new Date(ticket.updated_at)
        return acc + (resolved.getTime() - created.getTime())
      }, 0)
      
      const avgResolutionTime = resolvedTicketsData.length > 0
        ? totalResolutionTime / resolvedTicketsData.length / (1000 * 60 * 60) // Convert to hours
        : 0

      // Calculate response rate (resolved tickets / total tickets)
      const responseRate = count ? (resolvedTickets / count) * 100 : 0

      setMetrics({
        totalTickets: count || 0,
        openTickets,
        resolvedTickets,
        avgResolutionTime,
        responseRate,
      })
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Progress size="xs" isIndeterminate />
  }

  return (
    <Box w="100%">
      <Box borderBottom="1px" borderColor="gray.200" px={4} py={2}>
        <HStack justify="space-between">
          <Heading size="lg">Performance Metrics</Heading>
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as 'day' | 'week' | 'month')}
            width="150px"
          >
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </Select>
        </HStack>
      </Box>

      <SimpleGrid 
        columns={{ base: 1, md: 2, lg: 3 }} 
        spacing={0}
        w="100%"
      >
        <Box p={4} bg={bgColor} borderRight="1px" borderBottom="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Total Tickets</StatLabel>
            <StatNumber>{metrics.totalTickets}</StatNumber>
            <StatHelpText>In selected period</StatHelpText>
          </Stat>
        </Box>

        <Box p={4} bg={bgColor} borderRight="1px" borderBottom="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Open Tickets</StatLabel>
            <StatNumber>{metrics.openTickets}</StatNumber>
            <StatHelpText>Requiring attention</StatHelpText>
          </Stat>
        </Box>

        <Box p={4} bg={bgColor} borderBottom="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Resolved Tickets</StatLabel>
            <StatNumber>{metrics.resolvedTickets}</StatNumber>
            <StatHelpText>Successfully completed</StatHelpText>
          </Stat>
        </Box>

        <Box p={4} bg={bgColor} borderRight="1px" borderBottom="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Avg. Resolution Time</StatLabel>
            <StatNumber>{metrics.avgResolutionTime.toFixed(1)}h</StatNumber>
            <StatHelpText>Time to resolve tickets</StatHelpText>
          </Stat>
        </Box>

        <Box p={4} bg={bgColor} borderRight="1px" borderBottom="1px" borderColor={borderColor}>
          <Stat>
            <StatLabel>Response Rate</StatLabel>
            <StatNumber>{metrics.responseRate.toFixed(1)}%</StatNumber>
            <Progress
              value={metrics.responseRate}
              size="sm"
              colorScheme={metrics.responseRate > 75 ? 'green' : metrics.responseRate > 50 ? 'yellow' : 'red'}
              mt={2}
            />
            <StatHelpText>Resolved vs Total</StatHelpText>
          </Stat>
        </Box>
      </SimpleGrid>
    </Box>
  )
} 