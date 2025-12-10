import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const client = new QueryClient();

export function QueryClientContext(props: { children: React.ReactNode }) {
   return <QueryClientProvider client={client}>{props.children}</QueryClientProvider>;
}
