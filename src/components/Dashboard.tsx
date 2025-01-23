import { useEffect, useState } from 'react';
import { Box, Heading, Text } from '@chakra-ui/react';
import { supabase } from '../lib/supabase';

type Profile = {
  id: string;
  role: 'customer' | 'support' | 'admin';
  full_name: string | null;
};

export function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(data);
      }
    }
    getProfile();
  }, []);

  if (!profile) {
    return <Box p={4}>Loading...</Box>;
  }

  return (
    <Box p={4}>
      <Heading mb={4}>Welcome, {profile.full_name || 'User'}</Heading>
      <Text>Your role: {profile.role}</Text>
      
      {profile.role === 'customer' && (
        <Box mt={4}>
          <Heading size="md">Customer Dashboard</Heading>
          {/* Add customer-specific content here */}
        </Box>
      )}
      
      {profile.role === 'support' && (
        <Box mt={4}>
          <Heading size="md">Support Dashboard</Heading>
          {/* Add support worker-specific content here */}
        </Box>
      )}
      
      {profile.role === 'admin' && (
        <Box mt={4}>
          <Heading size="md">Admin Dashboard</Heading>
          {/* Add admin-specific content here */}
        </Box>
      )}
    </Box>
  );
}
