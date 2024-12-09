const Report = require("../../models/ReportProduct");
const Product = require("../../models/Product");
const { uploadToS3, deleteFromS3 } = require("../../utils/s3FileUploader");

exports.createReport = async (req, res) => {
  try {
    const { productId, reason, description } = req.body;
    const files = req.files;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Handle file uploads to S3
    const attachments = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const uploadResult = await uploadToS3(
          file.buffer,
          file.originalname,
          file.mimetype,
          "reports"
        );

        attachments.push({
          url: uploadResult.url,
          publicId: uploadResult.filename,
          fileType: file.mimetype,
          fileName: file.originalname,
        });
      }
    }

    // Create report
    const report = new Report({
      productId,
      reportedBy: req.user._id,
      reason,
      description,
      attachments,
    });

    await report.save();

    res.status(201).json({
      message: "Report submitted successfully",
      report,
    });
  } catch (error) {
    // Clean up uploaded files if report creation fails
    if (error && attachments?.length > 0) {
      for (const attachment of attachments) {
        await deleteFromS3(attachment.publicId).catch(console.error);
      }
    }

    console.error("Error creating report:", error);
    res.status(500).json({ message: "Error submitting report" });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Delete attachments from S3
    if (report.attachments?.length > 0) {
      for (const attachment of report.attachments) {
        await deleteFromS3(attachment.publicId);
      }
    }

    await Report.findByIdAndDelete(reportId);

    res.status(200).json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({ message: "Error deleting report" });
  }
};
