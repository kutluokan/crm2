import { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Heading,
  Divider,
  Select,
  useToast,
} from '@chakra-ui/react';
import { supabase } from '../../lib/supabase';
import TicketChat from '../TicketChat';

// ... existing code ... 