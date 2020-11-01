import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { getConnection } from "typeorm";
import { isAuthenticated } from "../middleware/isAuthenticated";
import { Post } from "../entities/Post";
import { ORMContext } from "./types";
import { Updoot } from "../entities/Updoot";

@InputType()
class PostInput {
  @Field()
  title: string;

  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];

  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() { text }: Post) {
    return text.slice(0, 50);
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuthenticated)
  async voting(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: ORMContext
  ) {
    const updoot = value !== -1;
    const { userId } = req.session!;
    const valueToInsert = updoot ? 1 : -1;

    const existingVote = await Updoot.findOne({ where: { postId, userId } });

    // code below for updating an existing vote
    if (existingVote && existingVote.value !== valueToInsert) {
      try {
        const queryForUpdoot = `update updoot set value = $1 where "postId" = $2 and "userId" = $3`;
        const queryForPost = `update post set points = points + $1 where id = $2`;

        await Promise.all([
          await getConnection().query(queryForUpdoot, [
            valueToInsert, // $1
            postId, // $2
            userId, // $3
          ]),
          await getConnection().query(queryForPost, [
            valueToInsert * 2, // $1
            postId, // $2
          ]),
        ]);
        return true;
      } catch (error) {
        console.error(`Could not update the vote for post ${postId}: ${error}`);
        return false;
      }
    }

    // code below for inserting a new vote
    try {
      const query = `update post set points = points + $1 where id = $2`;
      await Promise.all([
        await Updoot.insert({
          userId,
          postId,
          value: valueToInsert,
        }),
        await getConnection().query(query, [valueToInsert, postId]),
      ]);
      return true;
    } catch (error) {
      console.error(`Could not update the post with a vote: ${error}`);
      return false;
    }
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: ORMContext
  ): Promise<PaginatedPosts> {
    const noOfPostsToReturn = Math.min(50, limit);
    const noOfPostsToFetch = noOfPostsToReturn + 1;

    const replacements: any[] = [noOfPostsToFetch];

    if (req.session!.userId) {
      replacements.push(req.session!.userId);
    }

    let cursorIdx = 3;
    if (cursor) {
      replacements.push(cursor);
      cursorIdx = replacements.length;
    }
    // Note: Not wrapping the column name in "" causes problems with postgres below
    const sql = `
      select p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'email', u.email,
        'createdAt', u."createdAt",
        'updatedAt', u."updatedAt"
        ) creator,
      ${
        req.session!.userId
          ? '(select value from updoot where "userId" = $2 and "postId" = p.id) "voteStatus"'
          : 'null as "voteStatus"'
      }
      from post p
      inner join public.user u on u.id = p."creatorId"
      ${cursor ? `where p."createdAt" < $${cursorIdx}` : ""}
      order by p."createdAt" DESC
      limit $1
    `;

    const posts = await getConnection().query(sql, replacements);
    return {
      posts: posts.slice(0, noOfPostsToReturn),
      hasMore: posts.length === noOfPostsToFetch,
    };
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id, { relations: ["creator"] });
  }

  // FIXME: voteStatus and vote on single post
  // @Query(() => Post, { nullable: true })
  // async post(
  //   @Arg("id", () => Int) id: number,
  //   @Ctx() { req }: ORMContext
  // ): Promise<Post | undefined> {
  //   const post = await Post.findOne(id, { relations: ["creator"] });
  //   const { userId } = req.session!;
  //   if (post) {
  //     if (!userId) {
  //       return post;
  //     }
  //     const sql = `select value from updoot where "userId" = ${userId} and "postId" = ${id}`;
  //     const result = await getConnection().query(sql);
  //     const voteStatus = result.length > 0 ? result[0].value : null;
  //     post.voteStatus = voteStatus;
  //     return post;
  //   }
  //   return undefined;
  // }

  @Mutation(() => Post)
  @UseMiddleware(isAuthenticated)
  async createPost(
    @Arg("input", () => PostInput) input: PostInput,
    @Ctx() { req }: ORMContext
  ): Promise<Post> {
    return Post.create({
      ...input,
      creatorId: req.session!.userId,
    }).save();
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("title", () => String, { nullable: true }) title: string
  ): Promise<Post | null> {
    const post = await Post.findOne(id);
    if (!post) {
      return null;
    }

    if (title) {
      await Post.update({ id }, { title });
    }
    return post;
  }

  @Mutation(() => Boolean)
  async deletePost(@Arg("id", () => Int) id: number): Promise<Boolean> {
    try {
      await Post.delete(id);
      return true;
    } catch (error) {
      return false;
    }
  }
}
