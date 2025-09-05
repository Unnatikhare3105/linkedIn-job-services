// *2. MATCH SCORE ALGORITHM* (User-Job compatibility)
export const calculateMatchScore = (job, userProfile = {}) => {
  let matchScore = 0;
  let maxScore = 100;
  
  // Skills match (40% weight)
  if (userProfile.skills && job.skills) {
    const userSkillsSet = new Set(userProfile.skills.map(s => s.toLowerCase()));
    const jobSkillsSet = new Set(job.skills.map(s => s.name?.toLowerCase()));
    const intersection = new Set([...userSkillsSet].filter(x => [...jobSkillsSet].some(j => j.includes(x))));
    matchScore += (intersection.size / Math.max(jobSkillsSet.size, 1)) * 40;
  }
  
  // Experience match (30% weight)
  if (userProfile.experience !== undefined && job.experience) {
    const userExp = userProfile.experience;
    const jobMinExp = job.experience.min || 0;
    const jobMaxExp = job.experience.max || 50;
    
    if (userExp >= jobMinExp && userExp <= jobMaxExp) {
      matchScore += 30; // Perfect match
    } else if (userExp >= jobMinExp) {
      matchScore += 20; // Overqualified
    } else {
      matchScore += 10; // Underqualified but possible
    }
  }
  
  // Location preference (20% weight)
  if (userProfile.location && job.location) {
    if (job.location.remote) {
      matchScore += 20; // Remote is always a match
    } else if (job.location.city?.toLowerCase() === userProfile.location?.toLowerCase()) {
      matchScore += 20; // Same city
    } else if (job.location.state?.toLowerCase() === userProfile.state?.toLowerCase()) {
      matchScore += 10; // Same state
    }
  }
  
  // Salary expectation (10% weight)
  if (userProfile.expectedSalary && job.salary) {
    if (job.salary.max >= userProfile.expectedSalary) {
      matchScore += 10;
    }
  }
  
  return Math.min(matchScore, maxScore);
};