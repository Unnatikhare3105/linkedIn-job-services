export const authenticate = (req, res, next) => {
  req.user = {
    id: "44e32d64-5c51-4887-ba8c-b7f60c2a25ac",
    canCreateJobs: true,
    canUpdateJobs: true,
    canDeleteJobs: true,
    canManageJobs: true,
    isPremium: true,
  };
  next();
};
