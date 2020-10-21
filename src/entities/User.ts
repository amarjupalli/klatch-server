import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { Field } from "type-graphql";

@Entity()
export class User {
  @Field()
  @PrimaryKey()
  id!: number;

  @Field(() => String)
  @Property({ type: "Date" })
  createdAt = new Date();

  @Field(() => String)
  @Property({ type: "Date", onUpdate: () => new Date() })
  updatedAt = new Date();

  @Field()
  @Property({ type: "text" })
  username!: string;

  @Property({ type: "text", unique: true })
  password!: string;
}
