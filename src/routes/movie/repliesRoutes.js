const express = require('express');
const router = express.Router();
const Reply = require('../../models/Reply');
const Comment = require('../../models/Comment');

// GET replies of a comment
router.get('/:commentId', async (req, res) => {
  try {
    const replies = await Reply.find({ parentCommentId: req.params.commentId }).sort({ createdAt: 1 });
    res.status(200).json(replies);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get replies' });
  }
});

// ✅ GET replies received by a specific user - NEW: ?username=<username>
// ✅ GET replies received by a specific user - ?username=<username>
// ✅ GET replies received by a specific user - ?username=<username>
router.get('/', async (req, res) => {
  const username = req.query.username;

  if (!username) {
    return res.status(400).json({ error: 'Missing username query parameter' });
  }

  try {
    const replies = await Reply.find({ receiver: username })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const commentIds = replies.map((r) => r.parentCommentId?.toString());
    
    const commentMap = await Comment.find({
      _id: { $in: commentIds },
    })
      .select('_id movieId')
      .lean();

    // Convert to { [commentId]: movieId }
    const commentIdToMovie = {};
    commentMap.forEach((c) => {
      commentIdToMovie[c._id.toString()] = c.movieId;
    });

    const formatted = replies.map((r) => {
      const commentId = r.parentCommentId?.toString();
      const movieId = commentIdToMovie[commentId];

      return {
        ...r,
        message: r.message, // giữ nội dung comment làm message
        reply: r.message,
        sender: r.author,
        timestamp: new Date(r.createdAt).getTime(),
        link: movieId
          ? `/moviedetails/${movieId}#comment-${commentId}`
          : `/#comment-${commentId}`, // fallback nếu thiếu movieId
      };
    });

    res.status(200).json(formatted);
  } catch (err) {
    console.error('❌ Error fetching received replies:', err);
    res.status(500).json({ message: 'Failed to get received replies' });
  }
});



// ✅ POST reply to a comment (with receiver)
router.post('/', async (req, res) => {
  const { parentCommentId, author, message } = req.body;

  if (!parentCommentId || !author || !message) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    // Tìm comment gốc để lấy người tạo
    const parentComment = await Comment.findById(parentCommentId);

    if (!parentComment) {
      return res.status(404).json({ message: 'Parent comment not found' });
    }

    const receiver = parentComment.author;

    // Lưu reply có cả receiver
    const reply = new Reply({
      parentCommentId,
      author,
      message,
      receiver: receiver !== author ? receiver : undefined, // không cần receiver nếu tự trả lời
    });

    await reply.save();

    // 🔔 Emit notification nếu người nhận khác người gửi
    if (receiver && receiver !== author) {
  const io = req.app.locals.io;
  const movieId = parentComment.movieId;

  if (!movieId) {
    console.warn("⚠️ Không tìm thấy movieId từ comment:", parentCommentId);
  }

  const link = movieId
    ? `/moviedetails/${movieId}#comment-${parentCommentId}`
    : `/#comment-${parentCommentId}`; // fallback nếu thiếu movieId

  io.to(receiver).emit("new_reply", {
    sender: author,
    message: `${author} đã phản hồi bình luận của bạn`,
    reply: message,
    createdAt: new Date(),
    link, // ✅ đảm bảo luôn có link hợp lệ
  });
    }

    res.status(201).json(reply);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create reply' });
  }
});

// DELETE a reply
router.delete('/:replyId', async (req, res) => {
  const { replyId } = req.params;

  try {
    const deletedReply = await Reply.findByIdAndDelete(replyId);
    if (!deletedReply) {
      return res.status(404).json({ message: 'Reply not found' });
    }
    res.status(200).json({ message: 'Reply deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete reply' });
  }
});

module.exports = router;
