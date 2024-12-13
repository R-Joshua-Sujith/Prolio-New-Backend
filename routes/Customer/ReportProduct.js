const express = require("express");
const router = express.Router();
const multer = require("multer");
const ReportProductController = require("../../controller/Customer/ReportProduct");
const { looseVerify } = require("../../controller/Customer/Middleware/auth");

// Multer configuration
const multerConfig = {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only images and PDF files are allowed"), false);
    }
  },
};

// Basic error handling middleware
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      message: "File upload error",
      error: error.message,
    });
  }
  next(error);
};

// Routes
router.post(
  "/create-report",
  looseVerify,
  multer(multerConfig).array("attachments", 2),
  handleUploadError,
  ReportProductController.createReport
);

router.delete(
  "/reports/:reportId",
  looseVerify,
  ReportProductController.deleteReport
);

module.exports = router;
