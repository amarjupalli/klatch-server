import { MikroORM } from "@mikro-orm/core";
import { Post } from "./entities/Post";
import mikroOrmConfig from "./mikro-orm.config";

async function main() {
  const orm = await MikroORM.init(mikroOrmConfig);
  await orm.getMigrator().up(); // run pre migrations
}

main().catch((err) => console.log("ERROR", err));
