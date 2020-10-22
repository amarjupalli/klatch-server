import { MikroORM } from "@mikro-orm/core";
import "reflect-metadata";
import mikroOrmConfig from "./mikro-orm.config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";

const PORT = process.env.PORT || 9000;

async function main() {
  const orm = await MikroORM.init(mikroOrmConfig);
  await orm.getMigrator().up(); // run pre migrations

  const schema = await buildSchema({
    resolvers: [PostResolver, UserResolver],
    validate: false,
  });

  const apolloServer = new ApolloServer({
    schema,
    context: () => ({ em: orm.em }),
  });

  const app = express();

  apolloServer.applyMiddleware({ app });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main().catch((err) => console.log("ERROR", err));
