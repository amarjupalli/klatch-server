import { MikroORM } from "@mikro-orm/core";
import mikroOrmConfig from "./mikro-orm.config";

async function main() {
  try {
    const orm = await MikroORM.init(mikroOrmConfig);
    await orm.getMigrator().up(); // run pre migrations
  } catch (error) {
    console.error("Database connection failed", error);
  }
}

main().catch((err) => console.log("ERROR", err));
