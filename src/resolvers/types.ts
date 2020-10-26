import { Request, Response } from "express";
import { Redis } from "ioredis";

export type ORMContext = {
  req: Request;
  res: Response;
  redis: Redis;
};
