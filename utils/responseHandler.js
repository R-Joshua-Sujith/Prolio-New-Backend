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
