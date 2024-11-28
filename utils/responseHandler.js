/**
 * Function to handle and send standardized API responses.
 *
 * @param {Object} res - The Express response object used to send the response.
 * @param {number} statusCode - The HTTP status code for the response (e.g., 200 for success).
 * @param {boolean} success - Indicates if the request was successful or not (true/false).
 * @param {string} message - A descriptive message providing information about the request result.
 *
 * This function standardizes the API responses, ensuring consistency across the application.
 */

function sendResponse(res, statusCode, success, message, data = null) {
  const response = {
    success,
    message,
  };

  if (data) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
}

const apiResponse = {
  success: (res, statusCode, message, data = null) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  },
  error: (res, statusCode, message, error = null) => {
    return res.status(statusCode).json({
      success: false,
      message,
      error: error?.message || error,
    });
  },
};

module.exports = { sendResponse, apiResponse };
