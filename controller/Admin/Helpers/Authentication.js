// Validation for admin login input
const validateLoginInput = (email, password) => {
  const errors = {};

  // Validate email
  if (!email) {
    errors.email = "Email is required";
  } else if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    errors.email = "Please provide a valid email address";
  }

  // Validate password
  if (!password) {
    errors.password = "Password is required. Please enter your password.";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};

module.exports = { validateLoginInput };
