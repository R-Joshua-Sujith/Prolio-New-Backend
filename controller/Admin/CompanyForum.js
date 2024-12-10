const CustomerModel = require("../../models/Customer");
const ForumModel = require("../../models/Forum");
const { sendResponse } = require("../../utils/responseHandler");

(exports.getAllCompanyForums = async (req, res) => {
  try {
    const { customerId } = req.params;

    // Find forums where the ownerId matches the provided customerId
    const forums = await ForumModel.find({ ownerId: customerId })
      .populate("ownerId", "name email")
      .exec();

    if (!forums || forums.length === 0) {
      return sendResponse(res, 404, "No forums found for this company");
    }

    return sendResponse(
      res,
      200,
      "Company forums fetched successfully",
      forums
    );
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, "Server error");
  }
}),


  (exports.toggleBlockUnblockForum = async (req, res) => {
    try {
      const { forumId } = req.params;

      // Find the forum
      const forum = await ForumModel.findById(forumId);
      if (!forum) {
        return sendResponse(res, 404, false, null, "Forum not found");
      }

      // Toggle the isBlocked field
      forum.isBlocked = !forum.isBlocked;
      await forum.save();

      const message = forum.isBlocked
        ? "Forum has been blocked successfully"
        : "Forum has been unblocked successfully";

      return sendResponse(
        res,
        200,
        true,
        { isBlocked: forum.isBlocked },
        message
      );
    } catch (error) {
      console.error("Error in toggling forum block/unblock:", error);
      return sendResponse(res, 500, false, null, "Internal server error");
    }
  });
