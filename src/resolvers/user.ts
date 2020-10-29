import argon2 from "argon2";
// import { getConnection } from "typeorm";
import { sendEmail } from "../utils/sendEmail";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { v4 } from "uuid";
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

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => String)
  email(@Root() { id, email }: User, @Ctx() { req }: ORMContext) {
    // return only the email of the currently logged in user.
    return req.session!.userId === id ? email : "";
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options", () => UsernamePasswordInput) options: UsernamePasswordInput,
    @Ctx() { req }: ORMContext
  ): Promise<UserResponse> {
    if (options.username.length <= 2) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
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

    const existingUser = await User.findOne({
      where: { username: options.username },
    });
    if (existingUser) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            errorMessage: "Username already exists",
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(options.password);
    let user;
    try {
      // Quuery builder way of creating and saving the user into db
      // const result = await getConnection()
      //   .createQueryBuilder()
      //   .insert()
      //   .into(User)
      //   .values({
      //     username: options.username,
      //     email: options.password,
      //     password: hashedPassword,
      //   })
      //   .returning("*")
      //   .execute();
      // user = result.raw[0];
      user = await User.create({
        username: options.username,
        email: options.email,
        password: hashedPassword,
      }).save();
    } catch (error) {
      return {
        errors: [
          {
            field: "something went wrong",
            errorMessage: error,
          },
        ],
      };
    }

    req.session!.userId = user?.id;
    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: ORMContext
  ): Promise<UserResponse> {
    const isEmail = usernameOrEmail.includes("@");

    const user = await User.findOne({
      where: {
        [isEmail ? "email" : "username"]: usernameOrEmail,
      },
    });

    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            errorMessage: `${isEmail ? "email" : "username"} is invalid`,
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
  me(@Ctx() { req }: ORMContext) {
    if (!req.session!.userId) {
      return null;
    }
    return User.findOne(req.session!.userId);
  }

  @Mutation(() => Boolean)
  async logout(@Ctx() { req, res }: ORMContext) {
    return new Promise((resolve) => {
      res.clearCookie("qid");
      req.session!.destroy((err) => (err ? resolve(false) : resolve(true)));
    });
  }

  @Mutation(() => Boolean)
  async forgetPassword(
    @Arg("email") email: string,
    @Ctx() { redis }: ORMContext
  ) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return true;
    }
    const token = v4();
    await redis.set(
      `jicama-slaw${token}`,
      user.id,
      "ex",
      1000 * 60 * 60 * 24 * 3
    );
    await sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">Click here to reset password</a>`
    );

    return true;
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, req }: ORMContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 2) {
      return {
        errors: [
          {
            field: "newPassword",
            errorMessage: "Password has to be 2 or more characters",
          },
        ],
      };
    }

    const key = `jicama-slaw${token}`;
    const userId = await redis.get(key);
    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            errorMessage: "token expired.",
          },
        ],
      };
    }

    const userIdInt = parseInt(userId);
    const user = await User.findOne(userIdInt);
    if (!user) {
      return {
        errors: [
          {
            field: "token",
            errorMessage:
              "User not found - deleted their existence and on their way to Mars 🚀",
          },
        ],
      };
    }

    const hashedPassword = await argon2.hash(newPassword);
    await User.update({ id: userIdInt }, { password: hashedPassword });
    // remove/invalidate the token after single use
    await redis.del(key);
    //log the user in after changing password
    req.session!.userId = user.id;
    return { user };
  }
}
