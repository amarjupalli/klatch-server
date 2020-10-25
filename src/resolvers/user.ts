import argon2 from "argon2";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import { User } from "../entities/User";
import { ORMContext } from "./types";

@InputType()
class UsernamePasswordInput {
  @Field()
  email: string;

  @Field()
  username: string;

  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  errorMessage: string;
}

@ObjectType()
class UserResponse {
  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class UserResolver {
  @Mutation(() => UserResponse)
  async register(
    @Arg("options", () => UsernamePasswordInput) options: UsernamePasswordInput,
    @Ctx() { em, req }: ORMContext
  ): Promise<UserResponse> {
    if (options.username.length <= 2) {
      return {
        errors: [
          {
            field: "username",
            errorMessage: "username has to be 2 or more characters",
          },
        ],
      };
    }

    if (options.email.length <= 2 || !options.email.includes("@")) {
      return {
        errors: [
          {
            field: "email",
            errorMessage: "Email is in invalid format.",
          },
        ],
      };
    }

    if (options.password.length <= 2) {
      return {
        errors: [
          {
            field: "password",
            errorMessage: "Password has to be 2 or more characters",
          },
        ],
      };
    }

    const existingUser = await em.findOne(User, { username: options.username });
    if (existingUser) {
      return {
        errors: [
          {
            field: "username",
            errorMessage: "Username already exists",
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      username: options.username,
      email: options.email,
      password: hashedPassword,
    });

    await em.persistAndFlush(user);
    req.session!.userId = user.id;
    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("options") usernameOrEmail: string,
    @Arg("options") password: string,
    @Ctx() { em, req }: ORMContext
  ): Promise<UserResponse> {
    const isEmail = usernameOrEmail.includes("@");

    const user = await em.findOne(User, {
      [isEmail ? "email" : "username"]: usernameOrEmail,
    });

    if (!user) {
      return {
        errors: [
          {
            field: "username",
            errorMessage: "username is invalid",
          },
        ],
      };
    }

    const valid = await argon2.verify(user.password, password); // order of arguments is important
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            errorMessage: "incorrect password",
          },
        ],
      };
    }

    req.session!.userId = user.id;
    return { user };
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { req, em }: ORMContext) {
    if (!req.session!.userId) {
      return null;
    }

    const user = await em.findOne(User, { id: req.session!.userId });
    return user;
  }

  @Mutation(() => Boolean)
  async logout(@Ctx() { req, res }: ORMContext) {
    return new Promise((resolve) => {
      res.clearCookie("qid");
      req.session!.destroy((err) => (err ? resolve(false) : resolve(true)));
    });
  }
}
