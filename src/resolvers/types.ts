import { EntityManager, IDatabaseDriver, Connection } from "@mikro-orm/core";

export type ORMContext = {
  em: EntityManager<any> & EntityManager<IDatabaseDriver<Connection>>;
};
