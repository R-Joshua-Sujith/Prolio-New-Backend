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
    auth: "/company/auth",
    enquiry: "/company/enquiry",
    product: "/company/product",
  },

  // Admin routes
  admin: {
    auth: "/admin/auth",
    banner: "/admin/banner",
    enquiry: "/admin/enquiry",
    product: "/admin/product",
  },
};

module.exports = apiRoutes;
