// Cube.js configuration
module.exports = {
  // You can add custom configuration options here
  // Reference: https://cube.dev/docs/config

  checkAuth: (req, auth) => {
    // For development, we skip auth. In production, implement JWT verification here.
    // e.g. return jwt.verify(auth, process.env.CUBEJS_API_SECRET);
  },

  queryRewrite: (query, { securityContext }) => {
    // Row level security rules can be added here
    return query;
  },
};
