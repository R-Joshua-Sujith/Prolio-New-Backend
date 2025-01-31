const router = require("express").Router();
const multer = require("multer");
const { companyVerify } = require("../../controller/Company/Middleware/auth");
const { customerVerify } = require("../../controller/Customer/Middleware/auth");
const {
  getAllStories,
  createCompanyStory,
  updateCompanyStory,
  getCompanyStory,
  deleteStoryImage,
} = require("../../controller/Company/companyStoryController");

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5, // Max 5 files
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

// Routes
router.get("/stories", companyVerify, getAllStories);

router.post(
  "/create-story",
  upload.array("images", 5), // This is correct
  companyVerify,
  createCompanyStory
);

router.put(
  "/update-story/:ownerId",
  upload.array("images", 5),
  companyVerify,
  updateCompanyStory
);

router.get("/get-story/:ownerId", customerVerify, getCompanyStory);

router.delete("/delete-image/:imageId", companyVerify, deleteStoryImage);

module.exports = router;
