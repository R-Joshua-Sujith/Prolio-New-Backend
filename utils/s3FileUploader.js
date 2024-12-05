const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();
/**
 * Function to extract the S3 key from a URL
 * @param {string} url - The URL of the file
 * @returns {string | null} - Returns the S3 key or null if not found
 */
function extractS3KeyFromUrl(url) {
  const regex = new RegExp(
    `https://(${process.env.S3_BUCKET_NAME}.s3.amazonaws.com|s3.amazonaws.com/${process.env.S3_BUCKET_NAME})/(.*)`
  );
  const match = url.match(regex);
  return match ? match[2] : null;
}

// S3 client setup
const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

/**
 * Function to upload a file to S3
 * @param {Buffer} file - The buffer of the file to upload
 * @param {string} filename - The name of the file
 * @param {string} mimetype - The mimetype of the file
 * @param {string} folder - The folder to upload to
 * @returns {Object} - Object containing properties 'filename' and 'url'
 */
/** */
const uploadToS3 = async (file, filename, mimetype, folder) => {
  try {
    const fileExtension = path.extname(filename);
    const uniqueFileName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${fileExtension}`;
    const key = `${folder}/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: mimetype,
    });

    await s3Client.send(command);

    // Construct the public URL using the correct format
    const publicUrl = `https://s3.amazonaws.com/${process.env.S3_BUCKET_NAME}/${key}`;

    return {
      filename: key,
      url: publicUrl,
    };
  } catch (error) {
    console.log("Error uploading file to S3:", error);
    throw error;
  }
};


const deleteFromS3 = async (publicId) => {
  try {
    if (!publicId) {
      throw new Error("No publicId provided for deletion");
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: publicId,
    });

    await s3Client.send(command);
    console.log(`Successfully deleted ${publicId} from S3`);
  } catch (error) {
    console.log("Error deleting file from S3:", error);
    throw error;
  }
};

module.exports = {
  uploadToS3,
  deleteFromS3,
};
