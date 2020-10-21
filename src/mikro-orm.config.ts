// import path from "path";
import { MikroORM } from "@mikro-orm/core";
import path from "path";
import { Post } from "./entities/Post";

const mikroOrmConfig = {
  dbName: "boards",
  debug: true,
  entities: [Post],
  migrations: {
    path: path.join(__dirname, "./migrations"), // path to the folder with migrations
    pattern: /^[\w-]+\d+\.[tj]s$/, // regex pattern for the migration files
  },
  type: "postgresql",
} as Parameters<typeof MikroORM.init>[0];

export default mikroOrmConfig;
