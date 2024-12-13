const Notification = require("../../models/Notification");
const Message = require("../../models/message");
const Forum = require("../../models/Forum");
const { sendResponse } = require("../../utils/responseHandler");
const FAQ = require("../../models/FAQ's");
const Product = require("../../models/Product");

// Customer asks a question
const postQuestion = async (req, res) => {
  try {
    const { slug } = req.params;
    const { question } = req.body;

    // Input validation
    if (!question || question.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Question is required",
      });
    }

    // Find product
    const product = await Product.findOne({ "basicDetails.slug": slug });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check for duplicate question
    const existingQuestion = await FAQ.findOne({
      productSlug: slug,
      askedBy: req.user._id,
      question: question,
    });

    if (existingQuestion) {
      return res.status(400).json({
        success: false,
        message: "You have already asked this question",
      });
    }

    // Create new FAQ
    const newFAQ = new FAQ({
      question,
      productSlug: slug, // Using slug instead of productId
      askedBy: req.user._id,
      status: "pending",
    });

    await newFAQ.save();

    // Create notification
    await new Notification({
      recipient: product.owner,
      type: "new_question",
      message: `New question received for product: ${product.basicDetails.name}`,
      data: {
        productSlug: slug,
        questionId: newFAQ._id,
        productName: product.basicDetails.name,
      },
    }).save();

    return res.status(201).json({
      success: true,
      message: "Question submitted successfully",
      data: newFAQ,
    });
  } catch (error) {
    console.error("Error in postQuestion:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid input data",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error submitting question",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get published FAQs for a product
const getFAQsByProduct = async (req, res) => {
  try {
    const { slug } = req.params;

    // First check if product exists
    const product = await Product.findOne({ "basicDetails.slug": slug });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Fetch only published FAQs
    const faqs = await FAQ.find({
      productSlug: slug,
      status: "published",
      isPublished: true,
    })
      .select("question answer createdAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "FAQs fetched successfully",
      data: faqs,
    });
  } catch (error) {
    console.error("Error in getFAQsByProduct:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching FAQs",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  postQuestion,
  getFAQsByProduct,
};
