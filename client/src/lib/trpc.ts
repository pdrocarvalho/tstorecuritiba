import { createTRPCReact } from "@trpc/react-query";

export interface AppRouter {
  notifications: {
    getPending: {
      query: () => Promise<any[]>;
    };
  };
}

export const trpc = createTRPCReact<AppRouter>();