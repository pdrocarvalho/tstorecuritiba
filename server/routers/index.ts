/**
 * server/routers/index.ts
 *
 * Agrega todos os routers tRPC da aplicação.
 * O tipo AppRouter é exportado para uso no cliente (inferência de tipos end-to-end).
 */

import { router } from "../_core/trpc";
import { systemRouter } from "../_core/systemRouter";
import { authRouter } from "./auth.router";
import { adminRouter } from "./admin.router";
import { notificationRouter } from "./notification.router";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  admin: adminRouter,
  notifications: notificationRouter,
});

export type AppRouter = typeof appRouter;
