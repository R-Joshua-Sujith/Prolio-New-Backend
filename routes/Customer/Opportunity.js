const express = require("express");
const router = express.Router();
const multer = require('multer');
const storage = multer.memoryStorage(); // Store file in memory for S3 upload
const multerS3 = require('multer-s3');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const s3 = require("../../utils/s3FileUploader");


const customerOpportunityController = require("../../controller/Customer/Opportunity");
const { customerVerify } = require("../../controller/Customer/Middleware/auth");



const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 3 * 1024 * 1024, // 3MB 
    files: 4 // Maximum 4 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 
      'image/png'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});



router.post(
  "/submitOpportunity",
  upload.array('documents', 4),
  customerVerify,
  customerOpportunityController.submitOpportunity
);

router.get(
  "/viewSingleOpportunity/:opportunityId",
  customerVerify,
  customerOpportunityController.viewSingleOpportunity
);

router.get(
  "/viewAllSentOpportunity",
  customerVerify,
  customerOpportunityController.viewAllOpportunity
);

module.exports = router;
