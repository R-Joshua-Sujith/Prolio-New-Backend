const Report = require("../../models/ReportProduct");
const Product = require("../../models/Product");
const mongoose = require("mongoose");

exports.getAllReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate({
        path: "productId",
        select:
          "basicDetails.name basicDetails.price basicDetails.description images",
      })
      .populate({
        path: "reportedBy", // This now references the Customer model
        select: "name email", // Make sure these fields exist in your Customer model
      })
      .populate({
        path: "reviewedBy",
        select: "name email",
      });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSingleReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate({
        path: "productId",
        select:
          "basicDetails.name basicDetails.price basicDetails.description images status",
      })
      .populate({
        path: "reportedBy", // This now references the Customer model
        select: "name email", // Make sure these fields exist in your Customer model
      })
      .populate({
        path: "reviewedBy",
        select: "name email",
      });

    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    }
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateReportStatus = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;

    if (!["pending", "reviewed", "resolved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Status must be pending, reviewed, resolved, or rejected",
      });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewNotes,
        reviewedBy: req.admin._id,
      },
      { new: true }
    ).populate([
      {
        path: "productId",
        select:
          "basicDetails.name basicDetails.price basicDetails.description images",
      },
      {
        path: "reportedBy",
        select: "name email",
      },
      {
        path: "reviewedBy",
        select: "name email",
      },
    ]);

    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    }

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    }

    if (report.attachments && report.attachments.length > 0) {
      // Add your file deletion logic here if needed
    }

    await Report.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// exports.toggleProductBlock = async (req, res) => {
//   try {
//     const { productId } = req.params;
//     const { action, reason } = req.body;

//     if (!productId) {
//       return res.status(400).json({
//         success: false,
//         message: "Product ID is required",
//       });
//     }

//     const product = await Product.findById(productId);

//     if (!product) {
//       return res.status(404).json({
//         success: false,
//         message: "Product not found",
//       });
//     }

//     const updateData =
//       action === "block"
//         ? {
//             "block.isBlocked": true,
//             "block.reason": reason,
//             "block.blockedBy": req.user.id,
//             "block.blockedAt": new Date(),
//             status: "In_Active",
//           }
//         : {
//             "block.isBlocked": false,
//             "block.reason": null,
//             "block.blockedBy": null,
//             "block.blockedAt": null,
//             status: "Active",
//           };

//     const updatedProduct = await Product.findByIdAndUpdate(
//       productId,
//       updateData,
//       {
//         new: true,
//         select: "block status basicDetails ownerId",
//       }
//     )
//       .populate("block.blockedBy", "name email")
//       .populate("ownerId", "name email");

//     if (!updatedProduct) {
//       return res.status(400).json({
//         success: false,
//         message: "Failed to update product",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: `Product successfully ${action}ed`,
//       data: updatedProduct,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message || "Internal server error",
//     });
//   }
// };

exports.toggleProductBlock = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId } = req.params;
    const { action, reason, reportId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const updateData =
      action === "block"
        ? {
            "block.isBlocked": true,
            "block.reason": reason,
            "block.blockedBy": req.user.id,
            "block.blockedAt": new Date(),
            status: "In_Active",
          }
        : {
            "block.isBlocked": false,
            "block.reason": null,
            "block.blockedBy": null,
            "block.blockedAt": null,
            status: "Active",
          };

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      {
        new: true,
        session,
        select: "block status basicDetails ownerId",
      }
    )
      .populate("block.blockedBy", "name email")
      .populate("ownerId", "name email");

    if (!updatedProduct) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Failed to update product",
      });
    }

    // If a reportId is provided, update the report status to resolved
    if (reportId && action === "block") {
      const updatedReport = await Report.findByIdAndUpdate(
        reportId,
        {
          status: "resolved",
          resolvedAt: new Date(),
          resolvedBy: req.user.id,
        },
        {
          new: true,
          session,
        }
      );

      if (!updatedReport) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Failed to update report status",
        });
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `Product successfully ${action}ed`,
      data: {
        product: updatedProduct,
        report: reportId ? { status: "resolved" } : null,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  } finally {
    session.endSession();
  }
};
