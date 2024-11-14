const validateRegistrationInput = (name, email, password) => {
    const errors = {};

    if (!email) {
        errors.email = "Email is required";
    } else if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        errors.email = "Please provide a valid email address";
    }

    if (!name) errors.firstName = "Name is required";

    if (!password) {
        errors.password = "Password is required";
    } else if (password.length < 6) {
        errors.password = "Password must be at least 6 characters long";
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

const validateLoginInput = (email, password) => {
    const errors = {};

    if (!email) {
        errors.email = "Email is required";
    } else if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        errors.email = "Please provide a valid email address";
    }

    if (!password) {
        errors.password = "Password is required";
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};


module.exports = { validateLoginInput, validateRegistrationInput }