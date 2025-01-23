import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Text, Button } from '@chakra-ui/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Box p={8} maxW="container.md" mx="auto" textAlign="center">
          <Text fontSize="xl" mb={4}>Something went wrong</Text>
          <Text color="gray.600" mb={4}>{this.state.error?.message}</Text>
          <Button
            colorScheme="blue"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
