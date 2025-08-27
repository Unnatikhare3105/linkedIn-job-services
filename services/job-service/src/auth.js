
   export const authenticate = (req, res, next) => {
     req.user = {
       id: 'user-123e4567-e89b-12d3-a456-426614174000',
       canCreateJobs: true,
       canUpdateJobs: true,
       canDeleteJobs: true,
     };
     next();
   };
   