// controllers/commentSettingsController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getOrCreateSettings() {
  let settings = await prisma.commentSettings.findFirst();
  if (!settings) {
    settings = await prisma.commentSettings.create({
      data: { allowAnonymousComments: true, showAnonymousComments: true }
    });
  }
  return settings;
}

// Get comment settings (public – used by article pages to show optional/required name)
exports.getCommentSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get comment settings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch comment settings' });
  }
};

// Update comment settings (protected – admin/editor only)
exports.updateCommentSettings = async (req, res) => {
  try {
    const { allowAnonymousComments, showAnonymousComments } = req.body;
    const settings = await getOrCreateSettings();
    const data = {};
    if (typeof allowAnonymousComments === 'boolean') data.allowAnonymousComments = allowAnonymousComments;
    if (typeof showAnonymousComments === 'boolean') data.showAnonymousComments = showAnonymousComments;
    const updated = await prisma.commentSettings.update({
      where: { id: settings.id },
      data
    });
    return res.json({ success: true, data: updated, message: 'Comment settings updated.' });
  } catch (error) {
    console.error('Update comment settings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update comment settings' });
  }
};

// For use in commentController when creating a comment (returns settings doc)
exports.getCommentSettingsHelper = getOrCreateSettings;
