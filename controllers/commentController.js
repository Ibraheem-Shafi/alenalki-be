// controllers/commentController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getCommentSettingsHelper } = require('./commentSettingsController');

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

    const commentSettings = await getCommentSettingsHelper();
    const nameValue = authorName && typeof authorName === 'string' ? authorName.trim().slice(0, 100) : null;
    if (!commentSettings.allowAnonymousComments && !nameValue) {
      return res.status(400).json({
        success: false,
        message: 'Name is required. Anonymous comments are not allowed.'
      });
    }

    const comment = await prisma.comment.create({
      data: {
        articleType,
        articleId,
        body: trimmedBody,
        authorName: nameValue,
        authorId: req.user?.id || null,
        status: 'APPROVED' // Show instantly; moderators can hide or delete if needed
      }
    });

    return res.status(201).json({
      success: true,
      data: comment,
      message: 'Comment posted.'
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

    const commentSettings = await getCommentSettingsHelper();
    const where = {
      articleType,
      articleId,
      status: 'APPROVED'
    };
    if (commentSettings && commentSettings.showAnonymousComments === false) {
      where.authorName = { not: null };
    }

    const comments = await prisma.comment.findMany({
      where,
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
    const {
      page = 1,
      limit = 20,
      status,
      articleType,
      articleId,
      authorName,
      bodySearch,
      dateFrom,
      dateTo
    } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (status && ['PENDING', 'APPROVED', 'HIDDEN'].includes(status)) {
      where.status = status;
    }
    if (articleType && ['news', 'blog'].includes(articleType)) {
      where.articleType = articleType;
    }
    if (articleId && typeof articleId === 'string' && articleId.trim()) {
      where.articleId = articleId.trim();
    }
    if (authorName && typeof authorName === 'string' && authorName.trim()) {
      where.authorName = { contains: authorName.trim() };
    }
    if (bodySearch && typeof bodySearch === 'string' && bodySearch.trim()) {
      where.body = { contains: bodySearch.trim() };
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom && typeof dateFrom === 'string' && dateFrom.trim()) {
        const d = new Date(dateFrom.trim());
        if (!isNaN(d.getTime())) where.createdAt.gte = d;
      }
      if (dateTo && typeof dateTo === 'string' && dateTo.trim()) {
        const d = new Date(dateTo.trim());
        if (!isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          where.createdAt.lte = d;
        }
      }
      if (Object.keys(where.createdAt).length === 0) delete where.createdAt;
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
          pages: Math.ceil(total / limitNum) || 1
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
