const asyncHandler = require("express-async-handler");
const Category = require("../../model/Category/Category");
const Post = require("../../model/Post/Post");
const User = require("../../model/User/User");
const expressAsyncHandler = require("express-async-handler");
//@desc  Create a post
//@route POST /api/v1/posts
//@access Private

exports.createPost = asyncHandler(async (req, res) => {
  //Get the payload
  const { title, content, categoryId } = req.body;
  //chech if post exists
  const postFound = await Post.findOne({ title });
  if (postFound) {
    throw new Error("Post aleady exists");
  }
  //Create post
  const post = await Post.create({
    title,
    content,
    category: categoryId,
    author: req?.userAuth?._id,
    image: req?.file?.path,
  });
  //!Associate post to user
  await User.findByIdAndUpdate(
    req?.userAuth?._id,
    {
      $push: { posts: post._id },
    },
    {
      new: true,
    }
  );

  //* Push post into category
  await Category.findByIdAndUpdate(
    req?.userAuth?._id,
    {
      $push: { posts: post._id },
    },
    {
      new: true,
    }
  );
  //? send the response
  res.json({
    status: "scuccess",
    message: "Post Succesfully created",
    post,
  });
});

//@desc  Get all posts
//@route GET /api/v1/posts
//@access Private

exports.getPosts = asyncHandler(async (req, res) => {
  // !find all users who have blocked the logged-in user
  const loggedInUserId = req.userAuth?._id;
  //get current time
  const currentTime = new Date();
  const usersBlockingLoggedInuser = await User.find({
    blockedUsers: loggedInUserId,
  });
  // Extract the IDs of users who have blocked the logged-in user
  const blockingUsersIds = usersBlockingLoggedInuser?.map((user) => user?._id);

  //query
  const query = {
    author: { $nin: blockingUsersIds },
    $or: [
      {
        shedduledPublished: { $lte: currentTime },
        shedduledPublished: null,
      },
    ],
  };
  const posts = await Post.find(query)
    .populate({
      path: "author",
      model: "User",
      select: "email role username",
    })
    .populate("category");
  res.status(201).json({
    status: "success",
    message: "Posts successfully fetched",
    posts,
  });
});

//@desc  Get single post
//@route GET /api/v1/posts/:id
//@access PUBLIC
exports.getPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id)
    .populate("author")
    .populate("category");
  res.status(201).json({
    status: "success",
    message: "Post successfully fetched",
    post,
  });
});

//@desc  Delete Post
//@route DELETE /api/v1/posts/:id
//@access Private

exports.deletePost = asyncHandler(async (req, res) => {
  //! Find the post
  const postFound = await Post.findById(req.params.id);
  const isAuthor =
    req.userAuth?._id?.toString() === postFound?.author?._id?.toString();
  console.log(isAuthor);

  if (!isAuthor) {
    throw new Error("Action denied, you are not the creator of this post");
  }
  await Post.findByIdAndDelete(req.params.id);
  res.status(201).json({
    status: "success",
    message: "Post successfully deleted",
  });
});

//@desc  update Post
//@route PUT /api/v1/posts/:id
//@access Private

exports.updatePost = asyncHandler(async (req, res) => {
  //!Check if the post exists
  const { id } = req.params;
  const postFound = await Post.findById(id);
  if (!postFound) {
    throw new Error("Post not found");
  }
  //! image update
  const { title, category, content } = req.body;
  const post = await Post.findByIdAndUpdate(
    id,
    {
      image: req?.file?.path ? req?.file?.path : postFound?.image,
      title: title ? title : postFound?.title,
      category: category ? category : postFound?.category,
      content: content ? content : postFound?.content,
    },
    {
      new: true,
      runValidators: true,
    }
  );
  res.status(201).json({
    status: "success",
    message: "post successfully updated",
    post,
  });
});

//@desc  Get only 4 posts
//@route GET /api/v1/posts
//@access PUBLIC

exports.getPublicPosts = asyncHandler(async (req, res) => {
  const posts = await Post.find({})
    .sort({ createdAt: -1 })
    .limit(4)
    .populate("category");
  res.status(201).json({
    status: "success",
    message: "Posts successfully fetched",
    posts,
  });
});

//@desc   liking a Post
//@route  PUT /api/v1/posts/likes/:id
//@access Private

exports.likePost = expressAsyncHandler(async (req, res) => {
  //Get the id of the post
  const { id } = req.params;
  //get the login user
  const userId = req.userAuth._id;
  //Find the post
  const post = await Post.findById(id);
  if (!post) {
    throw new Error("Post not found");
  }
  //Push thr user into post likes

  await Post.findByIdAndUpdate(
    id,
    {
      $addToSet: { likes: userId },
    },
    { new: true }
  );
  // Remove the user from the dislikes array if present
  post.dislikes = post.dislikes.filter(
    (dislike) => dislike.toString() !== userId.toString()
  );
  //resave the post
  await post.save();
  res.status(200).json({ message: "Post liked successfully.", post });
});

//@desc   liking a Post
//@route  PUT /api/v1/posts/likes/:id
//@access Private

exports.disLikePost = expressAsyncHandler(async (req, res) => {
  //Get the id of the post
  const { id } = req.params;
  //get the login user
  const userId = req.userAuth._id;
  //Find the post
  const post = await Post.findById(id);
  if (!post) {
    throw new Error("Post not found");
  }
  //Push the user into post dislikes

  await Post.findByIdAndUpdate(
    id,
    {
      $addToSet: { dislikes: userId },
    },
    { new: true }
  );
  // Remove the user from the likes array if present
  post.likes = post.likes.filter(
    (like) => like.toString() !== userId.toString()
  );
  //resave the post
  await post.save();
  res.status(200).json({ message: "Post disliked successfully.", post });
});

//@desc   clapong a Post
//@route  PUT /api/v1/posts/claps/:id
//@access Private

exports.claps = expressAsyncHandler(async (req, res) => {
  //Get the id of the post
  const { id } = req.params;
  //Find the post
  const post = await Post.findById(id);
  if (!post) {
    throw new Error("Post not found");
  }
  //implement the claps
  await Post.findOneAndUpdate(
    id,
    {
      $inc: { claps: 1 },
    },
    {
      new: true,
    }
  );
  res.status(200).json({ message: "Post clapped successfully.", post });
});

//@desc   Shedule a post
//@route  PUT /api/v1/posts/schedule/:postId
//@access Private

exports.schedule = expressAsyncHandler(async (req, res) => {
  //get the payload
  const { scheduledPublish } = req.body;
  const { postId } = req.params;
  //check if postid and scheduledpublished found
  if (!postId || !scheduledPublish) {
    throw new Error("PostID and schedule date are required");
  }
  //Find the post
  const post = await Post.findById(postId);
  if (!post) {
    throw new Error("Post not found...");
  }
  //check if tjhe user is the author of the post
  if (post.author.toString() !== req.userAuth._id.toString()) {
    throw new Error("You can schedulle your own post ");
  }
  // Check if the scheduledPublish date is in the past
  const scheduleDate = new Date(scheduledPublish);
  const currentDate = new Date();
  if (scheduleDate < currentDate) {
    throw new Error("The scheduled publish date cannot be in the past.");
  }
  //update the post
  post.shedduledPublished = scheduledPublish;
  await post.save();
  res.json({
    status: "success",
    message: "Post scheduled successfully",
    post,
  });
});
