import { MikroORM } from "@mikro-orm/core";
import "reflect-metadata";
import redis from "redis";
import cors from "cors";
import session from "express-session";
import connectRedis from "connect-redis";
import mikroOrmConfig from "./mikro-orm.config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { SECRETS } from "./config";

const PORT = process.env.PORT || 9000;

async function main() {
  const orm = await MikroORM.init(mikroOrmConfig);
  await orm.getMigrator().up(); // run pre migrations

  const schema = await buildSchema({
    resolvers: [PostResolver, UserResolver],
    validate: false,
  });

  const app = express();
  const RedisStore = connectRedis(session);
  const redisClient = redis.createClient();

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );

  app.use(
    session({
      name: "qid",
      store: new RedisStore({
        client: redisClient,
        disableTouch: false,
      }),
      cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
        sameSite: "lax",
        secure: false, //FIXME: set this to true in production
      },
      saveUninitialized: false,
      secret: SECRETS.REDIS,
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema,
    context: ({ req, res }) => ({ em: orm.em, req, res }),
  });

  apolloServer.applyMiddleware({ app, cors: false });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch((err) => console.log("ERROR", err));
