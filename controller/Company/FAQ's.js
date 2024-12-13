const FAQ = require("../../models/FAQ's");
const Product = require("../../models/Product");

// Get pending questions for owner's products

const getPendingQuestions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const search = (req.query.search || "").trim();

    const products = await Product.find({
      ownerId: req.user.id,
    }).select("basicDetails.slug");

    if (!products?.length) {
      return res.status(200).json({
        success: true,
        message: "No products found for this owner",
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          limit,
        },
      });
    }

    const productSlugs = products
      .map((product) => product.basicDetails?.slug)
      .filter(Boolean);

    const baseQuery = {
      productSlug: { $in: productSlugs },
      status: "pending",
      isPublished: false,
    };

    // Updated search query to match schema fields
    const searchQuery = search
      ? {
          ...baseQuery,
          $or: [
            { question: { $regex: search, $options: "i" } }, // Changed from questions to question
            { answer: { $regex: search, $options: "i" } },
          ],
        }
      : baseQuery;

    const totalItems = await FAQ.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalItems / limit);
    const validatedPage = Math.min(page, totalPages || 1);
    const skip = (validatedPage - 1) * limit;

    // Updated populate to include answeredBy
    const pendingFAQs = totalItems
      ? await FAQ.find(searchQuery)
          .populate("askedBy", "name email")
          .populate("answeredBy", "name email") // Added answeredBy population
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
      : [];

    return res.status(200).json({
      success: true,
      message: pendingFAQs.length
        ? "FAQs fetched successfully"
        : "No FAQs found",
      data: pendingFAQs,
      pagination: {
        currentPage: validatedPage,
        totalPages,
        totalItems,
        limit,
      },
    });
  } catch (error) {
    console.error("Error in getPendingQuestions:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching pending questions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Answer and publish a question
const answerQuestion = async (req, res) => {
  try {
    const { faqId } = req.params;
    const { answer, publish } = req.body;

    if (!answer) {
      return res.status(400).json({
        success: false,
        message: "Answer is required",
      });
    }

    const faq = await FAQ.findById(faqId);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    faq.answer = answer;
    faq.answeredBy = req.user._id;
    faq.status = publish ? "published" : "answered";
    faq.isPublished = publish || false;

    await faq.save();

    return res.status(200).json({
      success: true,
      message: publish
        ? "Answer published successfully"
        : "Answer saved successfully",
      data: faq,
    });
  } catch (error) {
    console.error("Error in answerQuestion:", error);
    return res.status(500).json({
      success: false,
      message: "Error saving answer",
    });
  }
};

const publishFAQ = async (req, res) => {
  try {
    const { faqId } = req.params;

    const faq = await FAQ.findById(faqId);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    // Check if FAQ is answered
    if (faq.status !== "answered") {
      return res.status(400).json({
        success: false,
        message: "FAQ must be answered before publishing",
      });
    }

    // Update FAQ status and isPublished flag
    faq.status = "published";
    faq.isPublished = true;

    await faq.save();

    return res.status(200).json({
      success: true,
      message: "FAQ published successfully",
      data: faq,
    });
  } catch (error) {
    console.error("Error in publishFAQ:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid FAQ ID format",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error publishing FAQ",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getProductFAQs = async (req, res) => {
  try {
    // Get pagination and search parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    // Get all products owned by this user
    const products = await Product.find({ ownerId: req.user.id });

    if (!products.length) {
      return res.status(200).json({
        success: true,
        message: "No products found for this owner",
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          limit,
        },
      });
    }

    // Get product slugs
    const productSlugs = products.map((product) => product.basicDetails.slug);

    // Build search query
    const searchQuery = {
      productSlug: { $in: productSlugs },
      status: "published",
      isPublished: true,
    };

    // Add search conditions if search parameter exists
    if (search) {
      searchQuery.$or = [
        { questions: { $regex: search, $options: "i" } },
        { answer: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination values
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalItems = await FAQ.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalItems / limit);

    // Get FAQs with pagination and search
    const faqs = await FAQ.find(searchQuery)
      .populate("askedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: "FAQs fetched successfully",
      data: faqs,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit,
      },
    });
  } catch (error) {
    console.error("Error in getProductFAQs:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching FAQs",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const rejectFAQ = async (req, res) => {
  try {
    const { faqId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const faq = await FAQ.findById(faqId);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    // Update FAQ status
    const updatedFAQ = await FAQ.findByIdAndUpdate(
      faqId,
      {
        status: "rejected",
        rejectionReason,
        answeredBy: req.user.id,
        updatedAt: new Date(),
      },
      { new: true }
    )
      .populate("askedBy", "name email")
      .populate("answeredBy", "name email");

    return res.status(200).json({
      success: true,
      message: "FAQ rejected successfully",
      data: updatedFAQ,
    });
  } catch (error) {
    console.error("Error in rejectFAQ:", error);
    return res.status(500).json({
      success: false,
      message: "Error rejecting FAQ",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const editFaqQuestion = async (req, res) => {
  try {
    const { faqId } = req.params;
    const { question } = req.body;

    // Validate input
    if (!question || question.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Question cannot be empty",
      });
    }

    // Find and update the FAQ
    const updatedFaq = await FAQ.findByIdAndUpdate(
      faqId,
      {
        question,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedFaq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Question updated successfully",
      data: updatedFaq,
    });
  } catch (error) {
    console.error("Edit FAQ error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update question",
      error: error.message,
    });
  }
};

module.exports = {
  getPendingQuestions,
  answerQuestion,
  publishFAQ,
  getProductFAQs,
  rejectFAQ,
  editFaqQuestion,
};
