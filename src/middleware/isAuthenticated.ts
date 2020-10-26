import { ORMContext } from "src/resolvers/types";
import { MiddlewareFn } from "type-graphql";

export const isAuthenticated: MiddlewareFn<ORMContext> = (
  { context: { req } },
  next
) => {
  if (!req.session?.userId) {
    throw new Error("User not authenticated");
  }
  return next();
};
