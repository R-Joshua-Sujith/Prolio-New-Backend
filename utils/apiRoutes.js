const apiRoutes = {
  // Customer routes
  customer: {
    auth: "/customer/auth",
    enquiry: "/customer/enquiry",
    opportunity: "/customer/opportunity",
    product: "/customer/product",
  },

  // Company routes
  company: {
    enquiry: "/company/enquiry",
    product: "/company/product",
  },
};

module.exports = apiRoutes;
