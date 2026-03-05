// controllers/commentController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create comment (public) - for news or blog article
exports.createComment = async (req, res) => {
  try {
    const { articleType, articleId, body, authorName } = req.body;

    if (!articleType || !articleId || !body || typeof body !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'articleType, articleId and body are required'
      });
    }

    const trimmedBody = body.trim();
    if (trimmedBody.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'Comment body cannot be empty'
      });
    }

    if (!['news', 'blog'].includes(articleType)) {
      return res.status(400).json({
        success: false,
        message: 'articleType must be "news" or "blog"'
      });
    }

    const model = articleType === 'news' ? prisma.news : prisma.blog;
    const article = await model.findUnique({
      where: { id: articleId }
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    if (!article.commentsEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Comments are not enabled for this article'
      });
    }

    const comment = await prisma.comment.create({
      data: {
        articleType,
        articleId,
        body: trimmedBody,
        authorName: authorName && typeof authorName === 'string' ? authorName.trim().slice(0, 100) : null,
        authorId: req.user?.id || null,
        status: 'PENDING'
      }
    });

    return res.status(201).json({
      success: true,
      data: comment,
      message: 'Comment submitted and is pending moderation'
    });
  } catch (error) {
    console.error('Create comment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit comment'
    });
  }
};

// Get approved comments for an article (public)
exports.getCommentsByArticle = async (req, res) => {
  try {
    const { articleType, articleId } = req.params;

    if (!articleType || !articleId || !['news', 'blog'].includes(articleType)) {
      return res.status(400).json({
        success: false,
        message: 'Valid articleType (news|blog) and articleId are required'
      });
    }

    const comments = await prisma.comment.findMany({
      where: {
        articleType,
        articleId,
        status: 'APPROVED'
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.json({
      success: true,
      data: comments
    });
  } catch (error) {
    console.error('Get comments error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch comments'
    });
  }
};

// Get all comments for moderation (protected)
exports.getComments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, articleType } = req.query;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (status && ['PENDING', 'APPROVED', 'HIDDEN'].includes(status)) {
      where.status = status;
    }
    if (articleType && ['news', 'blog'].includes(articleType)) {
      where.articleType = articleType;
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.comment.count({ where })
    ]);

    return res.json({
      success: true,
      data: {
        comments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Get comments (moderation) error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch comments'
    });
  }
};

// Update comment status (approve, hide) - moderation
exports.updateCommentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['PENDING', 'APPROVED', 'HIDDEN'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (PENDING, APPROVED, HIDDEN) is required'
      });
    }

    const comment = await prisma.comment.update({
      where: { id },
      data: { status }
    });

    return res.json({
      success: true,
      data: comment
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }
    console.error('Update comment status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update comment'
    });
  }
};

// Delete comment - moderation
exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.comment.delete({
      where: { id }
    });

    return res.json({
      success: true,
      message: 'Comment deleted'
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }
    console.error('Delete comment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete comment'
    });
  }
};
