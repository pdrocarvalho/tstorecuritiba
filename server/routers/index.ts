import { router } from "../_core/trpc";
import { notificationRouter } from "./notification.router";

export const appRouter = router({
  notifications: notificationRouter,
});

export type AppRouter = typeof appRouter;